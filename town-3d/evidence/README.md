# town-3d P0 evidence

Branch `ccgs/town-3d`. Scope: P0 only (no P1/P2). Not committed.

## Change list (all new files under `town-3d/`)

| File | Purpose |
|---|---|
| `logic.js` | Pure logic: 7 temple IDs/positions/status, 1.5 m trigger, activity URLs, walk bounds/blockers, side-hall layout, facing-Buddha yaw |
| `scene.js` | Three.js town: ground, paths, 7 temples, Buddha S0 silhouette (no face/hands/attributes), labels, fixed-angle camera light rig |
| `character.js` | Visitor billboard, adapted from `prototype-3d/character.js`; uses the existing 2D visitor frames |
| `app.js` | Click-to-walk, press/drag continuous walk (plus WASD/arrows), proximity panel, 2D fallback; no free camera (fixed offset, no wheel/pinch/orbit) |
| `index.html`, `styles.css` | Mobile UI; "Bản 2D" link always visible; fallback screen |
| `tools/serve.mjs` | Static server rooted at repo root (needs `../index.html`, `../prototype-3d/*`) |
| `tests/town.test.mjs`, `package.json` | Self-check (`node:test`, no dependencies) |

Reuse: three.js vendor files and visitor frames are loaded from `../prototype-3d/vendor` and `../prototype-3d/assets/visitor` (not duplicated; no new dependencies).

Behaviour:
- IDs: `chuamay, dilac, quanam, lienchi, diatang, duocsu, namtong`. Positions follow `temple-town/v2.1-taskC-artwork-briefs.md` C1 (S / centre / E / W / N / NE / SW).
- `chuamay`, `dilac`: solid temple, proximity (<= 1.5 m of door point) shows "Vào chùa" -> `../index.html?temple=<id>`.
- Other five: warm translucent (~28%) faceless silhouette, label "Sắp mở cửa", no link, no countdown, no payment.
- Standing in a trigger zone, the visitor turns to face the Buddha. Open temples lay out Buddha -> altar -> mallet table -> person along one axis; mallet table is ahead of the person, beads on the person's right.
- Only the single player visitor exists. No fake visitors.
- 2D preserved: `../index.html` untouched; fallback when WebGL fails or `?mode=2d`.

## Run

```
node town-3d/tools/serve.mjs        # from repo root; then open http://127.0.0.1:4180/town-3d/
```

## Test

```
cd town-3d && npm test             # = node --test tests/
```

Result: **PASS (7/7)** — independently run from the worktree with `node --test town-3d/tests/town.test.mjs`.

## Not verified / known gaps

| Item | Status |
|---|---|
| Self-check test result | PASS (7/7) |
| Static server smoke check | PASS — `/town-3d/` and `/town-3d/logic.js` returned HTTP 200 on `127.0.0.1:4180` |
| Browser load / visual check of the 3D scene | NOT_RUN (code never executed in a browser; may contain runtime errors) |
| FPS | NOT_RUN |
| 393x659 recording | NOT_RUN |
| First-load size | NOT_RUN |
| Root `index.html` / `app.js` handling of `?temple=xxx` | Not present in this branch (grep found no `temple` in root `app.js`). The links target the URL as specified; the activity engine must read the param separately. |
| Side-hall activity scene with Buddha/altar/person/mallet/beads inside the 2D engine | Only the 3D porch layout is implemented here; the in-engine scene belongs to the activity engine. |
