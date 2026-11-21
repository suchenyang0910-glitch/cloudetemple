# Town shell — A-20261120-02, supplements 2/3

This first integration step adds an optional exterior town and one door to the existing `home` screen. It does not add API writes, interiors, multiplayer, memorial records or demo visitors. Other places remain exterior landmarks. The avatar represents the current visitor, not another online user.

## Provenance and scope

- Integration base: `0115ca2069bc6ff45458338b0d698eca3dee8743` (`codex/staging-integration`).
- Approved source: v41 `template.html`, after `uipatch-v41.py`, `uipatch-v41b.py`, `uipatch-v41c.py`, SHA256 `47237E9C3F4A6C4252380263035CDA4D1EE5B0969EF3C5E752662A101412079A`.
- `town-scene.js` extracts exterior geometry, avatar, navigation, map and camera from that source. Procedural random-stream positions are preserved when interior construction is omitted. Ritual handlers, demo people/switch/data, memorial records and all additional door buttons are omitted.
- `town-three.js` is the unchanged, already vendored Three.js 0.187 bundle from `prototype-3d/vendor/three.bundle.min.js`; its MIT license accompanies it. All modules are versioned at the package root and served from the same origin. No CDN or server CSP/Nginx changes.
- v42, individual ritual doors, program-driven time periods, audio integration and automatic low-FPS policy remain outside this first step. The four time buttons change only local visuals. Existing ritual screens remain in the existing application.

## Build and navigation

`powershell -NoProfile -ExecutionPolicy Bypass -File tools/package.ps1 -Environment production` builds with the entry **off**. Add `-EnableTown` only for an explicitly enabled candidate. A flag change requires rebuilding/replacing the static package; it is not a remote runtime toggle. These commands only build locally.

The home entry opens `/town.html` on user action. The Chùa Mây door saves finite, bounded position/camera coordinates in tab-scoped session storage and opens `/?town=home`; returning from home restores the door position. There is also an always-visible manual link to home. Opening the town URL with the flag off redirects home without fetching Three or the scene.

Scene/module loading failure, a 20-second loading timeout, WebGL initialization failure or context loss redirects to existing home. Failure blocks town entry for that tab session and never automatically retries. No user/account records are written. Malformed saved coordinates are ignored.

## Author checks and independent acceptance

Run `node tests/town-shell.cjs <existing-playwright-installation-path>`. The test builds both flag states, serves `dist` on loopback with the repository's H5 CSP, maps the H5 hostname only inside its Chromium process, intercepts API calls with synthetic disabled responses, and blocks other remote traffic. It checks desktop/390×844 walking, three planned routes, main-door roundtrip and exact position restoration, existing sit/mo/bow navigation, four periods, manual exit, malformed session data, missing scene/Three, unavailable WebGL and context loss.

Results/screenshots go to ignored `_archive/town-shell-evidence/`. `town-first-frame` is navigation-to-first-synchronous-render in local headless Chromium, not a device FPS or production performance claim. Three route plans are not evidence of three complete walked routes. Package checks also verify the flag, versioned imports, local Three hash/license and excluded demo/data code.

The original production package at the integration base was 294 files / 24,019,336 uncompressed bytes. Compare the candidate manifest against that baseline. Source review, D's real-GPU/device acceptance, Vietnamese native review, CI, merge, staging and production remain separate gates. This branch does not authorize any deployment.
