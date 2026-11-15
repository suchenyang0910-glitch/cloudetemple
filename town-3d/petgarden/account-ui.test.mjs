import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { applyOfferingCounts } from './offering-state.js';

const source = await readFile(new URL('./demo.js', import.meta.url), 'utf8');

test('account UI covers unauthenticated creation, authenticated creation, and mine list', () => {
  assert.match(source, /Đăng nhập bằng email/);
  assert.match(source, /Mở trong Telegram/);
  assert.match(source, /api\('\/memorials'/);
  assert.match(source, /api\('\/mine'/);
  assert.match(source, /account\.mine/);
});

test('sample account data follows the account API response shape', () => {
  assert.match(source, /identityKinds: \['email'\]/);
  assert.match(source, /publicStatus: 'hidden'/);
});

test('offerings use the backend kinds and expose failure state', () => {
  assert.match(source, /offer\('flower'\)/);
  assert.match(source, /offer\('light'\)/);
  assert.match(source, /\/memorials\/\$\{encodeURIComponent\(nearby\.id\)\}\/offerings/);
  assert.match(source, /applyOfferingCounts\(garden\.memorials, nearby\.id, data\)/);
  assert.match(source, /offering_failed/);
});

test('mine navigation never falls back to the first memorial', () => {
  assert.match(source, /memorial\.id === item\.id/);
  assert.match(source, /Không thể định vị: bia chưa được tải/);
  assert.doesNotMatch(source, /garden\.memorials\[0\]/);
});

test('offering counts update the canonical memorial object in place', () => {
  const memorial = { id: 'memorial-01', flowers: 1, lights: 2 };
  const garden = [memorial];
  const result = applyOfferingCounts(garden, 'memorial-01', { flowers: 3, lights: 4 });
  assert.equal(result, memorial);
  assert.deepEqual(memorial, { id: 'memorial-01', flowers: 3, lights: 4 });
  assert.equal(applyOfferingCounts(garden, 'missing', { flowers: 9 }), null);
});
