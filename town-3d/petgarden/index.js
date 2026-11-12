import * as THREE from '../../prototype-3d/vendor/three.module.min.js';
import { DETAIL_DISTANCE, canOccupyMemorials, normalizeMemorial } from './data.js';

let active;

function stone() {
  const group = new THREE.Group();
  const base = new THREE.Mesh(new THREE.BoxGeometry(1.25, .25, .75), new THREE.MeshLambertMaterial({ color: 0x75695d }));
  const face = new THREE.Mesh(new THREE.BoxGeometry(.9, 1.25, .18), new THREE.MeshLambertMaterial({ color: 0xa99a86 }));
  base.position.y = .125; face.position.set(0, .82, -.25); group.add(base, face);
  return group;
}

async function loadMemorials(dataUrl) {
  const response = await fetch(dataUrl);
  if (!response.ok) throw new Error(`pet garden data: ${response.status}`);
  const payload = await response.json();
  return (payload.items || []).map(normalizeMemorial);
}

export async function mountPetGarden(scene, { dataUrl = new URL('./sample-data.json', import.meta.url), onNearby } = {}) {
  active?.dispose();
  const root = new THREE.Group(); root.name = 'petgarden-sample';
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(32, 32), new THREE.MeshLambertMaterial({ color: 0x829b72 }));
  ground.rotation.x = -Math.PI / 2; root.add(ground);
  const memorials = await loadMemorials(dataUrl);
  const meshes = new Map();
  for (const memorial of memorials) {
    const mesh = stone(); mesh.position.set(memorial.worldX, 0, memorial.worldZ); mesh.userData.memorial = memorial;
    meshes.set(memorial.id, mesh); root.add(mesh);
  }
  scene.add(root);
  const api = {
    memorials,
    root,
    canOccupy: (x, z) => canOccupyMemorials(memorials, x, z),
    getMemorialAt: (x, z) => memorials.find(memorial => Math.hypot(x - memorial.worldX, z - memorial.worldZ) <= memorial.bounds) || null,
    update({ visitor }) {
      const nearby = memorials.find(memorial => Math.hypot(visitor.position.x - memorial.worldX, visitor.position.z - memorial.worldZ) <= DETAIL_DISTANCE) || null;
      onNearby?.(nearby);
      return nearby;
    },
    dispose() { root.removeFromParent(); root.traverse(node => { node.geometry?.dispose(); node.material?.dispose(); }); }
  };
  active = api;
  return api;
}

export function disposePetGarden() { active?.dispose(); active = undefined; }
export function getMemorialAt(worldX, worldZ) { return active?.getMemorialAt(worldX, worldZ) || null; }
export function enter() {}
export function leave() { disposePetGarden(); }
export function update({ world }) { return active?.update({ visitor: world.visitor }); }
export function resources() { return []; }
