// Làng Chùa — main entry module
// Imports from sibling modules (paths relative to cloudtemple root at deploy time).
// Prototype reference: prototypes/vietnam-h5/index.html

import { initFestival, canShowGreetingCard } from './js/festival.js';
import {
  RITUAL_STATES, getRitualState, completeRitual, markerFor,
  runIncense, runSit, tapMo, tapBead, resetAll,
} from './js/rituals.js';
import { buildCard, shareCard, getFlowers, getGreetings } from './js/card.js';
import { createTempleAudio } from '/audio.js';

// ── Audio ──────────────────────────────────────────────────────────────────
const audio = createTempleAudio();
let _audioEnabled = false;
let _pendingRain = false;
function enableAudioOnce() {
  if (_audioEnabled) return;
  _audioEnabled = true;
  audio.enable().catch(() => {});
  if (_pendingRain) startRainSound();
}

// ── Service Worker registration ────────────────────────────────────────────
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw-lang-chua.js', { scope: '/' })
    .catch(() => {}); // non-fatal
}

// ── Temple registry ────────────────────────────────────────────────────────
const TEMPLES = {
  chuamay: { nameVi: 'Chùa Mây',     nameCn: '云寺',     state: 'open',        scenes: false },
  dilac:   { nameVi: 'Chùa Di Lặc',  nameCn: '弥勒寺',   state: 'open',        scenes: true  },
  diatang: { nameVi: 'Chùa Địa Tạng',nameCn: '地藏寺',   state: 'coming_soon', scenes: false },
  lienchi: { nameVi: 'Chùa Liên Trì',nameCn: '莲池寺',   state: 'coming_soon', scenes: false },
  quanam:  { nameVi: 'Chùa Quan Âm', nameCn: '海岸观音寺',state: 'coming_soon', scenes: false },
  duocsu:  { nameVi: 'Chùa Dược Sư', nameCn: '药师寺',   state: 'coming_soon', scenes: false },
  namtong: { nameVi: 'Khu Nam Tông', nameCn: '南传区',   state: 'coming_soon', scenes: false },
};

const SCENE_EXT = '.webp';

// ── Device time → period (VN timezone, UTC+7) ─────────────────────────────
function devicePeriod() {
  const h = (new Date().getUTCHours() + 7) % 24;
  if (h >= 5  && h < 8)  return 'dawn';
  if (h >= 8  && h < 17) return 'day';
  if (h >= 17 && h < 19) return 'dusk';
  return 'night';
}

// ── App state ──────────────────────────────────────────────────────────────
const state = {
  view:      'map',
  temple:    null,
  period:    devicePeriod(),      // follows device clock (VN timezone)
  sceneView: 'hall-front',
  myTemple:  loadMyTemple(),
};

// ── Selectors (cached once) ────────────────────────────────────────────────
const mapView      = document.getElementById('map-view');
const templeView   = document.getElementById('temple-view');
const sceneStage   = document.getElementById('scene-stage');
const sceneLabel   = document.getElementById('scene-label');
const templeNameVi = document.getElementById('temple-name-vi');
const templeNameCn = document.getElementById('temple-name-cn');
const greetingBtn  = document.getElementById('greeting-card-btn');
const navTempleBtn = document.getElementById('nav-temple');
const navTempleLabel = document.getElementById('nav-temple-label');
const myTemplePrompt = document.getElementById('my-temple-prompt');

// ── Boot ───────────────────────────────────────────────────────────────────
let _rainNode = null;
function startRainSound() {
  if (_rainNode) return;
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const buf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf; src.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass'; filter.frequency.value = 1200; filter.Q.value = 0.5;
    const gain = ctx.createGain(); gain.gain.value = 0.08;
    src.connect(filter); filter.connect(gain); gain.connect(ctx.destination);
    src.start();
    _rainNode = { src, ctx };
  } catch {}
}
function stopRainSound() {
  if (!_rainNode) return;
  try { _rainNode.src.stop(); _rainNode.ctx.close(); } catch {}
  _rainNode = null;
}

