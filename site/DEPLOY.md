# Chùa Mây official-site deployment

Build the production output from the repository root:

```powershell
node site/build.mjs
node site/check.mjs
```

Publish `site/dist/` as the document root. It is generated output and is intentionally ignored by Git.

## Nginx checklist

- Serve the site as static files and use `try_files $uri $uri/ =404;` so trailing-slash page directories resolve to their `index.html` files.
- Cache HTML briefly (`Cache-Control: public, max-age=300` is a suitable starting point) and cache `/assets/` for a long, immutable period after verifying asset filenames are versioned or deployment invalidation is in place.
- Set security headers appropriate for a static site, including `X-Content-Type-Options: nosniff`, a restrictive `Referrer-Policy`, and `frame-ancestors 'self'` in CSP unless embedding is explicitly approved.
- CSP must allow Cloudflare Web Analytics: `script-src 'self' https://static.cloudflareinsights.com` and `connect-src 'self' https://cloudflareinsights.com` (plus any pre-existing required directives). Do not add unrelated third-party analytics or advertising origins.
- Do not set `X-Robots-Tag: noindex` on the production vhost. Generated production pages are indexable; only the `/site-preview/` build uses page-level `noindex`.
- Redirect `www.chuamay.org` permanently to `https://chuamay.org$request_uri`, then serve the canonical root domain over HTTPS.

Example shape only; adjust certificate paths, log paths, and existing shared headers to the approved server configuration:

```nginx
server {
    listen 443 ssl http2;
    server_name chuamay.org;
    root /srv/chuamay/site/dist;
    index index.html;

    location / {
        try_files $uri $uri/ =404;
        add_header Cache-Control "public, max-age=300";
    }

    location /assets/ {
        try_files $uri =404;
        add_header Cache-Control "public, max-age=31536000, immutable";
    }

    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Content-Security-Policy "default-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self' https://static.cloudflareinsights.com; connect-src 'self' https://cloudflareinsights.com; base-uri 'self'; frame-ancestors 'self'" always;
}

server {
    listen 443 ssl http2;
    server_name www.chuamay.org;
    return 301 https://chuamay.org$request_uri;
}
```
