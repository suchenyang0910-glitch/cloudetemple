import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

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