async function fetchWeather() {
  try {
    const r = await fetch('/api/weather/hcmc');
    if (!r.ok) return;
    const { raining } = await r.json();
    document.body.dataset.weather = raining ? 'rain' : 'clear';
    _pendingRain = raining;
    if (raining && _audioEnabled) startRainSound();
    else if (!raining) stopRainSound();
  } catch {}
}

async function boot() {
  applyDeviceTier();
  await initFestival();             // sets body[data-festival]
  fetchWeather();                   // sets body[data-weather] — non-blocking
  applyMyTempleHighlight();
  wireMapCards();
  wirePeriodTabs();
  wireViewTabs();
  wireRitualList();
  wireNav();
  wireGreetingCard();
  wireMyTemplePrompt();
  handleDeepLink();                 // Path A: ?temple=dilac
}

// ── Device tier ────────────────────────────────────────────────────────────
function applyDeviceTier() {
  const mem = navigator.deviceMemory;
  const cores = navigator.hardwareConcurrency;
  let tier = 'mid';
  if (mem !== undefined) {
    if (mem <= 1) tier = 'low';
    else if (mem <= 3) tier = 'mid';
    else tier = 'high';
  } else {
    if (cores <= 2) tier = 'low';
    else if (cores <= 4) tier = 'mid';
    else tier = 'high';
  }
  document.body.dataset.tier = tier;
}

// ── Deep-link (Path A) ────────────────────────────────────────────────────
function handleDeepLink() {
  const params = new URLSearchParams(location.search);
  const t = params.get('temple');
  if (t && TEMPLES[t]?.state === 'open') {
    enterTemple(t);
  }
}

// ── Map ────────────────────────────────────────────────────────────────────
function wireMapCards() {
  document.querySelectorAll('.temple-card').forEach(card => {
    const templeId = card.dataset.temple;
    const tState   = card.dataset.state;

    // My-temple home badge
    if (templeId === state.myTemple) card.classList.add('my-temple');

    // Open: tap to enter
    if (tState === 'open') {
      card.addEventListener('click', () => enterTemple(templeId));
    }

    // Coming-soon / teaser: long-press tooltip
    if (tState === 'coming_soon' || tState === 'teaser') {
      let timer;
      card.addEventListener('pointerdown', () => {
        timer = setTimeout(() => card.classList.add('show-tooltip'), 500);
      });
      card.addEventListener('pointerup',   () => { clearTimeout(timer); setTimeout(() => card.classList.remove('show-tooltip'), 1500); });
      card.addEventListener('pointerleave',() => { clearTimeout(timer); card.classList.remove('show-tooltip'); });
    }
  });
}

function applyMyTempleHighlight() {
  document.querySelectorAll('.temple-card').forEach(c => c.classList.remove('my-temple'));
  if (state.myTemple) {
    document.querySelector(`.temple-card[data-temple="${state.myTemple}"]`)
      ?.classList.add('my-temple');
  }
}

// ── Enter temple ───────────────────────────────────────────────────────────
function enterTemple(templeId) {
  state.temple = templeId;
  state.sceneView = 'hall-front';
  resetAll();

  const t = TEMPLES[templeId];
  templeNameVi.textContent = t.nameVi;
  templeNameCn.textContent = t.nameCn;
  navTempleLabel.textContent = t.nameCn;

  templeView.dataset.temple = templeId;
  updateMarkers();
  renderScene();
  showView('temple');
  updateNavActive('temple');
}

// ── Scene rendering ────────────────────────────────────────────────────────
function sceneURL(templeId, view, period) {
  return `/scenes/${templeId}-${view}-${period}${SCENE_EXT}`;
}

