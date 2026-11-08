# Cloud Temple / Chùa Mây

The `feat/telegram-staging` branch adds the systemd/better-sqlite3 API and Telegram integration. See [operations manual](运维手册.md). Staging HTTPS, real bot credentials and offsite backup credentials must be configured before activation; production requires user approval.

Vietnam-first quiet temple website. Native HTML/CSS/JS; approved raster assets only. No login or social presence.

## Preview and test

```powershell
node tools/serve.mjs
node --test tests/waitlist.test.mjs tests/store.test.mjs tests/vps-server.test.mjs
powershell -ExecutionPolicy Bypass -File tools/package.ps1
```

Preview: http://127.0.0.1:8788 (ephemeral test storage). Run packaging before the VPS HTTP test on a fresh checkout. Node 22.22.1+ required for the VPS SQLite adapter.

`tests/browser-check.js` and `tests/review-check.js` run through the Playwright browser tool. Screenshots are in `screenshots/`.

## Deployment

Current VPS preview and operational evidence: [VPS deployment record](deploy/VPS部署记录.md). The initial preview is HTTP; configure a domain and HTTPS before real email collection.

After every approved production release, merge that exact release branch back into `codex/staging-integration` and push it before starting new staging work. Verify with `git merge-base --is-ancestor <release-branch> codex/staging-integration`; do not force-push either branch.

- Cloudflare Pages: `functions/api/waitlist.js`, WAITLIST KV binding and WAITLIST_SECRET. See [deployment guide](部署说明.md).
- VPS: `deploy/server.mjs` uses the same handler with a separate SQLite KV adapter. It serves only packaged public files, stores consent for 90 days, and purges expired records at startup and every minute. No raw IP persistence or request logs.
- `deploy/compose.yml` publishes only 127.0.0.1:8789. Caddy must overwrite `X-CloudTemple-Client-IP` with `{remote_host}`. Do not expose this backend port publicly or trust user-supplied forwarded IP headers.
- Runtime secrets and SQLite data live outside releases in `/opt/cloudtemple/shared/`, never in Git. `PUBLIC_ORIGIN` must exactly match the public origin. Bind mounted data must be owned by container UID 1000.

The repository includes the approved 12 Vietnam scenes and 30 character poses. Source-generation experiments, obsolete SVG art, other projects, credentials and collected registrations are not release inputs.
