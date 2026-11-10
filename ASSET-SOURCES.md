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

## L2 incense ritual visitors, scene variants, and ignition sound

**Files**: `assets/processed-v1/img/visitor-*-inc-*-v1.webp`,
`assets/processed-v1/img/scene-vn-hall-side-incense-patch-*.webp`, and
`assets/audio/ignite-v1.{mp3,m4a}`.

**Source**: The 48 visitor frames are the user-approved L2 review frames. The
four incense-only hall variants were edited from the project's original
hall-side scenes with OpenAI ImageGen: remove the baked incense/smoke and the
unused cushion, preserve the altar, Buddha, lighting, and composition. The
altar support color was separately matched to the adjacent warm wood after the
user identified the gray-blue mismatch. No third-party artwork was introduced.

**Ignition sound**: Generated locally from filtered brown noise with FFmpeg
(`anoisesrc`, 0.38 seconds); original project output with no third-party sample.

## Four-fix wooden-fish and cushion-free hall artwork

**Files**: `visitor-*-mo-{1,2,3}-v3.webp`, `mo-low-table-v2.webp`, `mo-v6.webp`,
`hall-cushion-v2.webp`, and `scene-vn-hall-side-floor-*.webp` (full and mobile).

**Source and process**: Original Chùa Mây visitor, wooden-fish, cushion, and
hall-side artwork. OpenAI ImageGen was used in edit mode to remove the baked
mallet/instrument from the six kneeling visitors and to remove the unused hall
cushion while preserving identity, pose, composition, and time-of-day light.
The low table, wooden fish, and red pad are the user-approved v5 review assets.
After iPhone testing exposed drift between the hand and the separate mallet
layer, the existing original mallet was composited behind each closed gripping
hand at the approved impact point. Frames 1 and 3 are identical contact frames;
frame 2 rotates the same mallet ten degrees about the grip for a small lift.
This deterministic local edit is recorded in `tools/build_mo_mallet_frames.py`;
no new generated or third-party artwork was introduced. The original ImageGen
prompts required a transparent isolated adult visitor, unchanged identity,
clothing and pose, and a closed gripping hand; scene prompts removed only the
cushion while preserving altar, Buddha, lighting, and perspective details.
