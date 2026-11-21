# A-20261121-02 b — staging candidate, not a deployment approval

Base: `codex/staging-integration @ 0115ca2069bc6ff45458338b0d698eca3dee8743`.
This branch does not include the separately delivered town-shell branch, and does not implement step c's scene transport. No default users, remote load test, server changes or production migration are included.

## Process, gate and storage

`server/town-process.mjs` is a separate loopback HTTP/WebSocket process (default 8793). Existing API code only issues tickets, saves names and handles moderation. The realtime process does not import/start the API. The proposed `deploy/chuamay-town-staging.service` has no `Requires`/`PartOf` relationship with the API: `MemoryMax=300000000`, no swap, V8 heap 160 MiB, CPU quota 50%, file descriptors 512. No service was installed or started on a shared host. Cgroup limits still need Linux/staging verification.

API opt-in: `TOWN_REALTIME_ENABLED=1`, existing `CHUAMAY_ENV=staging` and an explicit DB path containing `/staging/`. Bad candidate configuration or absent migration disables the candidate rather than failing the API. The realtime entry point independently refuses production, missing opt-in or a non-staging DB path. Both use existing SQLite; realtime DB busy timeout is 100 ms. Shared database/disk contention remains a staging acceptance item even though process death is isolated.

The migration is explicit, never automatic: `CHUAMAY_ENV=staging node server/town-migrate.mjs --staging-only <existing-staging-db-path>`. It requires the existing users table and adds `users.town_name`, name metadata/history/reports/reviews/audit, short tickets and expiring report-target mappings. Local tests used synthetic SQLite only. Before any later staging application, A must back up the DB and verify the copy. Rollback means disable candidate processes/routes and restore a verified staging backup if schema rollback is required; no destructive down-migration is provided.

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

## Version 1 wire contract

WebSocket URL is `/town-ws`, with no ticket/query string. Browser Origin is checked. First frame within 5 seconds:

```json
{"v":1,"seq":1,"type":"enter","scene":"main-hall","ticket":"opaque token from API"}
```

Subsequent client sequence must increase by exactly one; version/type/extra fields, binary frames and oversized messages fail closed. Max payload 2 KiB, buffered output 32 KiB, compression disabled. Raw and unauthenticated connections count toward 200; unauthenticated sockets time out. One authenticated subject can hold only one connection, even after leaving a room.

| Client type | Additional fields | Server behavior |
|---|---|---|
| enter | scene (ticket only on first frame) | snapshot then state event; prefer occupied non-full line; max 20 members including reserved disconnected seats |
| leave | none | remove member and seat immediately |
| move | target: [x,z] | finite bounds check, maximum 30-unit target segment, 4/s; server derives motion duration at 6.2 units/s; never accepts client speed/position |
| state | value: standing or sitting; seconds: integer 1–3600 or null when sitting | sitting requires owned unexpired reservation and server-estimated arrival within 0.8 units |
| seat | seat: server seat ID | 1/s; first reservation wins, 15-second expiry, one seat per subject |
| release | none | immediate stand/release |
| heartbeat | background: boolean; optional continueSeat: boolean | respond with server time; client should send every 15 seconds; only explicit continuation after a prompt renews indefinite seating |

Every server message has `{v,seq,type}` with sequence local to the receiving connection. Broadcasts also carry `room` and monotonically increasing `roomSeq`. `snapshot` includes self actor ID, current live members and reserved seats. On reconnect, discard the old snapshot and accept a new one. Server message types are snapshot/leave/move/state/seat/release/result/heartbeat. A member contains only ephemeral actor ID, filtered name, current/target position, state and seat. Actor IDs rotate on scene entry/reconnect; account IDs, guest IDs, Telegram details and avatars are never broadcast.

Release deadlines: reservation 15s; explicit stand/move/leave immediately; observed disconnect 60s (heartbeat silence is measured from last received message); background 90s; timed sit duration +120s; indefinite sit prompt at 30min, release at 32min unless explicitly continued. A foreground heartbeat does not reset the timed/indefinite deadline. State processing is synchronous so competing seat requests have a deterministic first winner.

