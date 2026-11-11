export const COMING_SOON_LABEL = 'Sắp mở cửa';
export const TRIGGER_DISTANCE = 1.5;
export const SPAWN = Object.freeze({ x: 0, z: 14 });
export const WALK_BOUNDS = Object.freeze({ minX: -16, maxX: 16, minZ: -15, maxZ: 19 });
export const SIDE_HALL_LAYOUT = Object.freeze({
  buddha: Object.freeze({ x: 0, z: -5 }), altar: Object.freeze({ x: 0, z: -3.4 }),
  malletTable: Object.freeze({ x: 0, z: -1.9 }), person: Object.freeze({ x: 0, z: 0 }),
  beads: Object.freeze({ x: 1.2, z: 0 })
});
// Portrait layout (393×659, horizontal FOV ≈ 36°):
//   chuamay  center; quanam RIGHT-FRONT (NDC+0.77); namtong LEFT-FRONT (NDC-0.77)
//   dilac/lienchi flanking center-back; diatang far back; duocsu right-back
export const TEMPLES = Object.freeze([
  { id: 'chuamay', name: 'Chùa Mây', x:  0, z:  8, status: 'open' },
  { id: 'quanam',  name: 'Chùa Quan Âm', x:  7, z: 10, status: 'coming_soon' },
  { id: 'namtong', name: 'Khu phố Nam Tông', x: -7, z: 10, status: 'coming_soon' },
  { id: 'dilac',   name: 'Chùa Di Lặc', x:  5, z: -1, status: 'coming_soon' }, // blocked: main app not yet reading ?temple=dilac
  { id: 'lienchi', name: 'Chùa Liên Trì', x: -5, z: -1, status: 'coming_soon' },
  { id: 'diatang', name: 'Chùa Địa Tạng', x:  0, z: -9, status: 'coming_soon' },
  { id: 'duocsu',  name: 'Chùa Dược Sư', x:  7, z: -7, status: 'coming_soon' }
]);
export const TEMPLE_IDS = Object.freeze(TEMPLES.map(t => t.id));
export const activityUrl = id => isOpen(id) ? `index.html?temple=${id}` : null;
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
