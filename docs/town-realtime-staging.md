# A-20261121-02 b — staging candidate, not a deployment approval

Base: `codex/staging-integration @ 0115ca2069bc6ff45458338b0d698eca3dee8743`.
This branch does not include the separately delivered town-shell branch, and does not implement step c's scene transport. No default users, remote load test, server changes or production migration are included.

## Process, gate and storage

`server/town-process.mjs` is a separate loopback HTTP/WebSocket process (default 8793). Existing API code only issues tickets, saves names and handles moderation. The realtime process does not import/start the API. The proposed `deploy/chuamay-town-staging.service` has no `Requires`/`PartOf` relationship with the API: `MemoryMax=300000000`, no swap, V8 heap 160 MiB, CPU quota 50%, file descriptors 512. No service was installed or started on a shared host. Cgroup limits still need Linux/staging verification.

API opt-in: `TOWN_REALTIME_ENABLED=1`, existing `CHUAMAY_ENV=staging` and an explicit DB path containing `/staging/`. Bad candidate configuration or absent migration disables the candidate rather than failing the API. The realtime entry point independently refuses production, missing opt-in or a non-staging DB path. Both use existing SQLite; realtime DB busy timeout is 100 ms. Shared database/disk contention remains a staging acceptance item even though process death is isolated.

The migration is explicit, never automatic: `CHUAMAY_ENV=staging node server/town-migrate.mjs --staging-only <existing-staging-db-path>`. It requires the existing users table and adds `users.town_name`, name metadata/history/reports/reviews/audit (schema v2 adds a filtered fallback name), short tickets and expiring report-target mappings. Local tests used synthetic SQLite only. Before any later staging application, A must back up the DB and verify the copy. Rollback means disable candidate processes/routes and restore a verified staging backup if schema rollback is required; no destructive down-migration is provided.

**No production schema change is authorized or performed.** Formal production migration, rehearsal on a production copy, deployment, and inclusion of draft data in a production release require separate approval. Draft code/data must stay out of any production release selection. Static packaging explicitly excludes the name page/admin module from production.

## HTTP API (existing API process)

All public actions are under `/api/pet-garden/town/` so the existing pet session cookie reaches them without widening its Path. Existing root family session also works; signed Telegram initData maps only to an already existing shared identity. No login, whitelist, cookie or identity-merge implementation was changed.

- `GET csrf`: same-origin / allowed Origin; returns a town-scoped token derived from the existing session, without rotating the family's CSRF or cookies.
- `POST profile`: creates the initial name if absent; returns stored name, preferred suggestion plus six alternatives, lock expiry and draft review marker.
- `POST choices`: another preferred suggestion plus six alternatives.
- `POST name`: `{name}` for free text or `{candidateId}` for a server-owned pool choice.
- `POST ticket`: opaque random one-use token, expires in 30 seconds, bound to Origin and server-side subject; newest ticket replaces that subject's unused ticket. At most 400 outstanding tickets.
- `POST report`: `{actor}` from the current room. Requires reporter and target to be live in the same room; rejects self-report and stale name revisions.

POST requires allowed Origin, JSON <=2 KiB and rate limits. Cookie accounts also require CSRF; Telegram signed authorization does not create a new account. Guest storage is a separate signed HttpOnly/Secure/SameSite=Strict `ct_town_name` cookie at this prefix, with a one-year lifetime. It contains a random local ID and name; server metadata protects moderation and rate limits from cookie rollback. On login, an empty account imports the signed cookie's **current server name**; an existing account name wins. Guest cookies are not an assertion of unique human identity: deleting cookies permits a new anonymous identity. No fingerprinting is introduced; this limits anonymous report abuse resistance.

## Version 1 wire contract and scene configuration

Authority: `ops/design-sync/multiplayer/多人同场-契约.md` and dispatch supplements 1–5. No online-document lookup is required. This step implements the server only; step c owns client transport, always-visible equal-sized names and local optional sound playback.

Startup reads `TOWN_SEATS_PATH` (default `ops/design-sync/multiplayer/seats.v1.json`). Its version-1 schema contains four scenes, bounds, speed, spawns and seats. Missing or invalid configuration prevents realtime startup; no coordinates are embedded in the core. C's v43 authoritative seats are still required before integration. Local `server/town-seats.TEST.json` has `test:true` and synthetic seats; using it requires explicit `TOWN_ALLOW_TEST_SEATS=1`. The service candidate does not enable TEST data.

