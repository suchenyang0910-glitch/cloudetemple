export function applyOfferingCounts(memorials, id, counts) {
  const memorial = memorials.find(item => item.id === id);
  if (!memorial) return null;
  memorial.flowers = counts.flowers ?? memorial.flowers;
  memorial.lights = counts.lights ?? memorial.lights;
  return memorial;
}
