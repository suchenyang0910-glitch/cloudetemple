import * as THREE from '../prototype-3d/vendor/three.module.min.js';
import { TEMPLES, WALK_BOUNDS, COMING_SOON_LABEL, SPAWN } from './logic.js';
import { createVisitor } from './character.js';

const loader = new THREE.TextureLoader();

// ── Ground (organic stone courtyard — no grid, no diagonal strips) ────────────

function organicStoneCanvas() {
  const cv = document.createElement('canvas'); cv.width = cv.height = 512;
  const ctx = cv.getContext('2d');
  ctx.fillStyle = '#9ea89a'; ctx.fillRect(0, 0, 512, 512); // gray-green stone base
  // irregular stone shapes
  for (let i = 0; i < 55; i++) {
    const x = (i * 137 + 60) % 512, y = (i * 211 + 40) % 512;
    const rx = 26 + (i * 73) % 34, ry = 16 + (i * 51) % 24;
    const ang = (i * 29) % 180 * Math.PI / 180;
    ctx.save(); ctx.translate(x, y); ctx.rotate(ang);
    ctx.fillStyle = `rgba(50,55,45,${0.035 + (i % 5) * 0.02})`;
    ctx.beginPath(); ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = `rgba(48,54,42,0.09)`; ctx.lineWidth = .9;
    ctx.beginPath(); ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
  }
  // grass-green micro-speckle
  for (let i = 0; i < 350; i++) {
    ctx.fillStyle = `rgba(60,80,52,${0.015 + (i % 5) * 0.013})`; ctx.fillRect((i * 97) % 512, (i * 61) % 512, 2, 2);
  }
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(5, 7);
  return t;
}

function createGround(scene) {
  const w = WALK_BOUNDS.maxX - WALK_BOUNDS.minX + 8;
  const d = WALK_BOUNDS.maxZ - WALK_BOUNDS.minZ + 8;
  const groundMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(w, d),
    new THREE.MeshToonMaterial({ color: 0xb4bdb0, map: organicStoneCanvas() })
  );
  groundMesh.rotation.x = -Math.PI / 2;
  groundMesh.position.set(0, -.01, (WALK_BOUNDS.maxZ + WALK_BOUNDS.minZ) / 2);
  groundMesh.receiveShadow = true; scene.add(groundMesh);
  // central courtyard plaza (lighter, cleaner stone — the "hub" area)
  const plaza = new THREE.Mesh(
    new THREE.PlaneGeometry(10, 10),
    new THREE.MeshToonMaterial({ color: 0xc0c8b8 })
  );
  plaza.rotation.x = -Math.PI / 2; plaza.position.set(0, .004, 2); scene.add(plaza);
}

// ── Coming-soon billboard canvas (gray ink silhouette) ────────────────────────

let _comingSoonTex = null;
function comingSoonTex() {
  if (_comingSoonTex) return _comingSoonTex;
  const cv = document.createElement('canvas'); cv.width = 400; cv.height = 560;
  const ctx = cv.getContext('2d');
  ctx.clearRect(0, 0, 400, 560);
  const fill = (r) => { ctx.fillStyle = 'rgba(140,128,108,0.55)'; ctx.fill(r); };
  const stroke = () => { ctx.strokeStyle = 'rgba(70,60,48,0.3)'; ctx.lineWidth = 2; ctx.stroke(); };

  // platform
  ctx.beginPath(); ctx.rect(55, 495, 290, 28); fill(); stroke();
  // main hall body
  ctx.beginPath(); ctx.rect(85, 300, 230, 195); fill(); stroke();
  // first-tier hip roof
  ctx.beginPath(); ctx.moveTo(65, 300); ctx.lineTo(200, 185); ctx.lineTo(335, 300); ctx.closePath(); fill(); stroke();
  // second tier (smaller)
  ctx.beginPath(); ctx.moveTo(105, 240); ctx.lineTo(200, 162); ctx.lineTo(295, 240); ctx.closePath();
  ctx.fillStyle = 'rgba(140,128,108,0.65)'; ctx.fill(); stroke();
  // door
  ctx.fillStyle = 'rgba(60,50,38,0.38)';
  ctx.beginPath(); ctx.rect(162, 395, 76, 100); ctx.fill();
  // roof ornament (finial)
  ctx.fillStyle = 'rgba(140,128,108,0.75)';
  ctx.beginPath(); ctx.arc(200, 158, 6, 0, Math.PI * 2); ctx.fill();

  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace;
  _comingSoonTex = t; return t;
}

// ── Temple billboard ──────────────────────────────────────────────────────────
// Each temple is a Y-axis-billboard (PlaneGeometry that app.js rotates to face
// the camera each frame). Chùa Mây uses its transparent exterior cutout;
// coming-soon temples use the gray silhouette canvas.

function createBillboard(temple) {
  const group = new THREE.Group();
  group.position.set(temple.x, 0, temple.z);
  group.userData.templeId = temple.id;

  if (temple.status === 'open') {
    // 1024×1536 exterior image; height = 4.3× visitor size (2.8 units); bottom edge at y=0
    const tex = loader.load('./assets/exterior-chuamay-day.webp');
    tex.colorSpace = THREE.SRGBColorSpace;
    const billW = 8, billH = 8 * (1536 / 1024); // ≈ 12 units tall
    const board = new THREE.Mesh(
      new THREE.PlaneGeometry(billW, billH),
      new THREE.MeshBasicMaterial({ map: tex, transparent: true, alphaTest: .02, side: THREE.FrontSide })
    );
    board.position.set(0, billH / 2, .05);
    group.add(board);
  } else {
    // coming-soon: silhouette only, no backing card, bottom at y=0
    const board = new THREE.Mesh(
      new THREE.PlaneGeometry(4, 5.6),
      new THREE.MeshBasicMaterial({ map: comingSoonTex(), transparent: true, side: THREE.FrontSide })
    );
    board.position.set(0, 2.8, .05); group.add(board);
  }

  return group;
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
