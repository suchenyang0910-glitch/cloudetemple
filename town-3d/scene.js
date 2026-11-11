import * as THREE from '../prototype-3d/vendor/three.module.min.js';
import { TEMPLES, WALK_BOUNDS, COMING_SOON_LABEL, SPAWN } from './logic.js';
import { createVisitor } from './character.js';

const loader = new THREE.TextureLoader();

// ── Ground (real stone courtyard texture) ────────────────────────────────────

function createGround(scene) {
  const w = WALK_BOUNDS.maxX - WALK_BOUNDS.minX + 8;
  const d = WALK_BOUNDS.maxZ - WALK_BOUNDS.minZ + 8;
  const groundTex = loader.load('./assets/ground-stone-courtyard.webp');
  groundTex.colorSpace = THREE.SRGBColorSpace;
  groundTex.wrapS = groundTex.wrapT = THREE.RepeatWrapping;
  groundTex.repeat.set(10, 12); // avoids large-block repetition on 44×46-unit ground
  const groundMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(w, d),
    new THREE.MeshToonMaterial({ color: 0xdde0d8, map: groundTex })
  );
  groundMesh.rotation.x = -Math.PI / 2;
  groundMesh.position.set(0, -.01, (WALK_BOUNDS.maxZ + WALK_BOUNDS.minZ) / 2);
  groundMesh.receiveShadow = true; scene.add(groundMesh);
}

// ── Coming-soon fallback canvas (gray ink silhouette — namtong only) ─────────

let _comingSoonTex = null;
function comingSoonTex() {
  if (_comingSoonTex) return _comingSoonTex;
  const cv = document.createElement('canvas'); cv.width = 400; cv.height = 560;
  const ctx = cv.getContext('2d');
  ctx.clearRect(0, 0, 400, 560);
  const fill = () => { ctx.fillStyle = 'rgba(140,128,108,0.55)'; ctx.fill(); };
  const stroke = () => { ctx.strokeStyle = 'rgba(70,60,48,0.3)'; ctx.lineWidth = 2; ctx.stroke(); };
  ctx.beginPath(); ctx.rect(55, 495, 290, 28); fill(); stroke();
  ctx.beginPath(); ctx.rect(85, 300, 230, 195); fill(); stroke();
  ctx.beginPath(); ctx.moveTo(65, 300); ctx.lineTo(200, 185); ctx.lineTo(335, 300); ctx.closePath(); fill(); stroke();
  ctx.beginPath(); ctx.moveTo(105, 240); ctx.lineTo(200, 162); ctx.lineTo(295, 240); ctx.closePath();
  ctx.fillStyle = 'rgba(140,128,108,0.65)'; ctx.fill(); stroke();
  ctx.fillStyle = 'rgba(60,50,38,0.38)';
  ctx.beginPath(); ctx.rect(162, 395, 76, 100); ctx.fill();
  ctx.fillStyle = 'rgba(140,128,108,0.75)';
  ctx.beginPath(); ctx.arc(200, 158, 6, 0, Math.PI * 2); ctx.fill();
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace;
  _comingSoonTex = t; return t;
}

// ── Temple billboards ─────────────────────────────────────────────────────────
// Three cases:
//   open        → full-color exterior image, autoRotate=true
//   coming_soon with exterior (all except namtong) → exterior image + cold-fog tint, autoRotate=true
//   coming_soon namtong (no exterior yet) → gray silhouette Sprite, autoRotate=false

const EXTERIOR_IDS = new Set(['chuamay', 'dilac', 'quanam', 'lienchi', 'diatang', 'duocsu']);
const BILL_W = 8, BILL_H = 8 * (1536 / 1024); // ≈ 12 units (4.3× visitor height 2.8)

