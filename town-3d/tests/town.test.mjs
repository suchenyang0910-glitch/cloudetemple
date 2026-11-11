import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { TEMPLES, TEMPLE_IDS, TRIGGER_DISTANCE, SIDE_HALL_LAYOUT, SPAWN, activityUrl, isOpen, nearestTemple, doorPoint, canOccupy, facingBuddhaYaw } from '../logic.js';

test('round 3 artwork replaces both P0 placeholders', async () => {
  const [scene, character] = await Promise.all([
    readFile(new URL('../scene.js', import.meta.url), 'utf8'),
    readFile(new URL('../character.js', import.meta.url), 'utf8')
  ]);
  assert.match(scene, /\.\/assets\/exterior-chuamay-day\.webp/);
  assert.doesNotMatch(scene, /scene-vn-courtyard-day\.webp/);
  assert.match(character, /\.\/assets\/visitor\/palms-back\.webp/);
  assert.match(character, /rig\.view === 'back'\) setFrame\(visitor, 'palms-back'\)/);
});

test('seven temple IDs exactly, in plan order', () => {
  assert.deepEqual(TEMPLES.map(t => t.id), ['chuamay', 'dilac', 'quanam', 'lienchi', 'diatang', 'duocsu', 'namtong']);
  assert.deepEqual([...TEMPLE_IDS], TEMPLES.map(t => t.id));
});

test('only chuamay and dilac are open; others coming_soon', () => {
  assert.deepEqual(TEMPLES.filter(t => t.status === 'open').map(t => t.id), ['chuamay', 'dilac']);
  for (const id of ['quanam', 'lienchi', 'diatang', 'duocsu', 'namtong']) assert.equal(isOpen(id), false);
});

test('map positions follow the plan (S/centre/E/W/N/NE/SW); z grows south', () => {
  const p = Object.fromEntries(TEMPLES.map(t => [t.id, t]));
  assert.ok(p.chuamay.z > p.dilac.z && Math.abs(p.chuamay.x) < 1);   // south
  assert.ok(Math.abs(p.dilac.x) < 1 && Math.abs(p.dilac.z) < 1);      // centre
  assert.ok(p.quanam.x > 5);                                          // east
  assert.ok(p.lienchi.x < -5);                                        // west
  assert.ok(p.diatang.z < p.dilac.z - 5);                             // north
  assert.ok(p.duocsu.x > 5 && p.duocsu.z < -5);                       // north-east
  assert.ok(p.namtong.x < -5 && p.namtong.z > 5);                     // south-west
});

test('activity URLs: open temples only, index.html?temple=id', () => {
  assert.equal(activityUrl('chuamay'), 'index.html?temple=chuamay');
  assert.equal(activityUrl('dilac'), 'index.html?temple=dilac');
  for (const id of ['quanam', 'lienchi', 'diatang', 'duocsu', 'namtong', 'nope']) assert.equal(activityUrl(id), null);
});

test('proximity trigger is 1.5 m from the door point (inclusive)', () => {
  assert.equal(TRIGGER_DISTANCE, 1.5);
  for (const t of TEMPLES) {
    const d = doorPoint(t);
    assert.equal(nearestTemple(d.x, d.z)?.id, t.id);
    assert.equal(nearestTemple(d.x + 1.5, d.z)?.id, t.id);
    assert.equal(nearestTemple(d.x, d.z + 1.51), null);
    assert.equal(nearestTemple(d.x + 1.6, d.z), null);
  }
  const open = nearestTemple(doorPoint(TEMPLES[1]).x, doorPoint(TEMPLES[1]).z);
  assert.equal(open.url, 'index.html?temple=dilac');
  const closed = nearestTemple(doorPoint(TEMPLES[2]).x, doorPoint(TEMPLES[2]).z);
  assert.equal(closed.url, null);
});

test('door points and spawn are walkable; temple bodies are not', () => {
  for (const t of TEMPLES) { const d = doorPoint(t); assert.equal(canOccupy(d.x, d.z), true, t.id); assert.equal(canOccupy(t.x, t.z), false, t.id); }
  assert.equal(canOccupy(SPAWN.x, SPAWN.z), true);
});

test('side-hall order: Buddha, altar, (mallet table ahead of) person; beads on person right', () => {
  const L = SIDE_HALL_LAYOUT;
  assert.ok(L.buddha.z < L.altar.z && L.altar.z < L.malletTable.z && L.malletTable.z < L.person.z);
  // Person faces the Buddha (-z); right-hand side while facing -z is +x.
  assert.ok(L.beads.x > L.person.x);
  const t = TEMPLES[1]; const d = doorPoint(t);
  const yaw = facingBuddhaYaw(t, d.x, d.z);
  assert.ok(Math.abs(Math.sin(yaw)) < 1e-9 && Math.cos(yaw) < 0); // forward = -z
});