| Scene | Initial cap | x bounds | z bounds | Speed m/s |
|---|---:|---|---|---:|
| town | 20 | -91 … 92.5 | -73.5 … 71.5 | 6.2 |
| chuamay | 16 | -13 … 13 | -9.5 … 16 | 3.1 |
| suoi | 8 | -9.5 … 9.5 | -2 … 15.5 | 3.1 |
| lientri | 12 | -10.5 … 10.5 | -4 … 15.5 | 3.1 |

Per the 2026-11-21 13:40 contract correction, capacity is the explicit integer cap (1–20), never derived from exclusive seats. Every scene needs at least cap configured positions of all kinds combined, with unique IDs; violations identify the scene and rule. Thus lientri cap=12 with eight sit and four lamp positions is valid, as is chuamay cap=16 with 24 positions. The same rules apply to town, including configured sit/bow/mo positions. Incense/lamp/stand points are non-exclusive. Spawn is randomly selected from the configured points. Rooms prefer the most occupied non-full line; an optional existing room ID hint allows later companion routing. No invitation feature is included in phase 1.

WebSocket URL is `/town-ws`, with no ticket/query string. Browser Origin is checked. First frame within 5 seconds:

```json
{"v":1,"seq":1,"type":"enter","scene":"chuamay","ticket":"opaque token from API"}
```

Client sequence increases by exactly one; invalid version/type/extra fields, binary frames and oversized messages fail closed. Payload limit 2 KiB, buffered output 32 KiB, compression disabled. Raw and unauthenticated connections count toward 200. One account has one connection: a newly authenticated connection evicts the old one, even if the old connection already left its scene.

| Client type | Additional fields | Server behavior |
|---|---|---|
| enter | scene, optional room; ticket on first frame only | full snapshot; broadcast join; rotate ephemeral actor ID |
| leave | none | immediate release and gone |
| move | from:[x,z], target:[x,z], at:milliseconds | at most 2/s; finite outer bounds and plausible starting position; consecutive target distance / server elapsed time <= configured speed × 1.5; server determines departure time and duration |
| state | value:walk/stand/sit/bow/mo/incense/lamp; seconds:1–3600 or null for exclusive seat | sit/bow/mo requires owned matching-kind reservation and arrival within 0.8m; non-exclusive states release any seat |
| claim | seat | once per 2s; five rejected claims within 1min cause 30s cooldown; busy returns nearest free exclusive seat ID |
| release | seat (optional, must match if supplied) | immediate stand/release |
| ping | optional background:boolean, continueSeat:boolean | every 20s; server time/period; explicit continue after the 30min prompt renews indefinite seating |

Every server message has v/seq; room broadcasts also have room/roomSeq. Server types: snapshot, move, state, claim-result, release, ping, join, gone. A rejected non-claim request returns state with a fixed code and current actor/state; malformed envelopes close the connection. Snapshot includes scene, room, self, spawn, serverTime, period, all connected members and all reserved seats. Members contain only ephemeral actor, filtered name, at/target positions, state and seat. No nearest-only roster, identity IDs, Telegram data, avatars, custom client name text or audio frames are transmitted.

The snapshot and ping use UTC+7: dawn 05–07, day 07–17, dusk 17–19, night 19–05. These are the contract's suggested thresholds, unchanged and pending user clock-hour confirmation.

Release deadlines: reservation 15s; explicit stand/move/leave immediately; disconnect 60s; background 90s; timed session +120s; indefinite prompt at 30min and release at 32min unless explicitly continued. Heartbeat silence is detected after 45s, with the disconnect deadline measured from the last received message. Foreground pings do not extend activity timers. A reconnect receives a new snapshot/actor and retains an unexpired seat. Processing is synchronous, so a seat race has one first winner.

The server checks the outer box and speed only, not client navigation/collisions. Coordinate calibration and real device timing remain C/D acceptance gates.

## Names and moderation

The original 915-entry draft remains intact in `town-name-pool.json`; runtime filtering currently leaves 912 selectable names. Rules are replaceable JSON and include project bans; Vietnamese/English/Chinese abuse; clerical/sacred titles; both Vietnamese and Han forms of the 17 excluded names; official impersonation; and an incomplete draft sensitive-name list. NFKC/NFC, trimming/space normalization and accent-insensitive matching close simple fullwidth/diacritic evasions. Only Latin letters (including Vietnamese accents) and spaces, 2–20 Unicode code points, are accepted. This is not a claim that moderation is exhaustive. Vietnamese native/cultural review is outstanding.

