import * as THREE from './vendor/three.bundle.min.js';
import { createTempleWorld } from './scene.js';
import { poseVisitor, setVisitorView } from './character.js';
import { canOccupy, nearestZone } from './logic.js';
import { createMetrics } from './metrics.js';

const canvas = document.querySelector('#scene');
const status = document.querySelector('#status');
const fallback = document.querySelector('#fallback');
const context = document.querySelector('#context-actions');
const contextLabel = document.querySelector('#context-label');
const hint = document.querySelector('#walk-hint');
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const params = new URLSearchParams(location.search);
let world;
let metrics;
let target = null;
let cameraDistance = 7.8;
let action = 'stand';
let actionStart = performance.now();
let walking = false;
const keys = new Set();
const pointer = { down: false, id: null, x: 0, y: 0, startX: 0, startY: 0, steer: 0, moved: false };
const touches = new Map();
const raycaster = new THREE.Raycaster();
const pointerNdc = new THREE.Vector2();
const ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const point = new THREE.Vector3();
const BUDDHA_POSITION = new THREE.Vector3(0, 3.5, -9.65);

function boot() {
  try {
    world = createTempleWorld(canvas);
    world.locals.forEach(local => { local.visible = params.get('locals') === '1'; });
    metrics = createMetrics(world.renderer);
    resize();
    addEventListener('resize', resize, { passive: true });
    bindControls();
    document.body.dataset.style = 'hd2d';
    status.classList.add('ready');
    window.__CHUAMAY_READY__ = true;
    requestAnimationFrame(frame);
  } catch (error) {
    console.error(error);
    status.hidden = true;
    fallback.hidden = false;
  }
}

function resize() {
  const dpr = Math.min(devicePixelRatio || 1, innerWidth < 500 ? 1.35 : 1.6);
  world.resize(innerWidth, innerHeight, dpr);
}

