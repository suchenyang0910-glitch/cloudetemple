import * as THREE from '../prototype-3d/vendor/three.module.min.js';
import { createTownWorld } from './scene.js';
import { poseVisitor, updateView } from './character.js';
import { TEMPLES, canOccupy, nearestTemple, facingBuddhaYaw, COMING_SOON_LABEL } from './logic.js';

const ROOT_PREFIX = '../'; // town-3d/ lives one level below the 2D app (index.html).
const canvas = document.querySelector('#scene');
const status = document.querySelector('#status');
const fallback = document.querySelector('#fallback');
const panel = document.querySelector('#temple-panel');
const panelName = document.querySelector('#temple-name');
const panelState = document.querySelector('#temple-state');
const enterLink = document.querySelector('#temple-enter');
const hint = document.querySelector('#walk-hint');
const labelsEl = document.querySelector('#labels');
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
// label divs keyed by temple id — created once in initLabels()
const labelDivs = {};

let world;
let target = null;
let walking = false;
let current = null;
const keys = new Set();
const pointer = { down: false, id: null, startX: 0, startY: 0, steer: 0, moved: false };
const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();
const ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const hit = new THREE.Vector3();
// Pulled back enough to show ≥3 temples at once at FOV 58°.
const CAMERA_OFFSET = new THREE.Vector3(1.6, 13, 14);
const MAP_CAM_POS = new THREE.Vector3(0, 55, 2);  // higher = temples spread out more in screen space
const MAP_CAM_TARGET = new THREE.Vector3(0, 0, 2);
let mapMode = false;

function initLabels() {
  for (const t of TEMPLES) {
    const div = document.createElement('div');
    div.className = 'temple-label';
    div.dataset.id = t.id;
    div.innerHTML = `<span class="label-name">${t.name}</span>` +
      (t.status !== 'open' ? `<span class="label-status">${COMING_SOON_LABEL}</span>` : '');
    labelsEl.appendChild(div);
    labelDivs[t.id] = div;
  }
}

// ── Label occlusion helpers ───────────────────────────────────────────────────

const _camDir = new THREE.Vector3();
const _camRt  = new THREE.Vector3();
const _pt     = new THREE.Vector3();

// Returns the screen-space bounding rect of a billboard (accounting for camera orientation).
function billboardScreenRect(t, cam, halfW, halfH) {
  const isOpen = t.status === 'open';
  const hw = isOpen ? 4.4 : 2.3;   // world half-width
  const h  = isOpen ? 12.5 : 5.9;  // world height

  // Billboard faces camera on Y-axis; its width-direction = camera right
  cam.getWorldDirection(_camDir);
  _camRt.crossVectors(new THREE.Vector3(0, 1, 0), _camDir).normalize();

  const rp = new THREE.Vector3(t.x + hw * _camRt.x, h / 2, t.z + hw * _camRt.z).project(cam);
  const lp = new THREE.Vector3(t.x - hw * _camRt.x, h / 2, t.z - hw * _camRt.z).project(cam);
  const tp = new THREE.Vector3(t.x, h,   t.z).project(cam);
  const bp = new THREE.Vector3(t.x, 0,   t.z).project(cam);
  if (rp.z > 1 && lp.z > 1) return null;

  return {
    left:   Math.min(lp.x, rp.x) * halfW + halfW - 6,
    right:  Math.max(lp.x, rp.x) * halfW + halfW + 6,
    top:    -Math.max(tp.y, bp.y) * halfH + halfH - 6,
    bottom: -Math.min(tp.y, bp.y) * halfH + halfH + 6,
  };
}

function rectsOverlap(a, b) {
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
}

