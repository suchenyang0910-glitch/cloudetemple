import * as THREE from '../../prototype-3d/vendor/three.bundle.min.js';
import { DETAIL_DISTANCE, canOccupyMemorials, normalizeMemorial } from './data.js';

let active;
const ASSETS = './assets/';

function stone(index, speciesCode) {
  const group = new THREE.Group();
  const base = new THREE.Mesh(new THREE.BoxGeometry(1.8, .32, 1), new THREE.MeshLambertMaterial({ color: 0x75695d }));
  const texture = new THREE.TextureLoader().load(`${ASSETS}memorial-stone-${'abc'[index % 3]}.webp`);
  const face = new THREE.Mesh(new THREE.PlaneGeometry(1.45, 2), new THREE.MeshBasicMaterial({ map: texture, transparent: true }));
  const iconTexture = new THREE.TextureLoader().load(`${ASSETS}species-icons.webp`);
  const speciesIndex = { cat: 0, dog: 1, rabbit: 2, bird: 3 }[speciesCode] ?? 4;
  iconTexture.repeat.set(.2, 1); iconTexture.offset.x = speciesIndex * .2;
  const icon = new THREE.Mesh(new THREE.PlaneGeometry(.32, .6), new THREE.MeshBasicMaterial({ map: iconTexture, transparent: true }));
  base.position.y = .16; face.position.set(0, 1.2, -.35); icon.position.set(-.42, 1.2, -.37); group.add(base, face, icon);
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

function walkwayTexture() {
  const canvas = document.createElement('canvas'); canvas.width = 256; canvas.height = 128;
  const ctx = canvas.getContext('2d'); ctx.fillStyle = '#a3aa94'; ctx.fillRect(0, 0, 256, 128);
  for (let row = 0; row < 3; row++) for (let col = 0; col < 5; col++) {
    const x = col * 54 - (row % 2 ? 22 : 0), y = row * 44 - 2;
    ctx.beginPath(); ctx.moveTo(x + 2, y + 4); ctx.lineTo(x + 48, y + 1); ctx.lineTo(x + 53, y + 38); ctx.lineTo(x + 43, y + 43); ctx.lineTo(x + 4, y + 39); ctx.closePath();
    ctx.fillStyle = ['#aeb49f', '#9ca48f', '#a7ad99'][(row + col) % 3]; ctx.fill(); ctx.strokeStyle = '#8e9784'; ctx.lineWidth = 1.5; ctx.stroke();
  }
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace; texture.wrapS = texture.wrapT = THREE.RepeatWrapping; texture.repeat.set(3, 1); return texture;
}

export async function mountPetGarden(scene, { dataUrl = '/api/pet-garden/memorials', onNearby } = {}) {
  active?.dispose();
  const root = new THREE.Group(); root.name = 'petgarden';
  const groundTexture = new THREE.TextureLoader().load(`${ASSETS}p26-a-ground-pure-grass.webp`);
  groundTexture.colorSpace = THREE.SRGBColorSpace; groundTexture.wrapS = groundTexture.wrapT = THREE.RepeatWrapping; groundTexture.repeat.set(8, 8);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(32, 32), new THREE.MeshLambertMaterial({ map: groundTexture }));
  ground.rotation.x = -Math.PI / 2; root.add(ground);
  const memorials = await loadMemorials(dataUrl);
  const meshes = new Map();
  for (const [index, memorial] of memorials.entries()) {
    const mesh = stone(index, memorial.speciesCode); mesh.position.set(memorial.worldX, 0, memorial.worldZ); mesh.userData.memorial = memorial;
    meshes.set(memorial.id, mesh); root.add(mesh);
  }
  const walkway = new THREE.Mesh(new THREE.PlaneGeometry(18, 4), new THREE.MeshLambertMaterial({ map: walkwayTexture() }));
  walkway.rotation.x = -Math.PI / 2; walkway.position.set(0, .02, 0); root.add(walkway);
  root.add(imagePlane('memorial-wall.webp', 9, 4.5, 0, -14));
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
