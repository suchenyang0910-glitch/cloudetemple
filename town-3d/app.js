import * as THREE from '../prototype-3d/vendor/three.module.min.js';
import { createTownWorld } from './scene.js';
import { poseVisitor, updateView } from './character.js';
import { TEMPLES, canOccupy, nearestTemple, facingBuddhaYaw, COMING_SOON_LABEL } from './logic.js';
import { placeForTemple } from './places.js';
import { stepWalking, updateFollowCamera, updateBillboards, updateLabels } from './shared.js';

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
const mapSheet = document.querySelector('#map-sheet');
const mapGrid = document.querySelector('#map-grid');
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
// label divs keyed by temple id — created once in initLabels()
const labelDivs = {};

let world;
let target = null;
let walking = false;
let current = null;
let activePlace = null;
const keys = new Set();
const pointer = { down: false, id: null, startX: 0, startY: 0, steer: 0, moved: false };
const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();
const ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const hit = new THREE.Vector3();
// Pulled back enough to show ≥3 temples at once at FOV 58°.
const CAMERA_OFFSET = new THREE.Vector3(1.6, 13, 14);
const MAP_CAM_POS = new THREE.Vector3(0, 80, 2);  // pull back so every billboard and label clears the phone edges
const MAP_CAM_TARGET = new THREE.Vector3(0, 0, 2);
let mapMode = false;

function initLabels() {
  for (const t of TEMPLES) {
    const div = document.createElement('div');
    div.className = `temple-label ${t.status === 'open' ? 'is-open' : 'is-coming'}`;
    div.dataset.id = t.id;
      div.innerHTML = `<span class="label-name">${t.mapName || t.name}</span>` +
      (t.status !== 'open' ? `<span class="label-status">${COMING_SOON_LABEL}</span>` : '');
    labelsEl.appendChild(div);
    labelDivs[t.id] = div;
  }
}

function nearestMapTemple() {
  const v = world.visitor.position;
  return TEMPLES.reduce((near, t) => Math.hypot(v.x - t.x, v.z - t.z) < Math.hypot(v.x - near.x, v.z - near.z) ? t : near, TEMPLES[0]);
}

function initMapSheet() {
  for (const t of TEMPLES) {
    const card = document.createElement('button');
    card.type = 'button'; card.className = `map-card ${t.status === 'open' ? 'is-open' : 'is-coming'}`;
    card.dataset.id = t.id;
    const image = document.createElement('span'); image.className = 'map-card-image';
    image.style.backgroundImage = `url("./assets/exterior-${t.id}-day.webp")`;
    if (t.id === 'namtong') image.classList.add('is-placeholder');
    const name = document.createElement('span'); name.className = 'map-card-name'; name.textContent = t.name;
    card.append(image, name);
    if (t.status !== 'open') { const badge = document.createElement('small'); badge.textContent = 'Sắp mở'; card.append(badge); }
    card.addEventListener('click', () => { if (t.status !== 'open') return; target = new THREE.Vector3(t.x, 0, t.z + 3); toggleMap(); });
    mapGrid.append(card);
  }
}

function updateMapSheet() {
  const near = nearestMapTemple();
  for (const card of mapGrid.children) card.classList.toggle('is-current', card.dataset.id === near.id);
}

function boot() {
  try {
    if (new URLSearchParams(location.search).get('mode') === '2d') throw new Error('2d-requested');
    world = createTownWorld(canvas);
    resize();
    addEventListener('resize', resize, { passive: true });
    bindControls();
    initLabels();
    initMapSheet();
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
  const step = stepWalking({ visitor: v, keys, pointer, target, delta, canOccupy });
  target = step.target;
  walking = step.walking;
  if (walking) {
    hint.hidden = true;
    updateView(v, world.camera);
    poseVisitor(v, 'walk', now / 1000, reduced);
    return;
  }
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
  labelsEl.classList.toggle('map-mode', mapMode);
  mapSheet.hidden = !mapMode;
  mapSheet.classList.toggle('is-visible', mapMode);
  if (mapMode) updateMapSheet();
  // Map camera is at y=55; billboards are ~49 units away → inside near=30 fog.
  // Push fog far so all 7 temples appear full-color from above.
  world.scene.fog.near = mapMode ? 200 : 30;
  world.scene.fog.far  = mapMode ? 400 : 65;
}

function updatePanel() {
  const near = nearestTemple(world.visitor.position.x, world.visitor.position.z);
  const nextPlace = placeForTemple(near?.id);
  if (activePlace !== nextPlace) {
    activePlace?.leave({ world, temple: current });
    activePlace = nextPlace;
    activePlace?.enter({ world, temple: near });
  }
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
  updateFollowCamera({ world, delta, reduced, mapMode, cameraOffset: CAMERA_OFFSET, mapPosition: MAP_CAM_POS, mapTarget: MAP_CAM_TARGET });
  updateBillboards(world.billboards, world.camera, mapMode);
  updatePanel();
  if (mapMode) updateMapSheet();
  activePlace?.update({ world, temple: current, delta, now });
  world.render();
  updateLabels({ world, temples: TEMPLES, labelDivs, mapMode });
  window.__TOWN_STATE__ = { x: world.visitor.position.x, z: world.visitor.position.z, walking, temple: current?.id || null, href: enterLink.getAttribute('href') };
  requestAnimationFrame(frame);
}

boot();
