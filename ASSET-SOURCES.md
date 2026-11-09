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

**Selected for this candidate**: keep the existing reviewed CC0 bell; no new
audio asset or licence review is required.

## Festival layer decorations (I2 · Tết 2027)

**Status**: Logic and reviewed visual layer implemented.

The eight files under `assets/festival/` are original in-repository SVG illustrations: lantern, hoa mai, hoa đào, moon, two petals and two flower pots. They were drawn for Chùa Mây and do not incorporate external images, fonts or third-party artwork. The New Year rising-lantern effect uses original inline geometry.

## L1 sitting visitors without cushions

**Files**: `assets/processed-v1/img/visitor-{short-light,curly-dark,curly-medium,bun-light,bun-dark,ponytail-medium}-sit-nocushion.webp`

**Source**: Existing original Cloud Temple visitor artwork in this repository.

**Process**: Locally removed the remaining cushion-edge fragments and isolated
alpha specks; no third-party artwork or external background-removal service was
used. The six v2 files were reviewed on dark, cushion-tone, and white
backgrounds and approved by the user on 2026-11-09.

## L1 visitors facing the Buddha while counting beads

**Files**: `assets/processed-v1/img/visitor-{short-light,curly-dark,curly-medium,bun-light,bun-dark,ponytail-medium}-beads-side-{1,2,3}-v1.webp`

**Source**: Existing original Cloud Temple visitor artwork and the approved
L1 side-facing bead-frame generation/compositing work in this repository.

**Process**: Each visitor uses frame 1 as the fixed body base. Frames 2 and 3
replace only the hand-and-bead mask, so every pixel outside that mask is
identical. The three frames share a 600 x 600 canvas and the woodfish placement
anchor; head, ground line, and body alignment were checked against the matching
`mo-1-v1` frame. The v3 alignment sheets and metrics were reviewed and approved
by the user on 2026-11-09. No third-party artwork was introduced.