function createBillboard(temple) {
  const group = new THREE.Group();
  group.position.set(temple.x, 0, temple.z);
  group.userData.templeId = temple.id;

  if (EXTERIOR_IDS.has(temple.id)) {
    group.userData.autoRotate = true;
    const tex = loader.load(`./assets/exterior-${temple.id}-day.webp`);
    tex.colorSpace = THREE.SRGBColorSpace;
    const isOpen = temple.status === 'open';
    const board = new THREE.Mesh(
      new THREE.PlaneGeometry(BILL_W, BILL_H),
      new THREE.MeshBasicMaterial({
        map: tex,
        // Coming-soon: cool gray-blue tint + slight transparency to signal "not yet open"
        color: isOpen ? 0xffffff : 0xa8b0be,
        transparent: true,
        alphaTest: isOpen ? .02 : 0,
        opacity: isOpen ? 1 : .82,
        side: THREE.FrontSide,
      })
    );
    board.position.set(0, BILL_H / 2, .05);
    group.add(board);
    // Coming-soon: add a soft foggy veil (semi-transparent cool plane in front)
    if (!isOpen) {
      const veil = new THREE.Mesh(
        new THREE.PlaneGeometry(BILL_W, BILL_H),
        new THREE.MeshBasicMaterial({ color: 0xd4dae8, transparent: true, opacity: .22, side: THREE.FrontSide })
      );
      veil.position.set(0, BILL_H / 2, .10);
      group.add(veil);
    }
  } else {
    // namtong — no exterior yet; gray silhouette Sprite auto-billboards
    group.userData.autoRotate = false;
    const sprite = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: comingSoonTex(), transparent: true, depthWrite: false })
    );
    sprite.scale.set(4, 5.6, 1);
    sprite.position.set(0, 2.8, 0);
    group.add(sprite);
  }

  return group;
}

// ── Flora clusters (Sprites, auto-billboard, scattered between temples) ───────

const FLORA_PLACEMENTS = [
  { x:  4.5, z:  5.0, s: 1.10 },   // chuamay ↔ quanam
  { x: -4.5, z:  5.0, s: 0.90 },   // chuamay ↔ namtong
  { x:  5.0, z: -2.5, s: 1.00 },   // dilac ↔ quanam
  { x: -5.0, z: -2.5, s: 1.20 },   // dilac ↔ lienchi
  { x:  8.0, z: -4.5, s: 0.85 },   // quanam ↔ duocsu
  { x: -8.0, z: -4.5, s: 0.95 },   // lienchi ↔ diatang
  { x:  2.5, z:-10.0, s: 1.05 },   // south path
  { x: -2.5, z:-10.0, s: 0.80 },
  { x: 12.0, z:  2.0, s: 1.00 },   // east edge
  { x:-12.0, z:  2.0, s: 0.95 },   // west edge
  { x: 11.0, z: -6.0, s: 0.90 },   // southeast
  { x:-11.0, z: -6.0, s: 1.10 },   // southwest
];

function createFlora(scene) {
  const textures = [
    loader.load('./assets/flora-cluster-01.webp'),
    loader.load('./assets/flora-cluster-02.webp'),
  ];
  textures.forEach(t => { t.colorSpace = THREE.SRGBColorSpace; });
  FLORA_PLACEMENTS.forEach(({ x, z, s }, i) => {
    const sprite = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: textures[i % 2], transparent: true, depthWrite: false })
    );
    // Base width 2.8, height 4.2 (maintaining 2:3 portrait ratio), scaled by s
    sprite.scale.set(2.8 * s, 4.2 * s, 1);
    sprite.position.set(x, 4.2 * s / 2, z); // center Sprite vertically above ground
    scene.add(sprite);
  });
}

// ── Dispose ───────────────────────────────────────────────────────────────────

function disposeGraph(root) {
  root.traverse(o => {
    o.geometry?.dispose();
    for (const m of Array.isArray(o.material) ? o.material : [o.material]) { m?.map?.dispose(); m?.dispose(); }
  });
}

// ── World factory ─────────────────────────────────────────────────────────────

export function createTownWorld(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xd0d8cc);
  scene.fog = new THREE.Fog(0xdcd8cc, 30, 65);
  const camera = new THREE.PerspectiveCamera(58, 1, .1, 120);
  scene.add(new THREE.HemisphereLight(0xfff4df, 0x7d8c74, 2.6));
  const sun = new THREE.DirectionalLight(0xffe8c7, 2.2);
  sun.position.set(-8, 20, 12); sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -34, right: 34, top: 34, bottom: -34, far: 80 });
  scene.add(sun);
  createGround(scene);
  const billboards = [];
  for (const temple of TEMPLES) {
    const b = createBillboard(temple); scene.add(b); billboards.push(b);
  }
  createFlora(scene);
  const visitor = createVisitor();
  visitor.position.set(SPAWN.x, 0, SPAWN.z);
  visitor.rotation.y = Math.PI; scene.add(visitor);
  return {
    renderer, scene, camera, visitor, billboards,
    resize(w, h, dpr) { renderer.setPixelRatio(dpr); renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); },
    render() { renderer.render(scene, camera); },
    dispose() { disposeGraph(scene); renderer.dispose(); }
  };
}