At most one saved change in a rolling seven days (including pool selections). Invalid custom saves are rejected; an invalid stored historical name is never broadcast and gets a stable filtered random pool fallback. Three distinct same-room subject reports on the same **subject + name revision** trigger a different random name, a 24h free-input lock and a pending review. Equal display names belonging to different people do not share a report counter. Duplicate reports by one subject do not increase it.

The existing staging admin dashboard gets a pending-names section. Access uses the existing signed Cloudflare Access validator and one-email allowlist. Writes additionally require admin Origin, same-origin fetch metadata, JSON, explicit confirmation and an idempotency UUID. The page exposes only review ID, text and count, no account details. `allow` resolves the review without restoring the old text; `reset` selects a different random name and locks free input for seven days. Locked users may select a vetted draft candidate. Audit stores opaque actor hash/action/review/result, not email or request contents. Client step c must call the report API for clicked actor IDs; no realtime scene client is implemented here.

The standalone staging `/town-name.html` tests selection/save/refresh/free input. `mountTownNames` also accepts existing authorization headers for a later scene integration. It is not automatically inserted into the unmerged town shell. Admin page action approval here is implementation/test approval only; enabling the write page online still needs user approval.

Realtime logs are only aggregate connection/room counts and fixed error/rate codes; no names, routes, tickets, coordinates or Telegram data. Expiring presence targets exist only to authorize reports and are removed on leave/disconnect; names/reviews are necessary moderation storage, not movement logs. Periodic cleanup clears ticket/rate expiry, >7d change history, >30d reports/resolved reviews, >90d audits and >1y inactive guest metadata. Unresolved reviews stay pending.

## Local evidence and open gates

`node --test server/town-scenes.test.mjs server/town.test.mjs` covers schema/identity preservation, migration guards, normalization/filtering, cookie-to-account priority, rate limits, tickets, seat competition/timers, capacity state, sequence/bounds, name moderation and two-socket loopback smoke. Capacity tests allocate in-memory state, not a 200-connection load run. `tests/town-process-smoke.mjs` starts two local child processes, forcibly stops realtime, then checks the existing API remains healthy. `tests/town-names-browser.mjs` verifies mobile/desktop save/reload/filter/choices and admin reset against a local synthetic API.

The realtime service owns `server/town-realtime/package.json` and its lockfile. Its only dependency is exact `ws 8.23.0`; `ws.mjs` resolves the package from that directory for both the entry point and transport tests. The earlier API ws declaration was removed with explicit user approval; API manifests exactly match the original base. No frontend dependencies changed. Installation was performed only inside the B worktree, with scripts/optional packages disabled; only ws was added. Existing better-sqlite3 remains reused for local synthetic database tests.

The pinned ws runtime is now tested directly, without a bundle substitute or import hook. `TOWN_TEST_WS_BUNDLE` is no longer used. To repeat in this worktree from its root (PowerShell):

```powershell
$env:TOWN_TEST_SQLITE_MODULE='E:/cloudtemple-worktrees/staging-integration/server/node_modules/better-sqlite3'
node --test server/town-scenes.test.mjs server/town.test.mjs server/test.mjs server/admin.test.mjs server/family.test.mjs server/pet-api.test.mjs
node tests/town-process-smoke.mjs
npm ls --prefix server/town-realtime --all
```

Resolved WebSocket package: `server/town-realtime/node_modules/ws/index.js`. `server/node_modules` in this author worktree is an existing SQLite dependency junction; it was not installed into or modified. On a separately authorized fresh checkout, the isolated ws lock is reproducible with `npm ci --prefix server/town-realtime --ignore-scripts --omit=optional --no-audit --no-fund --workspaces=false`. That is not authorization to install on a server. Source transport options follow the [official ws API](https://github.com/websockets/ws/blob/master/doc/ws.md).


CI, C scene integration, D independent review, Linux resource caps, real network reconnect/device tests, staging load test, Nginx/CSP application, merge, deployment and production are NOT_RUN. Load tests require a separately approved staging time window. Nginx/CSP proposals are only in the receipt directory for Claude review, not in deploy configuration.