function renderScene() {
  const { temple, sceneView, period } = state;
  const t = TEMPLES[temple];

  document.body.dataset.period = period;
  document.body.dataset.view   = sceneView;

  // Show/hide view tabs
  document.getElementById('view-tabs').hidden = !t?.scenes;

  // Sync period tab active state
  document.querySelectorAll('.period-tab').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.period === period);
  });

  // Sync view tab active state
  document.querySelectorAll('.view-tab').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.viewTarget === sceneView);
  });

  // Load scene image
  if (t?.scenes) {
    loadSceneImage(temple, sceneView, period);
  } else {
    removeSceneImage();
  }

  sceneLabel.textContent = `${TEMPLES[temple]?.nameVi ?? ''} · ${periodLabel(period)}`;
}

function loadSceneImage(templeId, view, period) {
  let img = sceneStage.querySelector('img.scene-img');
  if (!img) {
    img = document.createElement('img');
    img.className = 'scene-img';
    img.alt = `${TEMPLES[templeId]?.nameVi} ${view} ${period}`;
    sceneStage.prepend(img);
  }
  img.onload  = () => sceneStage.classList.add('scene-loaded');
  img.onerror = () => { img.remove(); sceneStage.classList.remove('scene-loaded'); };
  sceneStage.classList.remove('scene-loaded');
  img.src = sceneURL(templeId, view, period);
}

function removeSceneImage() {
  sceneStage.querySelector('img.scene-img')?.remove();
  sceneStage.classList.remove('scene-loaded');
}

function periodLabel(p) {
  return { day: 'Ban ngày', dawn: 'Bình minh', dusk: 'Hoàng hôn', night: 'Ban đêm' }[p] ?? p;
}

// ── Period & view tabs ────────────────────────────────────────────────────
function wirePeriodTabs() {
  document.querySelectorAll('.period-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      state.period = btn.dataset.period;
      renderScene();
    });
  });
}

function wireViewTabs() {
  document.querySelectorAll('.view-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      state.sceneView = btn.dataset.viewTarget;
      renderScene();
    });
  });
}

// ── Rituals ────────────────────────────────────────────────────────────────
const RITUAL_PANELS = {
  incense: buildIncensePanel,
  bow:     buildBowPanel,
  sit:     buildSitPanel,
  mo:      buildMoPanel,
  beads:   buildBeadsPanel,
};

function wireRitualList() {
  document.querySelectorAll('.ritual-btn').forEach(btn => {
    btn.addEventListener('click', () => openRitualPanel(btn.dataset.ritual));
  });
}

function updateMarkers() {
  ['incense','bow','sit','mo','beads'].forEach(key => {
    const el = document.getElementById(`marker-${key}`);
    if (el) el.textContent = markerFor(getRitualState(key));
  });
}

function openRitualPanel(ritual) {
  const panel   = document.getElementById('ritual-panel');
  const content = document.getElementById('ritual-panel-content');
  content.innerHTML = '';
  content.appendChild(RITUAL_PANELS[ritual]());
  panel.setAttribute('aria-hidden', 'false');
  document.getElementById('ritual-backdrop').classList.add('visible');
}

function closeRitualPanel() {
  document.getElementById('ritual-panel').setAttribute('aria-hidden', 'true');
  document.getElementById('ritual-backdrop').classList.remove('visible');
  updateMarkers();
  checkMyTemplePrompt();
}

document.getElementById('ritual-backdrop').addEventListener('click', closeRitualPanel);

function buildIncensePanel() {
  const div = document.createElement('div');
  div.innerHTML = `<h3>Thắp hương 上香</h3>
    <div class="progress-bar-wrap"><div id="incense-progress-bar" class="progress-bar"></div></div>
    <p class="ritual-desc">Thắp nhang, cúi đầu thành kính. 点燃香，恭敬鞠躬。</p>
    <button class="ritual-start-btn" id="incense-start">开始上香</button>`;
  div.querySelector('#incense-start').addEventListener('click', (e) => {
    enableAudioOnce();
    e.target.disabled = true;
    runIncense(() => { audio.strike('bell'); closeRitualPanel(); });
  });
  return div;
}

