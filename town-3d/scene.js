import * as THREE from '../prototype-3d/vendor/three.module.min.js';
import { TEMPLES, SIDE_HALL_LAYOUT, WALK_BOUNDS, COMING_SOON_LABEL, SPAWN } from './logic.js';
import { createVisitor } from './character.js';

const INK = 0x514a40;
const outlineMat = new THREE.MeshBasicMaterial({ color: INK, side: THREE.BackSide, transparent: true, opacity: .28 });
const toon = (color, opacity = 1, map = null) => {
  const o = { color, transparent: opacity < 1, opacity, depthWrite: opacity >= 1 };
  if (map) o.map = map;
  return new THREE.MeshToonMaterial(o);
};
const flat = (color, opacity = 1) => new THREE.MeshBasicMaterial({ color, transparent: opacity < 1, opacity, depthWrite: false, side: THREE.DoubleSide });

function part(group, geometry, material, [x, y, z], { scale, rotation, outline = true } = {}) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(x, y, z);
  if (scale) mesh.scale.set(...scale);
  if (rotation) mesh.rotation.set(...rotation);
  mesh.castShadow = mesh.receiveShadow = material.opacity >= 1;
  group.add(mesh);
  if (outline && material.opacity >= 1) {
    const edge = new THREE.Mesh(geometry, outlineMat);
    edge.position.copy(mesh.position); edge.rotation.copy(mesh.rotation); edge.scale.copy(mesh.scale).multiplyScalar(1.02);
    group.add(edge);
  }
  return mesh;
}

// ── Lazy canvas textures (created once, shared across all temples) ──────────

let _stoneTex, _woodTex, _roofTex;

function stoneTexture() {
  if (_stoneTex) return _stoneTex;
  const cv = document.createElement('canvas'); cv.width = cv.height = 256;
  const ctx = cv.getContext('2d');
  ctx.fillStyle = '#c5bba6'; ctx.fillRect(0, 0, 256, 256);
  // 4-column × 5-row stone slab grid
  const cols = 4, rows = 5, cw = 64, rh = 51.2;
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const v = ((r * 7 + c * 11) % 20 - 10) * 0.006;
    ctx.fillStyle = v > 0 ? `rgba(50,25,0,${v})` : `rgba(0,30,50,${-v})`;
    ctx.fillRect(c * cw + 3, r * rh + 3, cw - 6, rh - 6);
  }
  // hairline grid
  ctx.strokeStyle = 'rgba(78,65,50,0.24)'; ctx.lineWidth = 1;
  for (let c = 1; c < cols; c++) { ctx.beginPath(); ctx.moveTo(c * cw, 0); ctx.lineTo(c * cw, 256); ctx.stroke(); }
  for (let r = 1; r < rows; r++) { ctx.beginPath(); ctx.moveTo(0, r * rh); ctx.lineTo(256, r * rh); ctx.stroke(); }
  // speckle noise
  for (let i = 0; i < 200; i++) {
    ctx.fillStyle = `rgba(50,45,38,${0.025 + (i % 5) * 0.012})`; ctx.fillRect((i * 97) % 256, (i * 61) % 256, 2, 2);
  }
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(5, 7);
  _stoneTex = t; return t;
}

function woodTexture() {
  if (_woodTex) return _woodTex;
  const cv = document.createElement('canvas'); cv.width = 256; cv.height = 128;
  const ctx = cv.getContext('2d');
  ctx.fillStyle = '#c0956a'; ctx.fillRect(0, 0, 256, 128);
  // horizontal grain lines
  for (let y = 0; y < 128; y++) {
    const a = Math.sin(y * 0.6) * 0.015 + Math.sin(y * 2.3 + 1) * 0.012 + 0.028;
    ctx.fillStyle = `rgba(60,32,8,${Math.max(0, a)})`; ctx.fillRect(0, y, 256, 1);
  }
  // coarser grain strokes
  ctx.strokeStyle = 'rgba(55,28,6,0.09)'; ctx.lineWidth = 0.5;
  for (let i = 0; i < 14; i++) {
    ctx.beginPath(); ctx.moveTo(0, i * 9 + 2); ctx.lineTo(256, i * 9 + (i % 3 === 0 ? 4 : 2)); ctx.stroke();
  }
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(2, 1);
  _woodTex = t; return t;
}

function roofTileTexture() {
  if (_roofTex) return _roofTex;
  const cv = document.createElement('canvas'); cv.width = cv.height = 128;
  const ctx = cv.getContext('2d');
  ctx.fillStyle = '#8a6244'; ctx.fillRect(0, 0, 128, 128);
  // overlapping barrel-tile arcs
  for (let r = 0; r < 4; r++) for (let c = 0; c < 8; c++) {
    ctx.fillStyle = `rgba(45,22,8,${0.055 + (r * 3 + c) % 4 * 0.025})`;
    ctx.beginPath(); ctx.arc(c * 16 + 8, r * 32 + 16, 10, 0, Math.PI); ctx.fill();
  }
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(3, 2);
  _roofTex = t; return t;
}

// ── Temple label sprite ──────────────────────────────────────────────────────

