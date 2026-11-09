// Service Worker — Làng Chùa
// Cache namespaces prefixed 'lc-' to avoid collision with main app SW.
// Strategy: Stale-While-Revalidate for scenes; Cache-First for static shell.

const SHELL_CACHE  = 'lc-shell-v1';
const SCENE_CACHE  = 'lc-scenes-v1';
const DATA_CACHE   = 'lc-data-v1';

const SHELL_ASSETS = [
  '/lang-chua.html',
  '/lang-chua.js',
  '/lang-chua.css',
  '/js/festival.js',
  '/js/rituals.js',
  '/js/card.js',
  '/data/festival-calendar.json',
];

// ── Install: pre-cache shell ───────────────────────────────────────────────
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(SHELL_CACHE)
      .then(c => c.addAll(SHELL_ASSETS))
      .then(() => self.skipWaiting())
  );
});

// ── Activate: clean stale caches ──────────────────────────────────────────
self.addEventListener('activate', (e) => {
  const keep = new Set([SHELL_CACHE, SCENE_CACHE, DATA_CACHE]);
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k.startsWith('lc-') && !keep.has(k)).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

// ── Fetch: route by URL pattern ───────────────────────────────────────────
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);

  // Scene images — Stale-While-Revalidate; cache permanently after first visit
  if (url.pathname.startsWith('/scenes/')) {
    e.respondWith(staleWhileRevalidate(e.request, SCENE_CACHE));
    return;
  }

  // Festival API — Network-first with data-cache fallback
  if (url.pathname === '/api/festival/current') {
    e.respondWith(networkFirstWithFallback(e.request, DATA_CACHE));
    return;
  }

  // Shell assets — Cache-first
  if (SHELL_ASSETS.some(a => url.pathname === a || url.pathname.endsWith(a))) {
    e.respondWith(cacheFirst(e.request, SHELL_CACHE));
    return;
  }
});

// ── Strategies ────────────────────────────────────────────────────────────

async function staleWhileRevalidate(req, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(req);
  const networkFetch = fetch(req).then(res => {
    if (res.ok) cache.put(req, res.clone());
    return res;
  }).catch(() => null);
  return cached ?? (await networkFetch) ?? new Response('', { status: 503 });
}

async function cacheFirst(req, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(req);
  if (cached) return cached;
  const res = await fetch(req);
  if (res.ok) cache.put(req, res.clone());
  return res;
}

async function networkFirstWithFallback(req, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const res = await fetch(req);
    if (res.ok) cache.put(req, res.clone());
    return res;
  } catch {
    return (await cache.match(req)) ?? new Response('{}', {
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
