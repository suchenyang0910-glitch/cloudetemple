# Chùa Mây 3D prototype design context

## Subject and job

An internal, mobile-first technical prototype for a Vietnamese online temple. Its single job is to test whether a continuous 3D courtyard and hall can still feel like the existing quiet ink-and-watercolour product.

## Visual system

- **Rice paper** `#e9e2d4`: atmospheric base and interface glass.
- **Mist** `#cbd0c6`: distance, fog and quiet transitions.
- **Old timber** `#604b38`: hall structure and primary interface controls.
- **Ink** `#2f302c`: outlines, silhouette and text.
- **Incense ember** `#bb7044`: the only warm accent.
- **Moss** `#66705c`: trees and low landscape.

Type uses the device sans stack so the prototype adds no font payload. Vietnamese text stays short and functional.

## Layout and signature

The canvas owns the whole viewport. A small rice-paper title plaque sits above the scene; context actions sit above the safe-area inset. The memorable element is the scene itself changing between two renderings of the same geometry:

1. **Lụa mờ** — low-contrast outlines, pale wash and dense warm mist.
2. **Mực nét** — stronger irregular ink edges, drier paper grain and cooler shadows.

The comparison controls are quiet utility controls, not a dashboard. No gradients, neon, game HUD, score, leaderboard or decorative icons.

## Interaction contract

- Tap walkable ground to move; drag and hold to steer and keep walking.
- Keyboard arrows/WASD mirror movement. `C` sits or stands; `P` joins palms; `B` bows.
- Pinch changes camera distance. All drag operations have button/keyboard alternatives.
- Nearby actions use real buttons with visible focus.
- Reduced-motion disables camera push, ambient sway and long interpolation.
- Simulated visitors are enabled only by `?locals=1` for internal performance checks.

## Runtime mapping

Normative colors are CSS custom properties in `styles.css` and matching style presets in `scene.js`. All scene objects derive from those presets; there is no second theme store.