function labelSprite(lines, accent) {
  const canvas = document.createElement('canvas');
  canvas.width = 480; canvas.height = 140;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = 'rgba(242,237,226,.92)';
  ctx.strokeStyle = 'rgba(74,65,53,.4)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.roundRect(5, 5, 470, 130, 14); ctx.fill(); ctx.stroke();
  ctx.textAlign = 'center';
  ctx.fillStyle = '#2f302c'; ctx.font = '600 44px "Be Vietnam Pro", system-ui, sans-serif';
  ctx.fillText(lines[0], 240, lines[1] ? 62 : 86);
  if (lines[1]) { ctx.fillStyle = accent; ctx.font = '500 32px "Be Vietnam Pro", system-ui, sans-serif'; ctx.fillText(lines[1], 240, 110); }
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false, toneMapped: false }));
  sprite.scale.set(3.6, 1.05, 1); sprite.renderOrder = 5;
  return sprite;
}

// ── Abstract Buddha silhouette (no face, no hands, no attributes) ────────────

function buddhaSilhouette(group, open) {
  const warm = open ? 0xc8ad78 : 0xe6c98a;
  const opacity = open ? .78 : .28;
  const mat = flat(warm, opacity);
  const add = (geo, pos, scale) => { const m = new THREE.Mesh(geo, mat); m.position.set(...pos); if (scale) m.scale.set(...scale); m.renderOrder = 2; group.add(m); };
  const z = -1.1;
  const halo = new THREE.Mesh(new THREE.RingGeometry(.95, 1, 40), flat(0xd4b66d, open ? .5 : .3));
  halo.position.set(0, 2.55, z - .02); halo.renderOrder = 2; group.add(halo);
  add(new THREE.CircleGeometry(.26, 28), [0, 3.02, z]);
  add(new THREE.CircleGeometry(1, 32), [0, 2.35, z], [.5, .72, 1]);
  add(new THREE.CircleGeometry(1, 32), [-.4, 1.78, z + .01], [.62, .26, 1]);
  add(new THREE.CircleGeometry(1, 32), [.4, 1.78, z + .01], [.62, .26, 1]);
}

// ── Copper incense burner (三足铜香炉，两耳) ─────────────────────────────────

function addIncenseBurner(group, x, y, z) {
  const copper = toon(0xa07830); // warm brass/copper
  const sub = new THREE.Group(); sub.position.set(x, y, z);
  // three legs (simplified as one flat ring base)
  part(sub, new THREE.CylinderGeometry(.17, .2, .06, 12), copper, [0, 0, 0]);
  // body
  part(sub, new THREE.CylinderGeometry(.15, .17, .2, 12), copper, [0, .13, 0]);
  // rim
  part(sub, new THREE.CylinderGeometry(.2, .15, .05, 12), copper, [0, .25, 0]);
  // handles (耳)
  part(sub, new THREE.BoxGeometry(.06, .11, .05), copper, [-.22, .18, 0]);
  part(sub, new THREE.BoxGeometry(.06, .11, .05), copper, [.22, .18, 0]);
  // faint inner glow
  const glow = new THREE.PointLight(0xffcf80, .4, 2.4, 2); glow.position.set(0, .4, 0); sub.add(glow);
  group.add(sub);
}

// ── Temple mesh ───────────────────────────────────────────────────────────────

