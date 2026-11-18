import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from './app.mjs';
import {createPetApi} from './pet-api.mjs';

const memorial = {
  id: '11111111-1111-4111-8111-111111111111', pet_name: 'Miu', species_code: 'cat',
  born_on: null, died_on: '2024-01-01', epitaph: '', row_no: 1, column_no: 1,
  public_status: 'hidden', demo: 0
};

async function fixture(t) {
  const pet = {
    mineUser: userId => userId === 'user-1' ? [memorial] : [],
    find: id => id === memorial.id ? memorial : undefined,
    member: (id, ref) => id === memorial.id && ref === 'user:user-1'
  };
  const family = {sessionUser: () => ({user_id: 'user-1'})};
  const settings = {hashSecret: 'test-hash-secret-with-32-characters', origins: new Set(), trustLocal: false, telegramEnabled: false};
  const petApi = createPetApi(settings, pet, {family});
  const server = createServer(settings, {}, undefined, (req, res, route) => petApi(req, res, route));
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(async () => { await new Promise(resolve => server.close(resolve)); });
  const base = `http://127.0.0.1:${server.address().port}`;
  return path => fetch(base + path, {headers: {Cookie: `ct_pet_session=${'a'.repeat(64)}`}});
}

test('pet route gate forwards authenticated mine and private detail reads', async t => {
  const get = await fixture(t);
  const mine = await get('/api/pet-garden/mine');
  assert.equal(mine.status, 200);
  assert.deepEqual((await mine.json()).items.map(item => item.id), [memorial.id]);
  const detail = await get(`/api/pet-garden/memorials/${memorial.id}/private`);
  assert.equal(detail.status, 200);
  assert.equal((await detail.json()).id, memorial.id);
  for (const path of [`/api/pet-garden/mine/${memorial.id}/visits`, `/api/pet-garden/memorials/${memorial.id}/export`]) {
    const response = await get(path);
    assert.equal(response.status, 404);
    assert.equal((await response.json()).error, 'route');
  }
});
