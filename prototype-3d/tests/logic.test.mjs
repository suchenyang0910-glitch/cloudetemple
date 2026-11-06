import test from 'node:test';
import assert from 'node:assert/strict';
import { canOccupy, nearestZone, firstLoadBytes } from '../logic.js';

test('walkable courtyard excludes altar, incense burner and hall walls', () => {
  assert.equal(canOccupy(0, 10), true);
  assert.equal(canOccupy(0, -8), false);
  assert.equal(canOccupy(0, -6.5), false);
  assert.equal(canOccupy(-6.4, 6), false);
});

test('activity zones are local and deterministic', () => {
  assert.equal(nearestZone(0, -4.8)?.id, 'incense');
  assert.equal(nearestZone(2.7, -2.9)?.id, 'cushion');
  assert.equal(nearestZone(8, 12), null);
});

test('first-load budget uses transferred bytes', () => {
  assert.equal(firstLoadBytes([{ transferSize: 1200, initiatorType: 'script', name: '/app.js' }, { transferSize: 400, initiatorType: 'fetch', name: '/optional' }]), 1200);
});
