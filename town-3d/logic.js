export const COMING_SOON_LABEL = 'Sắp mở cửa';
export const TRIGGER_DISTANCE = 1.5;
export const SPAWN = Object.freeze({ x: 0, z: 14 });
export const WALK_BOUNDS = Object.freeze({ minX: -30, maxX: 16, minZ: -15, maxZ: 19 });
export const SIDE_HALL_LAYOUT = Object.freeze({
  buddha: Object.freeze({ x: 0, z: -5 }), altar: Object.freeze({ x: 0, z: -3.4 }),
  malletTable: Object.freeze({ x: 0, z: -1.9 }), person: Object.freeze({ x: 0, z: 0 }),
  beads: Object.freeze({ x: 1.2, z: 0 })
});
// Nine fixed places: seven temples plus the pet garden and ancestor hall.
export const TEMPLES = Object.freeze([
  { id: 'chuamay', name: 'Chùa Mây', x:  0, z:  8, status: 'open' },
  { id: 'dilac',   name: 'Chùa Di Lặc', x:  5, z: -1, status: 'open' },
  { id: 'quanam',  name: 'Chùa Quan Âm', x: 13, z:  4, status: 'coming_soon' },
  { id: 'lienchi', name: 'Chùa Liên Trì', x: -5, z: -1, status: 'coming_soon' },
  { id: 'diatang', name: 'Chùa Địa Tạng', x:  0, z: -9, status: 'coming_soon' },
  { id: 'duocsu',  name: 'Chùa Dược Sư', x:  7, z: -7, status: 'coming_soon' },
  { id: 'namtong', name: 'Chùa Nam Tông', x: -13, z:  4, status: 'coming_soon' },
  { id: 'petgarden', name: 'Vườn Tưởng Niệm Thú Cưng', mapName: 'Vườn Thú Cưng', x: -23, z: 8, status: 'open' },
  { id: 'tocuong', name: 'Từ Đường', x: 12, z: -12, status: 'coming_soon' }
]);
export const TEMPLE_IDS = Object.freeze(TEMPLES.map(t => t.id));
export const activityUrl = id => isOpen(id) ? (id === 'petgarden' ? 'petgarden/demo.html' : `index.html?temple=${id}`) : null;
export const isOpen = id => TEMPLES.some(t => t.id === id && t.status === 'open');
export const doorPoint = temple => ({ x: temple.x, z: temple.z + 3 });
export function nearestTemple(x, z) {
  let best = null;
  for (const temple of TEMPLES) {
    const door = doorPoint(temple), distance = Math.hypot(x - door.x, z - door.z);
    if (distance <= TRIGGER_DISTANCE && (!best || distance < best.distance)) {
      best = { ...temple, distance, url: activityUrl(temple.id) };
    }
  }
  return best;
}
export function canOccupy(x, z, radius = .34) {
  return x >= WALK_BOUNDS.minX + radius && x <= WALK_BOUNDS.maxX - radius && z >= WALK_BOUNDS.minZ + radius && z <= WALK_BOUNDS.maxZ - radius && !TEMPLES.some(t => Math.hypot(x - t.x, z - t.z) < 2.2);
}
export function facingBuddhaYaw(temple, x, z) { return Math.atan2(temple.x - x, temple.z - z); }