function bindControls() {
  addEventListener('keydown', event => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'w', 'a', 's', 'd'].includes(event.key)) { event.preventDefault(); keys.add(event.key.toLowerCase()); }
    if (!event.repeat && event.key.toLowerCase() === 'c') setAction(action === 'sit' ? 'stand' : 'sit');
    if (!event.repeat && event.key.toLowerCase() === 'p') setAction('palms');
    if (!event.repeat && event.key.toLowerCase() === 'b') setAction('bow');
  });
  addEventListener('keyup', event => keys.delete(event.key.toLowerCase()));
  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('pointercancel', onPointerUp);
  canvas.addEventListener('wheel', event => { cameraDistance = THREE.MathUtils.clamp(cameraDistance + Math.sign(event.deltaY) * .55, 5.2, 10.5); }, { passive: true });
  document.querySelectorAll('[data-action]').forEach(button => button.addEventListener('click', () => performContextAction(button.dataset.action)));
  const metricsButton = document.querySelector('#metrics-toggle');
  metricsButton.addEventListener('click', () => {
    const panel = document.querySelector('#metrics');
    panel.hidden = !panel.hidden;
    metricsButton.setAttribute('aria-expanded', String(!panel.hidden));
  });
  document.querySelector('#metrics-export').addEventListener('click', () => {
    const blob = new Blob([`${JSON.stringify(metrics.snapshot(), null, 2)}\n`], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `chuamay-hd2d-metrics-${new Date().toISOString().replaceAll(':', '-')}.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 0);
  });
  document.querySelectorAll('button').forEach(button => { button.disabled = false; });
}

function onPointerDown(event) {
  touches.set(event.pointerId, { x: event.clientX, y: event.clientY });
  if (touches.size === 1) {
    pointer.down = true; pointer.id = event.pointerId; pointer.x = pointer.startX = event.clientX; pointer.y = pointer.startY = event.clientY; pointer.steer = 0; pointer.moved = false;
    canvas.setPointerCapture(event.pointerId);
  }
}

function onPointerMove(event) {
  if (touches.has(event.pointerId)) touches.set(event.pointerId, { x: event.clientX, y: event.clientY });
  if (touches.size === 2) {
    const values = [...touches.values()];
    const distance = Math.hypot(values[0].x - values[1].x, values[0].y - values[1].y);
    if (pointer.pinch) cameraDistance = THREE.MathUtils.clamp(pointer.pinch.distance / distance * pointer.pinch.camera, 5.2, 10.5);
    else pointer.pinch = { distance, camera: cameraDistance };
    return;
  }
  if (!pointer.down || event.pointerId !== pointer.id) return;
  pointer.x = event.clientX; pointer.y = event.clientY;
  const dx = pointer.x - pointer.startX;
  const dy = pointer.y - pointer.startY;
  pointer.moved ||= Math.hypot(dx, dy) > 10;
  pointer.steer = THREE.MathUtils.clamp(dx / Math.max(120, innerWidth * .28), -1, 1);
}

function onPointerUp(event) {
  touches.delete(event.pointerId);
  if (touches.size < 2) pointer.pinch = null;
  if (event.pointerId !== pointer.id) return;
  if (!pointer.moved) setGroundTarget(event.clientX, event.clientY);
  pointer.down = false; pointer.id = null; pointer.steer = 0;
}

function setGroundTarget(clientX, clientY) {
  pointerNdc.set(clientX / innerWidth * 2 - 1, -(clientY / innerHeight) * 2 + 1);
  raycaster.setFromCamera(pointerNdc, world.camera);
  if (raycaster.ray.intersectPlane(ground, point) && canOccupy(point.x, point.z)) {
    target = new THREE.Vector3(point.x, 0, point.z);
    setAction('stand');
    hint.hidden = true;
  }
}

function setAction(next) {
  action = next;
  actionStart = performance.now();
  target = null;
  document.body.classList.toggle('ritual', ['incense', 'palms', 'bow', 'sit'].includes(next));
  if (next === 'palms' || next === 'bow' || next === 'incense' || next === 'sit') faceBuddha();
}

function faceBuddha() {
  const angle = Math.atan2(-world.visitor.position.x, -8.1 - world.visitor.position.z);
  world.visitor.rotation.y = angle;
}

function performContextAction(next) {
  document.body.classList.add('engaged');
  setAction(next === 'incense' ? 'palms' : next);
  if (!reduced) cameraDistance = Math.max(6.7, cameraDistance - .45);
}

function moveVisitor(delta, now) {
  const visitor = world.visitor;
  let turn = 0; let forward = 0;
  if (keys.has('arrowleft') || keys.has('a')) turn += 1;
  if (keys.has('arrowright') || keys.has('d')) turn -= 1;
  if (keys.has('arrowup') || keys.has('w')) forward += 1;
  if (keys.has('arrowdown') || keys.has('s')) forward -= .65;
  if (pointer.down && pointer.moved && touches.size === 1) { turn -= pointer.steer; forward = 1; }
  visitor.rotation.y += turn * delta * 1.55;
  let stepX = 0; let stepZ = 0;
  if (target) {
    const dx = target.x - visitor.position.x; const dz = target.z - visitor.position.z;
    const distance = Math.hypot(dx, dz);
    if (distance < .18) target = null;
    else { visitor.rotation.y = Math.atan2(dx, dz); stepX = dx / distance; stepZ = dz / distance; forward = 1; }
  }
  if (forward) {
    document.body.classList.add('engaged');
    if (!target) { stepX = Math.sin(visitor.rotation.y); stepZ = Math.cos(visitor.rotation.y); }
    const speed = 2.15 * delta * forward;
    const nx = visitor.position.x + stepX * speed; const nz = visitor.position.z + stepZ * speed;
    if (canOccupy(nx, visitor.position.z)) visitor.position.x = nx;
    if (canOccupy(visitor.position.x, nz)) visitor.position.z = nz;
    walking = true;
    poseVisitor(visitor, 'walk', now / 1000, reduced);
  } else {
    walking = false;
    const phase = (now - actionStart) / 1000;
    poseVisitor(visitor, action, phase, reduced);
  }
}

function updateCamera(delta) {
  const visitor = world.visitor;
  const behind = new THREE.Vector3(Math.sin(visitor.rotation.y), 0, Math.cos(visitor.rotation.y));
  const ritual = !walking && ['incense', 'palms', 'bow', 'sit'].includes(action);
  const toBuddha = BUDDHA_POSITION.clone().sub(visitor.position).setY(0).normalize();
  const side = new THREE.Vector3(-toBuddha.z, 0, toBuddha.x);
  const ritualDistance = Math.max(cameraDistance, action === 'bow' ? 9.2 : 8.9);
  const desired = ritual
    ? visitor.position.clone().addScaledVector(toBuddha, -ritualDistance * .25).addScaledVector(side, ritualDistance * .43).add(new THREE.Vector3(0, ritualDistance * .55, 0))
    : visitor.position.clone().addScaledVector(behind, -cameraDistance).add(new THREE.Vector3(cameraDistance * .3, cameraDistance * .68, 0));
  const fieldOfView = ritual ? 80 : 44;
  if (world.camera.fov !== fieldOfView) {
    world.camera.fov = fieldOfView;
    world.camera.updateProjectionMatrix();
  }
  const factor = reduced ? 1 : 1 - Math.pow(.001, delta);
  world.camera.position.lerp(desired, factor);
  const look = ritual
    ? visitor.position.clone().addScaledVector(toBuddha, 2.2).add(new THREE.Vector3(0, action === 'bow' ? 1.35 : 1.8, 0))
    : visitor.position.clone().add(new THREE.Vector3(0, 2.15, -1.8));
  world.camera.lookAt(look);
  setVisitorView(visitor, world.camera, ritual ? 'ritual' : 'free', BUDDHA_POSITION);
}

function updateContext() {
  const zone = nearestZone(world.visitor.position.x, world.visitor.position.z);
  context.hidden = !zone || action !== 'stand';
  if (!zone) return;
  contextLabel.textContent = zone.label;
  context.querySelectorAll('button').forEach(button => { button.hidden = !({ incense: ['incense'], cushion: ['sit'], buddha: ['palms', 'bow'] }[zone.id] || []).includes(button.dataset.action); });
}

let previous = performance.now();
function frame(now) {
  const delta = Math.min(.04, (now - previous) / 1000);
  previous = now;
  moveVisitor(delta, now);
  updateCamera(delta);
  updateContext();
  world.render();
  metrics.tick(now);
  window.__CHUAMAY_STATE__ = {
    style: 'hd2d',
    action: walking ? 'walk' : action,
    position: { x: world.visitor.position.x, z: world.visitor.position.z },
    visitorView: world.visitor.userData.rig.view,
    visitorFlip: world.visitor.userData.rig.frameFlip,
    zone: nearestZone(world.visitor.position.x, world.visitor.position.z)?.id || null,
    locals: world.locals.filter(local => local.visible).length
  };
  requestAnimationFrame(frame);
}

boot();
