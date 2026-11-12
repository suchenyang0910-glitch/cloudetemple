export const WALK_BOUNDS = Object.freeze({ minX: -8.4, maxX: 8.4, minZ: -6.4, maxZ: 15 });

export const BLOCKERS = Object.freeze([
  { minX: -8.6, maxX: -3.7, minZ: -8.1, maxZ: -5.4, name: 'hall-left' },
  { minX: 3.7, maxX: 8.6, minZ: -8.1, maxZ: -5.4, name: 'hall-right' },
  { minX: -3.25, maxX: 3.25, minZ: -9.1, maxZ: -7.1, name: 'altar' },
  { minX: -1.45, maxX: 1.45, minZ: -7.2, maxZ: -6.15, name: 'incense' },
  { minX: -8.5, maxX: -5.1, minZ: 3.6, maxZ: 8.8, name: 'banyan' }
]);

export const ZONES = Object.freeze([
  { id: 'incense', x: 0, z: -4.9, radius: 2.2, label: 'Trước lư hương' },
  { id: 'cushion', x: 2.7, z: -2.9, radius: 1.8, label: 'Bên bồ đoàn' },
  { id: 'buddha', x: 0, z: -5.8, radius: 3.1, label: 'Trước Phật đài' }
]);

export function canOccupy(x, z, radius = .34) {
  if (x < WALK_BOUNDS.minX || x > WALK_BOUNDS.maxX || z < WALK_BOUNDS.minZ || z > WALK_BOUNDS.maxZ) return false;
  return !BLOCKERS.some(box => x + radius > box.minX && x - radius < box.maxX && z + radius > box.minZ && z - radius < box.maxZ);
}

export function nearestZone(x, z) {
  let nearest = null;
  for (const zone of ZONES) {
    const distance = Math.hypot(x - zone.x, z - zone.z);
    if (distance <= zone.radius && (!nearest || distance < nearest.distance)) nearest = { ...zone, distance };
  }
  return nearest;
}

export function firstLoadBytes(entries) {
  return entries.filter(entry => entry.initiatorType !== 'fetch' || !entry.name.includes('optional')).reduce((sum, entry) => sum + (entry.transferSize || entry.encodedBodySize || 0), 0);
}