function createTemple(temple) {
  const open = temple.status === 'open';
  const group = new THREE.Group();
  group.position.set(temple.x, 0, temple.z);
  group.userData.templeId = temple.id;

  const woodMat = toon(open ? 0xdcc7a8 : 0xf0dfc0, open ? 1 : .32, open ? woodTexture() : null);
  const roofMat = toon(open ? 0x8f6e55 : 0xe0bf8a, open ? 1 : .32, open ? roofTileTexture() : null);
  const stoneMat = toon(open ? 0xc8ccc5 : 0xe8d9b6, open ? 1 : .32, open ? stoneTexture() : null);

  // floor platform
  part(group, new THREE.BoxGeometry(5.2, .3, 4.7), stoneMat, [0, .15, -.45]);
  // columns
  for (const [x, z] of [[-2.1, .8], [2.1, .8], [-2.1, -1.7], [2.1, -1.7]])
    part(group, new THREE.CylinderGeometry(.16, .2, 3.1, 10), woodMat, [x, 1.85, z]);
  // back wall with wood grain
  part(group, new THREE.BoxGeometry(4.6, 2.9, .2), woodMat, [0, 1.75, -2.2]);
  // side walls (narrow strips)
  part(group, new THREE.BoxGeometry(.2, 2.9, 2.6), woodMat, [-2.2, 1.75, -.45]);
  part(group, new THREE.BoxGeometry(.2, 2.9, 2.6), woodMat, [2.2, 1.75, -.45]);
  // roof
  const roof = part(group, new THREE.ConeGeometry(3.9, 1.5, 4), roofMat, [0, 4.15, -.45], { rotation: [0, Math.PI / 4, 0] });
  roof.scale.set(1, 1, .82);
  // roof eave (decorative strip)
  part(group, new THREE.BoxGeometry(5.0, .18, 4.6), roofMat, [0, 3.42, -.45]);

  buddhaSilhouette(group, open);

  if (open) {
    const L = SIDE_HALL_LAYOUT;
    // altar table (供桌) with wood texture
    part(group, new THREE.BoxGeometry(2.6, .8, .7), toon(0x7a5c46, 1, woodTexture()), [L.altar.x, .7, L.altar.z]);
    // incense burner (铜香炉) on altar
    addIncenseBurner(group, L.altar.x, 1.14, L.altar.z - .05);
    // mallet table (木鱼桌) — in front of person, between altar and door
    part(group, new THREE.BoxGeometry(.9, .55, .6), toon(0x9a7a58, 1, woodTexture()), [L.malletTable.x, .58, L.malletTable.z]);
    // mallet handle
    part(group, new THREE.CylinderGeometry(.06, .06, .6, 8), toon(0x7a5c46), [L.malletTable.x + .2, .9, L.malletTable.z], { rotation: [0, 0, .4] });
    // beads — right side of person position (念珠在人物右侧)
    const beads = new THREE.Group();
    for (let i = 0; i < 9; i += 1) {
      const a = i / 9 * Math.PI * 2;
      const bead = new THREE.Mesh(new THREE.SphereGeometry(.05, 6, 6), toon(0x6d4a32));
      bead.position.set(Math.cos(a) * .22, .06, Math.sin(a) * .22); beads.add(bead);
    }
    beads.position.set(L.beads.x, .31, L.beads.z); group.add(beads);
    // interior glow
    const glow = new THREE.PointLight(0xe5c77f, 1.0, 7, 2); glow.position.set(0, 3, -.4); group.add(glow);
  }

  // Label — raised above roof, smaller to avoid header overlap
  const label = labelSprite(open ? [temple.name] : [temple.name, COMING_SOON_LABEL], open ? '#2f302c' : '#9a6a2c');
  label.position.set(0, 7.5, 0);
  group.add(label);
  return group;
}

// ── Ground ────────────────────────────────────────────────────────────────────

function createGround(scene) {
  const w = WALK_BOUNDS.maxX - WALK_BOUNDS.minX + 8;
  const d = WALK_BOUNDS.maxZ - WALK_BOUNDS.minZ + 8;
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshToonMaterial({ map: stoneTexture() }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, -.01, (WALK_BOUNDS.maxZ + WALK_BOUNDS.minZ) / 2);
  ground.receiveShadow = true; scene.add(ground);

  // stone paths between temple doors
  const pathMat = new THREE.MeshToonMaterial({ color: 0xd4ccb8, map: stoneTexture() });
  const strip = (x1, z1, x2, z2) => {
    const len = Math.hypot(x2 - x1, z2 - z1);
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1.6, len).rotateX(-Math.PI / 2), pathMat);
    mesh.rotation.y = Math.atan2(x2 - x1, z2 - z1);
    mesh.position.set((x1 + x2) / 2, .006, (z1 + z2) / 2); scene.add(mesh);
  };
  const door = id => { const t = TEMPLES.find(x => x.id === id); return [t.x, t.z + 3.4]; };
  const hub = [0, 5];
  for (const id of ['chuamay', 'dilac', 'quanam', 'lienchi', 'diatang', 'duocsu', 'namtong']) {
    const [x, z] = door(id); strip(x, z, hub[0], hub[1]);
  }
}

// ── Scene disposal ────────────────────────────────────────────────────────────

function disposeGraph(root) {
  root.traverse(o => {
    o.geometry?.dispose();
    for (const m of Array.isArray(o.material) ? o.material : [o.material]) { m?.map?.dispose(); m?.dispose(); }
  });
}

// ── Main world factory ────────────────────────────────────────────────────────

export function createTownWorld(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xd9ddd5);
  scene.fog = new THREE.Fog(0xe3e1d8, 28, 62); // linear fog: starts farther out for wide view
  // FOV 58° shows ≥3 temples on screen at the pulled-back camera offset
  const camera = new THREE.PerspectiveCamera(58, 1, .1, 120);
  scene.add(new THREE.HemisphereLight(0xfff4df, 0x7d8178, 2.6));
  const sun = new THREE.DirectionalLight(0xffe8c7, 2.2);
  sun.position.set(-8, 20, 12);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -34, right: 34, top: 34, bottom: -34, far: 80 });
  scene.add(sun);
  createGround(scene);
  for (const temple of TEMPLES) scene.add(createTemple(temple));
  const visitor = createVisitor();
  visitor.position.set(SPAWN.x, 0, SPAWN.z);
  visitor.rotation.y = Math.PI;
  scene.add(visitor);

  return {
    renderer, scene, camera, visitor,
    resize(width, height, dpr) { renderer.setPixelRatio(dpr); renderer.setSize(width, height, false); camera.aspect = width / height; camera.updateProjectionMatrix(); },
    render() { renderer.render(scene, camera); },
    dispose() { disposeGraph(scene); renderer.dispose(); }
  };
}
