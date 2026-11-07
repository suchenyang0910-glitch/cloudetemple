# Asset Sources — CCGS additions

Supplements `assets/audio/LICENSES.md` with CCGS-introduced asset decisions.

## Festival layer decorations (I2 · Tết 2027)

**Status**: Logic layer implemented; visual asset integration pending CGS-06 (Art Director) sign-off.

The CSS framework in `styles.css` uses `body[data-festival]` and `body[data-flower]` to scope
decorations. `#effects` SVG receives JS-created lantern elements on New Year (`launchLanterns()`).

**Assets needed (paths are placeholder targets)**:
| Asset | Path | Required for |
|---|---|---|
| Red lantern SVG | `assets/festival/lantern-red.svg` | 除夕–元宵 decoration layer |
| Hoa mai (yellow plum) SVG | `assets/festival/flower-mai.svg` | 除夕–初三, default flower |
| Hoa đào (peach blossom) SVG | `assets/festival/flower-dao.svg` | 除夕–初三, alternate flower |
| Rằm moon decoration SVG | `assets/festival/moon-ram.svg` | 元宵 |

**All festival assets must be**:
- Original (drawn in-house to match existing water-ink style) OR
- CC0 / CC-BY sourced, with source URL and author recorded in this file

**New Year bell audio (跨年钟声)**: Reuses existing `assets/audio/bell-v2.mp3` (CC0).
Bell rings 1× per minute 23:55–23:59, then 12× at 00:00. CGS-07 (Audio Director) to
confirm whether a distinct "12-bell midnight" audio file is needed.

This section will be updated when CGS-06 delivers asset specs and files.
