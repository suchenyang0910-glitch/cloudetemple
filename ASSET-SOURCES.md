# Asset Sources — CCGS additions

Supplements `assets/audio/LICENSES.md` with CCGS-introduced asset decisions.

## Morning sequence bell (I1 · 早课 buổi sáng)

**Decision**: Reuse existing `assets/audio/bell-v2.mp3` / `bell-v2.m4a` for the
morning sequence opening bell. No new audio file created.

**Reason**: The temple bell (tec_studio, Freesound 668647, CC0 1.0) is already
licensed CC0 and already serves as the activity-completion bell throughout the
app. Using the same sound in the morning-sequence entry screen is consistent
with the established audio palette and avoids introducing a new asset whose
provenance would need separate review.

**Pending**: CGS-07 (Audio Director) to review whether a distinct morning bell
timbre is needed. If yes, a new CC0/CC-BY source will be sourced from Freesound
and added here before staging deployment.

## Festival layer decorations (I2 · Tết 2027)

**Status**: Logic layer implemented; visual asset integration pending CGS-06 (Art Director) sign-off.

The CSS framework uses `body[data-festival]` and `body[data-flower]`; the New Year effect reuses inline original geometry. Planned artwork targets are `assets/festival/lantern-red.svg`, `flower-mai.svg`, `flower-dao.svg`, and `moon-ram.svg`.

All new SVG/PNG festival decoration assets must be:
- Original (drawn in-house) OR
- CC0 / CC-BY sourced, with source URL and author recorded in this file

**New Year bell**: Reuses the existing CC0 `assets/audio/bell-v2` recording. No new third-party audio is introduced.