function updateLabels() {
  const halfW = innerWidth / 2, halfH = innerHeight / 2;
  const cam = world.camera;
  const vx = world.visitor.position.x, vz = world.visitor.position.z;

  // Sort nearest-to-visitor first
  const sorted = [...TEMPLES].sort((a, b) =>
    Math.hypot(a.x - vx, a.z - vz) - Math.hypot(b.x - vx, b.z - vz)
  );

  // Precompute screen positions and billboard rects for all temples
  const sp = new Map(), billRects = new Map();
  for (const t of sorted) {
    // Map mode: project from ground level so label sits at temple map position
    // Normal mode: project above billboard top
    const wy = mapMode ? 0.5 : (t.status === 'open' ? 13 : 6.5);
    const v = _pt.set(t.x, wy, t.z).project(cam);
    sp.set(t.id, { sx: v.x * halfW + halfW, sy: -v.y * halfH + halfH, behind: v.z > 1 });
    billRects.set(t.id, billboardScreenRect(t, cam, halfW, halfH));
  }

  const visible = new Set();
  const finalPos = new Map();
  const LHW = 76; // label half-width for clamping (px)

  if (mapMode) {
    // Map mode: show all 7, push-down to prevent overlap (never hide)
    const LH = 38; // approx label height at map-mode font (13px + 11px + gap)
    const placements = [];
    for (const t of sorted) {
      const { sx, sy, behind } = sp.get(t.id);
      if (!behind) placements.push({ id: t.id, sx, sy });
    }
    placements.sort((a, b) => a.sy - b.sy); // top-of-screen first
    const placed = [];
    for (const p of placements) {
      let sx = Math.max(LHW + 12, Math.min(innerWidth - LHW - 12, p.sx));
      let sy = p.sy;
      for (let attempt = 0; attempt < 10; attempt++) {
        const r = { left: sx - LHW, right: sx + LHW, top: sy - 4, bottom: sy + LH };
        const conflict = placed.find(q => rectsOverlap(r, q));
        if (!conflict) break;
        sy = conflict.bottom + 4;
      }
      sy = Math.max(72, Math.min(innerHeight - 12, sy));
      placed.push({ left: sx - LHW, right: sx + LHW, top: sy - 4, bottom: sy + LH });
      visible.add(p.id);
      finalPos.set(p.id, { sx, sy });
    }
  } else {
    // Normal mode: nearest first, up to 3; nearest is ALWAYS shown (clamp to screen).
    // Others: hidden if occluded by closer billboard or overlapping placed label.
    const placedRects = [];
    for (let i = 0; i < sorted.length && visible.size < 3; i++) {
      const t = sorted[i];
      const { sx: rawSx, sy: rawSy, behind } = sp.get(t.id);
      if (behind) continue;
      // Clamp sx for all; nearest clamps sy, others skip if off-screen
      const sx = Math.max(LHW + 12, Math.min(innerWidth - LHW - 12, rawSx));
      let sy = rawSy;
      if (i === 0) {
        sy = Math.max(72, Math.min(innerHeight - 40, sy));
      } else {
        if (sy < 72 || sy > innerHeight - 40) continue;
      }
      const lRect = { left: sx - LHW, right: sx + LHW, top: sy - 4, bottom: sy + 42 };
      if (i > 0) {
        let blocked = false;
        for (let j = 0; j < i; j++) {
          const br = billRects.get(sorted[j].id);
          // Block only if label center is literally inside a closer billboard — not just nearby
          if (br && sx >= br.left && sx <= br.right && sy >= br.top && sy <= br.bottom) { blocked = true; break; }
        }
        if (blocked) continue;
        for (const pr of placedRects) {
          if (rectsOverlap(lRect, pr)) { blocked = true; break; }
        }
        if (blocked) continue;
      }
      placedRects.push(lRect);
      visible.add(t.id);
      finalPos.set(t.id, { sx, sy });
    }
  }

  // Apply positions and visibility
  for (const t of TEMPLES) {
    const div = labelDivs[t.id]; if (!div) continue;
    if (!visible.has(t.id)) { div.style.display = 'none'; continue; }
    const pos = finalPos.get(t.id);
    div.style.display = '';
    div.style.left = `${pos.sx}px`;
    div.style.top  = `${pos.sy}px`;
  }
}

function updateBillboards() {
  const cam = world.camera;
  for (const b of world.billboards) {
    // Map mode: hide fog veil so coming-soon temples are clearly readable from above
    if (b.userData.veil) b.userData.veil.visible = !mapMode;
    if (!b.userData.autoRotate) continue; // Sprites auto-billboard; skip them
    if (mapMode) {
      // Full lookAt so overhead camera sees the painting, not an edge
      b.lookAt(cam.position);
    } else {
      // Y-axis only: billboard stays vertical, rotates to face camera on horizontal plane
      const dx = cam.position.x - b.position.x;
      const dz = cam.position.z - b.position.z;
      b.rotation.set(0, Math.atan2(dx, dz), 0);
    }
  }
}

function boot() {
  try {
    if (new URLSearchParams(location.search).get('mode') === '2d') throw new Error('2d-requested');
    world = createTownWorld(canvas);
    resize();
    addEventListener('resize', resize, { passive: true });
    bindControls();
    initLabels();
    world.camera.position.copy(world.visitor.position).add(CAMERA_OFFSET);
    document.getElementById('map-toggle').addEventListener('click', toggleMap);
    status.classList.add('ready');
    window.__TOWN_READY__ = true;
    requestAnimationFrame(frame);
  } catch (error) {
    console.error(error);
    status.hidden = true;
    fallback.hidden = false; // 2D fallback link stays available.
  }
}

function resize() {
  world.resize(innerWidth, innerHeight, Math.min(devicePixelRatio || 1, innerWidth < 500 ? 1.35 : 1.6));
}

