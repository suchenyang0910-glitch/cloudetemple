import * as THREE from '../../prototype-3d/vendor/three.module.min.js';
import { DETAIL_DISTANCE, canOccupyMemorials, normalizeMemorial } from './data.js';

let active;
const ASSETS = './assets/';

function stone(index) {
  const group = new THREE.Group();
  const base = new THREE.Mesh(new THREE.BoxGeometry(1.25, .25, .75), new THREE.MeshLambertMaterial({ color: 0x75695d }));
  const texture = new THREE.TextureLoader().load(`${ASSETS}memorial-stone-${'abc'[index % 3]}.webp`);
  const face = new THREE.Mesh(new THREE.PlaneGeometry(.95, 1.3), new THREE.MeshBasicMaterial({ map: texture, transparent: true }));
  base.position.y = .125; face.position.set(0, .82, -.25); group.add(base, face);
  return group;
}

async function loadMemorials(dataUrl) {
  try {
    const response = await fetch(dataUrl);
    if (!response.ok) throw new Error(`pet garden data: ${response.status}`);
    const payload = await response.json();
    return (payload.items || []).map(normalizeMemorial);
  } catch {
    return [];
  }
}

function imagePlane(url, width, height, x, z, rotation = 0) {
  const texture = new THREE.TextureLoader().load(`${ASSETS}${url}`);
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(width, height), new THREE.MeshBasicMaterial({ map: texture, transparent: true }));
  plane.position.set(x, height / 2, z); plane.rotation.y = rotation;
  return plane;
}

export async function mountPetGarden(scene, { dataUrl = '/api/pet-garden/memorials', onNearby } = {}) {
  active?.dispose();
  const root = new THREE.Group(); root.name = 'petgarden';
  const groundTexture = new THREE.TextureLoader().load(`${ASSETS}ground.webp`);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(32, 32), new THREE.MeshLambertMaterial({ map: groundTexture, color: 0xffffff }));
  ground.rotation.x = -Math.PI / 2; root.add(ground);
  const memorials = await loadMemorials(dataUrl);
  const meshes = new Map();
  for (const [index, memorial] of memorials.entries()) {
    const mesh = stone(index); mesh.position.set(memorial.worldX, 0, memorial.worldZ); mesh.userData.memorial = memorial;
    meshes.set(memorial.id, mesh); root.add(mesh);
  }
  root.add(imagePlane('walkway.webp', 18, 4, 0, 0));
  root.add(imagePlane('memorial-wall.webp', 9, 4.5, -11, -11, Math.PI / 4));
  root.add(imagePlane('independent-garden.webp', 7, 4, 11, -11, -Math.PI / 4));
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
