# Town shell — A-20261120-02, supplements 2–5

This integration candidate adds an optional exterior town and one door to the existing `home` screen. It does not add API writes, interiors, multiplayer, memorial records or demo visitors. Other places remain exterior landmarks. The avatar represents the current visitor, not another online user.

## Provenance and scope

- Integration base: `0115ca2069bc6ff45458338b0d698eca3dee8743` (`codex/staging-integration`).
- Second-step base: D-accepted shell `9c64f338ee4e19409f092dd68b7777fc2691a1a3`.
- Approved source: `ops/design-sync/3d-sample/src-v42/test.html`, SHA256 `F0D7CF9D43AA9CA202D8460D1C997D8FBA9B14BE7F95A99C8E3902694633892B`. Exterior changes include forced pavilion-post collisions, the fixed map header and narrower door-label positioning. The three pet-garden modules, wooden cottages (including their collision/map data), demo controls and additional doors are excluded. The prior shell still contained cottage geometry; it is removed in this step.
- `town-scene.js` extracts exterior geometry, avatar, navigation, map and camera from that source. Procedural random-stream positions are preserved when interior construction is omitted. Ritual handlers, demo people/switch/data, memorial records and all additional door buttons are omitted.
- `town-three.js` is the unchanged, already vendored Three.js 0.187 bundle from `prototype-3d/vendor/three.bundle.min.js`; its MIT license accompanies it. All modules are versioned at the package root and served from the same origin. No CDN or server CSP/Nginx changes.
- Existing ritual screens remain in the application; only the Chùa Mây main-hall door is connected. No new data writes or dependencies.

## Build and navigation

`powershell -NoProfile -ExecutionPolicy Bypass -File tools/package.ps1 -Environment production` builds with the entry **off**. Add `-EnableTown` only for an explicitly enabled candidate. A flag change requires rebuilding/replacing the static package; it is not a remote runtime toggle. These commands only build locally.

The home entry opens `/town.html` on user action. The Chùa Mây door saves finite, bounded position/camera coordinates in tab-scoped session storage and opens `/?town=home`; returning from home restores the door position. There is also an always-visible manual link to home. Opening the town URL with the flag off redirects home without fetching Three or the scene.

Scene/module loading failure, a 20-second loading timeout, WebGL initialization failure or context loss redirects to existing home. Failure blocks town entry for that tab session and never automatically retries. No user/account records are written. Malformed saved coordinates are ignored.

## Time, sound and performance

`period.js` is shared by the existing app's `periodNow()` and the town. Both use UTC+7, independent of device timezone. Existing boundaries are retained: dawn 05:00–07:59, day 08:00–16:59, dusk 17:00–18:59, night 19:00–04:59. Town updates on the next rendered frame and has no time-selection buttons. The existing layout ranges are checked against the shared defaults.

Town sound uses `createTempleAudio` from unchanged `audio.js`, the existing `ct-volume` preference and recorded `ambient-courtyard` asset. Each visit starts silent; the sound button supplies the browser-required enable gesture. Hide stops ambient playback, show resumes an enabled session, mute/page exit stop it, and audio failure leaves the scene usable. No new audio engine, recordings or autoplay bypass.

`town-performance.js` measures real RAF intervals in consecutive approximately one-second windows. Below 20 FPS for at least five consecutive seconds reveals a Vietnamese status prompt; one healthy window or hiding the page resets the accumulated duration. One prompt per visit. The user can keep exploring or press its return button, which uses the existing failure fallback and blocks town re-entry for the tab session. The displayed diagnostic FPS also uses unclamped elapsed time. This is a software detector, not a device-performance certification.

## Author checks and independent acceptance

Run `node tests/town-runtime.mjs` for UTC+7 boundary/layout tests across four device timezones and slow-frame recovery, jitter, threshold and hidden-gap tests.

Run `node tests/town-shell.cjs <existing-playwright-installation-path>`. The test builds both flag states, serves `dist` on loopback with the repository's H5 CSP, maps the H5 hostname only inside its Chromium process, intercepts API calls with synthetic disabled responses, and blocks other remote traffic. It checks desktop/390×844 walking, three planned routes, main-door roundtrip and exact position restoration, all five existing activity screens, automatic four-period transitions on a Los Angeles device clock, 44px single-line return, persistent map close control, pavilion collisions, gesture-only recorded audio with mute/visibility and failure handling, injected low-FPS return, manual exit, malformed session data, missing scene/Three, unavailable WebGL and context loss.

Results/screenshots go to ignored `_archive/town-shell-evidence/`. `town-first-frame` is navigation-to-first-synchronous-render in local headless Chromium, not a device FPS or production performance claim. Three route plans are not evidence of three complete walked routes. Package checks also verify the flag, versioned imports, local Three hash/license and excluded demo/data code.

The original production package at the integration base was 294 files / 24,019,336 uncompressed bytes. Compare the candidate manifest against that baseline. Source review, D's real-GPU/device acceptance, Vietnamese native review, CI, merge, staging and production remain separate gates. This branch does not authorize any deployment.
