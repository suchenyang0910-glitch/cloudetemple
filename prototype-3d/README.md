# Chùa Mây 3D walk technical prototype

This isolated prototype uses self-hosted `three.js 0.187.0`. The hall, courtyard, props, visitor, five poses and two simulated visitors are original procedural geometry. It contains no downloaded 3D model, motion file, image texture, external font, CDN or AI-generated 3D asset.

## Run locally

```powershell
cd E:\cloudtemple-worktrees\three-walk-prototype\prototype-3d
npm install
npm run vendor
npm test
npm run budget
npm run serve
```

Open `http://127.0.0.1:4173/`. Add `?style=ink` for the stronger ink treatment and `?locals=1` to show two local simulated visitors during internal performance testing.

## Controls

- Mobile: tap walkable ground; hold and drag horizontally to steer and keep walking; pinch to zoom.
- Desktop: arrow keys or WASD; `C` sit/stand; `P` palms together; `B` bow; mouse wheel zoom.
- Near the burner, cushion or Buddha placeholder, use the context buttons.

## Scope boundary

This folder is not wired into the existing H5, Mini App, staging build or server deployment. The simplified Buddha silhouette is a non-interactive placeholder pending image-guideline review. Simulated visitors are off unless the internal query parameter is present.