function bindControls() {
  addEventListener('keydown', e => {
    const k = e.key.toLowerCase();
    if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'w', 'a', 's', 'd'].includes(k)) { e.preventDefault(); keys.add(k); }
  });
  addEventListener('keyup', e => keys.delete(e.key.toLowerCase()));
  canvas.addEventListener('pointerdown', e => {
    if (pointer.down) return;
    Object.assign(pointer, { down: true, id: e.pointerId, startX: e.clientX, startY: e.clientY, steer: 0, moved: false });
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove', e => {
    if (!pointer.down || e.pointerId !== pointer.id) return;
    const dx = e.clientX - pointer.startX;
    const dy = e.clientY - pointer.startY;
    if (Math.hypot(dx, dy) > 10) pointer.moved = true;
    pointer.steer = THREE.MathUtils.clamp(dx / Math.max(120, innerWidth * .28), -1, 1);
  });
  const up = e => {
    if (e.pointerId !== pointer.id) return;
    if (!pointer.moved && e.type === 'pointerup') setGroundTarget(e.clientX, e.clientY);
    Object.assign(pointer, { down: false, id: null, steer: 0 });
  };
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', up);
}

function setGroundTarget(x, y) {
  ndc.set(x / innerWidth * 2 - 1, -(y / innerHeight) * 2 + 1);
  raycaster.setFromCamera(ndc, world.camera);
  if (raycaster.ray.intersectPlane(ground, hit) && canOccupy(hit.x, hit.z)) {
    target = new THREE.Vector3(hit.x, 0, hit.z);
    hint.hidden = true;
  }
}

function moveVisitor(delta, now) {
  const v = world.visitor;
  let turn = 0; let forward = 0;
  if (keys.has('arrowleft') || keys.has('a')) turn += 1;
  if (keys.has('arrowright') || keys.has('d')) turn -= 1;
  if (keys.has('arrowup') || keys.has('w')) forward += 1;
  if (keys.has('arrowdown') || keys.has('s')) forward -= .65;
  if (pointer.down && pointer.moved) { turn -= pointer.steer; forward = 1; target = null; } // press/drag continuous walk
  v.rotation.y += turn * delta * 1.7;
  let sx = 0; let sz = 0;
  if (target) {
    const dx = target.x - v.position.x; const dz = target.z - v.position.z;
    const dist = Math.hypot(dx, dz);
    if (dist < .15) target = null;
    else { v.rotation.y = Math.atan2(dx, dz); sx = dx / dist; sz = dz / dist; forward = 1; }
  }
  if (forward) {
    hint.hidden = true;
    if (!target) { sx = Math.sin(v.rotation.y); sz = Math.cos(v.rotation.y); }
    const step = 2.4 * delta * forward;
    const nx = v.position.x + sx * step; const nz = v.position.z + sz * step;
    const movedX = canOccupy(nx, v.position.z); const movedZ = canOccupy(v.position.x, nz);
    if (movedX) v.position.x = nx;
    if (movedZ) v.position.z = nz;
    if (!movedX && !movedZ) target = null;
    walking = true;
    updateView(v, world.camera);
    poseVisitor(v, 'walk', now / 1000, reduced);
    return;
  }
  walking = false;
  // Standing in a temple's trigger zone: always face the Buddha (never turn away from it).
  if (current) v.rotation.y = facingBuddhaYaw(current, v.position.x, v.position.z);
  updateView(v, world.camera);
  poseVisitor(v, current?.status === 'open' ? 'palms' : 'stand');
}

function toggleMap() {
  mapMode = !mapMode;
  const btn = document.getElementById('map-toggle');
  btn.textContent = mapMode ? 'Đóng' : 'Bản đồ';
  btn.setAttribute('aria-pressed', String(mapMode));
  labelsEl.classList.toggle('map-mode', mapMode); // smaller font in map mode
}

function updateCamera(delta) {
  const v = world.visitor;
  if (mapMode) {
    world.camera.position.lerp(MAP_CAM_POS, reduced ? 1 : 1 - Math.pow(.001, delta));
    world.camera.lookAt(MAP_CAM_TARGET);
  } else {
    const desired = v.position.clone().add(CAMERA_OFFSET);
    world.camera.position.lerp(desired, reduced ? 1 : 1 - Math.pow(.002, delta));
    world.camera.lookAt(v.position.x, 1.2, v.position.z - 5);
  }
}

function updatePanel() {
  const near = nearestTemple(world.visitor.position.x, world.visitor.position.z);
  if ((near?.id || null) === (current?.id || null)) return;
  current = near;
  panel.hidden = !near;
  if (!near) return;
  panelName.textContent = near.name;
  if (near.url) {
    panelState.textContent = 'Đang mở cửa';
    enterLink.href = ROOT_PREFIX + near.url;
    enterLink.hidden = false;
  } else {
    panelState.textContent = COMING_SOON_LABEL;
    enterLink.hidden = true;
    enterLink.removeAttribute('href');
  }
}

let previous = performance.now();
function frame(now) {
  const delta = Math.min(.04, (now - previous) / 1000);
  previous = now;
  moveVisitor(delta, now);
  updateCamera(delta);
  updateBillboards();
  updatePanel();
  world.render();
  updateLabels();
  window.__TOWN_STATE__ = { x: world.visitor.position.x, z: world.visitor.position.z, walking, temple: current?.id || null, href: enterLink.getAttribute('href') };
  requestAnimationFrame(frame);
}

boot();