function buildBowPanel() {
  const div = document.createElement('div');
  div.innerHTML = `<h3>Lễ Phật 礼拜</h3>
    <p class="ritual-desc">Ba lần cúi đầu thành tâm. 三次恭敬礼拜。</p>
    <button class="ritual-start-btn" id="bow-done">礼拜完成</button>`;
  div.querySelector('#bow-done').addEventListener('click', () => {
    enableAudioOnce();
    audio.strike('bell');
    completeRitual('bow');
    closeRitualPanel();
  });
  return div;
}

function buildSitPanel() {
  const div = document.createElement('div');
  div.innerHTML = `<h3>Ngồi thiền 静坐</h3>
    <p class="ritual-desc">Chọn thời gian thiền định. 选择静坐时长。</p>
    <div class="sit-options">
      <button class="sit-btn" data-min="1">1 phút</button>
      <button class="sit-btn" data-min="3">3 phút</button>
      <button class="sit-btn" data-min="5">5 phút</button>
    </div>
    <div id="sit-status"></div>`;
  div.querySelectorAll('.sit-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      div.querySelectorAll('.sit-btn').forEach(b => b.disabled = true);
      const min = parseInt(btn.dataset.min, 10);
      div.querySelector('#sit-status').textContent = `静坐中…${min} 分钟`;
      runSit(min, () => { closeRitualPanel(); });
    });
  });
  return div;
}

function buildMoPanel() {
  const div = document.createElement('div');
  div.innerHTML = `<h3>Gõ mõ 敲木鱼</h3>
    <p class="ritual-desc">Nhấn vào mõ để gõ. 点击木鱼敲一下。</p>
    <button class="mo-tap-btn" id="mo-tap">🪘</button>`;
  div.querySelector('#mo-tap').addEventListener('click', () => {
    enableAudioOnce();
    audio.strike('wood');
    if (tapMo()) closeRitualPanel();
  });
  return div;
}

function buildBeadsPanel() {
  const div = document.createElement('div');
  div.innerHTML = `<h3>Lần tràng hạt 念珠</h3>
    <p class="ritual-desc">108 hạt. Nhấn từng hạt. 108 颗，逐颗拨动。</p>
    <button class="bead-tap-btn" id="bead-tap">📿</button>
    <div id="bead-count">0 / 108</div>`;
  div.querySelector('#bead-tap').addEventListener('click', () => {
    enableAudioOnce();
    const { count, milestone } = tapBead();
    audio.strike('wood', 0.6);
    div.querySelector('#bead-count').textContent = `${count} / 108`;
    if (milestone) closeRitualPanel();
  });
  return div;
}

// ── My-temple prompt ───────────────────────────────────────────────────────
let _myTemplePromptShown = false;

function checkMyTemplePrompt() {
  if (_myTemplePromptShown || state.myTemple || !state.temple) return;
  const anyDone = ['incense','bow','sit','mo','beads'].some(k => getRitualState(k) === RITUAL_STATES.DONE);
  if (!anyDone) return;
  _myTemplePromptShown = true;
  setTimeout(() => {
    myTemplePrompt.setAttribute('aria-hidden', 'false');
  }, 400);
}

function wireMyTemplePrompt() {
  document.getElementById('my-temple-yes').addEventListener('click', () => {
    state.myTemple = state.temple;
    saveMyTemple(state.temple);
    applyMyTempleHighlight();
    myTemplePrompt.setAttribute('aria-hidden', 'true');
  });
  document.getElementById('my-temple-skip').addEventListener('click', () => {
    myTemplePrompt.setAttribute('aria-hidden', 'true');
  });
}

