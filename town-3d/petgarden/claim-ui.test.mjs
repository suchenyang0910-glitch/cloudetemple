import assert from 'node:assert/strict';
import test from 'node:test';
import { claimItems } from './claim.js';

test('renders one claim row from the real API response shape', () => {
  const items = claimItems({ items: [{ id: 'memorial-01', claimToken: 'claim-01' }] });
  assert.equal(items.length, 1);
  assert.deepEqual(items[0], { id: 'memorial-01', claimToken: 'claim-01' });
});

test('hides claim entry when the API returns no items', () => {
  assert.deepEqual(claimItems({ items: [] }), []);
  assert.deepEqual(claimItems({}), []);
});
