export const DISTRICT_ID = 'garden-01';
export const GRID_SIZE = 8;
export const SLOT_SPACING = 3.5;
export const WALKWAY_WIDTH = 2;
export const DETAIL_DISTANCE = 6;

export function worldPosition({ rowNo, columnNo }) {
  return {
    x: (columnNo - (GRID_SIZE + 1) / 2) * SLOT_SPACING,
    z: (rowNo - (GRID_SIZE + 1) / 2) * SLOT_SPACING
  };
}

export function normalizeMemorial(item) {
  const position = worldPosition(item);
  return { ...item, districtId: item.districtId || DISTRICT_ID, worldX: position.x, worldZ: position.z, bounds: 1.35 };
}

export function canOccupyMemorials(memorials, x, z, radius = .55) {
  return memorials.every(memorial => Math.hypot(x - memorial.worldX, z - memorial.worldZ) > memorial.bounds + radius);
}