// ── Navigation ─────────────────────────────────────────────────────────────
function wireNav() {
  document.getElementById('nav-map').addEventListener('click', () => {
    showView('map'); updateNavActive('map');
  });
  document.getElementById('nav-temple').addEventListener('click', () => {
    if (state.temple) { showView('temple'); updateNavActive('temple'); }
  });
  document.getElementById('back-btn').addEventListener('click', () => {
    showView('map'); updateNavActive('map');
  });
}

function showView(v) {
  state.view = v;
  mapView.classList.toggle('hidden', v !== 'map');
  templeView.classList.toggle('active', v === 'temple');
  if (v === 'temple') renderScene();
}

function updateNavActive(active) {
  document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
  document.getElementById(`nav-${active}`)?.classList.add('active');
}

// ── Greeting card ──────────────────────────────────────────────────────────
function wireGreetingCard() {
  greetingBtn.addEventListener('click', openCardPanel);
  document.getElementById('card-backdrop').addEventListener('click', closeCardPanel);
  document.getElementById('card-close-btn').addEventListener('click', closeCardPanel);

  const flowerSel = document.getElementById('flower-selector');
  getFlowers().forEach(f => {
    const btn = document.createElement('button');
    btn.className = 'flower-btn';
    btn.dataset.flower = f.key;
    btn.textContent = `${f.emoji} ${f.label}`;
    btn.addEventListener('click', () => {
      document.querySelectorAll('.flower-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      refreshCardPreview();
    });
    flowerSel.appendChild(btn);
  });
  flowerSel.querySelector('.flower-btn')?.classList.add('active');

  const greetPicker = document.getElementById('greeting-picker');
  getGreetings().forEach(g => {
    const btn = document.createElement('button');
    btn.className = 'greeting-btn';
    btn.dataset.greetingKey = g.key;
    btn.textContent = g.cn.split('\n')[0];
    btn.addEventListener('click', () => {
      document.querySelectorAll('.greeting-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      refreshCardPreview();
    });
    greetPicker.appendChild(btn);
  });
  greetPicker.querySelector('.greeting-btn')?.classList.add('active');

  const textarea = document.getElementById('card-custom-text');
  const charCount = document.getElementById('char-count');
  textarea.addEventListener('input', () => {
    charCount.textContent = `${textarea.value.length} / 60`;
    refreshCardPreview();
  });

  document.getElementById('card-share-btn').addEventListener('click', async () => {
    const canvas = document.getElementById('card-preview-canvas');
    await shareCard(canvas, state.temple);
  });

  document.getElementById('card-download-btn').addEventListener('click', () => {
    const canvas = document.getElementById('card-preview-canvas');
    shareCard(canvas, state.temple); // triggers download fallback
  });
}

function openCardPanel() {
  document.getElementById('card-panel').setAttribute('aria-hidden', 'false');
  document.getElementById('card-backdrop').classList.add('visible');
  refreshCardPreview();
}

function closeCardPanel() {
  document.getElementById('card-panel').setAttribute('aria-hidden', 'true');
  document.getElementById('card-backdrop').classList.remove('visible');
}

function refreshCardPreview() {
  const flower      = document.querySelector('.flower-btn.active')?.dataset.flower ?? 'hoa-mai';
  const greetingKey = document.querySelector('.greeting-btn.active')?.dataset.greetingKey ?? 'a';
  const customText  = document.getElementById('card-custom-text').value;
  const canvas = buildCard({ flower, greetingKey, customText, temple: state.temple, period: state.period });
  const preview = document.getElementById('card-preview-canvas');
  preview.width  = canvas.width;
  preview.height = canvas.height;
  preview.getContext('2d').drawImage(canvas, 0, 0);
}

// ── Persistence ────────────────────────────────────────────────────────────
function loadMyTemple() {
  try { return localStorage.getItem('chuamay_my_temple') ?? null; } catch { return null; }
}

function saveMyTemple(id) {
  try { localStorage.setItem('chuamay_my_temple', id); } catch {}
}

// ── Go ─────────────────────────────────────────────────────────────────────
boot();