**Scene calibration is not done:** `server/town-rooms.json` contains explicitly labeled fixture coordinates for main-hall/stream/lotus, not measured authoritative scene bounds, obstacles or cushions. The referenced online planning document could not be retrieved. C/D must supply/verify scene IDs and geometry before integration. Only these three fixture scenes are accepted; the protocol should not be connected to an uncalibrated real scene.

## Names and moderation

The original 915-entry draft remains intact in `town-name-pool.json`; runtime filtering currently leaves 912 selectable names. Rules are replaceable JSON and include project bans; Vietnamese/English/Chinese abuse; clerical/sacred titles; both Vietnamese and Han forms of the 17 excluded names; official impersonation; and an incomplete draft sensitive-name list. NFKC/NFC, trimming/space normalization and accent-insensitive matching close simple fullwidth/diacritic evasions. Only Latin/Han letters and spaces, 2–20 Unicode code points, are accepted. This is not a claim that moderation is exhaustive. Vietnamese native/cultural review is outstanding.

At most three saved changes in a rolling 24 hours. Three distinct same-room subject reports on the same **subject + name revision** trigger a different random name, a 24h free-input lock and a pending review. Equal display names belonging to different people do not share a report counter. Duplicate reports by one subject do not increase it.

The existing staging admin dashboard gets a pending-names section. Access uses the existing signed Cloudflare Access validator and one-email allowlist. Writes additionally require admin Origin, same-origin fetch metadata, JSON, explicit confirmation and an idempotency UUID. The page exposes only review ID, text and count, no account details. `allow` resolves the review without restoring the old text; `reset` selects a different random name and locks free input for seven days. Locked users may select a vetted draft candidate. Audit stores opaque actor hash/action/review/result, not email or request contents. Client step c must call the report API for clicked actor IDs; no realtime scene client is implemented here.

The standalone staging `/town-name.html` tests selection/save/refresh/free input. `mountTownNames` also accepts existing authorization headers for a later scene integration. It is not automatically inserted into the unmerged town shell. Admin page action approval here is implementation/test approval only; enabling the write page online still needs user approval.

Realtime logs are only aggregate connection/room counts and fixed error/rate codes; no names, routes, tickets, coordinates or Telegram data. Expiring presence targets exist only to authorize reports and are removed on leave/disconnect; names/reviews are necessary moderation storage, not movement logs. Periodic cleanup clears ticket/rate expiry, >24h change history, >30d reports/resolved reviews, >90d audits and >1y inactive guest metadata. Unresolved reviews stay pending.

## Local evidence and open gates

`node --test server/town.test.mjs` covers schema/identity preservation, migration guards, normalization/filtering, cookie-to-account priority, rate limits, tickets, seat competition/timers, capacity state, sequence/bounds, name moderation and two-socket loopback smoke. Capacity tests allocate in-memory state, not a 200-connection load run. `tests/town-process-smoke.mjs` starts two local child processes, forcibly stops realtime, then checks the existing API remains healthy. `tests/town-names-browser.mjs` verifies mobile/desktop save/reload/filter/choices and admin reset against a local synthetic API.

Current author environment reuses existing better-sqlite3 and Playwright's bundled WebSocket implementation through explicit test-only paths. `ws 8.23.0` is pinned with registry integrity; only package metadata/lock were updated, no install was performed. **Exact pinned-ws installation/runtime validation is NOT_RUN**. Source transport options follow the [official ws API](https://github.com/websockets/ws/blob/master/doc/ws.md). The test-only loader is not used by the shipped entry point.

CI, C scene integration, D independent review, Linux resource caps, real network reconnect/device tests, staging load test, Nginx/CSP application, merge, deployment and production are NOT_RUN. Load tests require a separately approved staging time window. Nginx/CSP proposals are only in the receipt directory for Claude review, not in deploy configuration.
