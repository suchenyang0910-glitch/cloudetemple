import * as THREE from '../../../prototype-3d/vendor/three.module.min.js';
import { createVisitor } from './visitor.js';

const canvas = document.querySelector('#scene');
const metricsEl = document.querySelector('#metrics');
const labelsEl = document.querySelector('#labels');
const countEl = document.querySelector('#count');
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x829287);
scene.fog = new THREE.Fog(0x829287, 28, 105);
const camera = new THREE.PerspectiveCamera(52, 1, .1, 140);
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = false;
const clock = new THREE.Clock();
const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();
const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const hit = new THREE.Vector3();
const pointer = { down: false, moved: false, x: 0, y: 0, steer: 0 };
let visitor;
let closeStones;
let farStones;
let closeCount = 0;
let target = null;
let view = 'overview';
let sampleFrames = 0;
let sampleStart = performance.now();
let lastSample = null;

function resize() {
  renderer.setSize(innerWidth, innerHeight, false);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
}

function stoneGeometry(low = false) {
  return low ? new THREE.BoxGeometry(.7, 1.2, .18) : new THREE.BoxGeometry(.82, 1.8, .3);
}

function createArray(count) {
  if (closeStones) scene.remove(closeStones);
  if (farStones) scene.remove(farStones);
  closeStones?.geometry.dispose(); closeStones?.material.dispose();
  farStones?.geometry.dispose(); farStones?.material.dispose();
  const close = Math.ceil(count * .2);
  const far = count - close;
  const mat = new THREE.MeshLambertMaterial({ color: 0x8a7664 });
  const lowMat = new THREE.MeshLambertMaterial({ color: 0x5c6c62 });
  closeStones = new THREE.InstancedMesh(stoneGeometry(), mat, close);
  farStones = new THREE.InstancedMesh(stoneGeometry(true), lowMat, Math.max(far, 1));
  closeStones.instanceMatrix.setUsage(THREE.StaticDrawUsage);
  farStones.instanceMatrix.setUsage(THREE.StaticDrawUsage);
  const dummy = new THREE.Object3D();
  const cols = Math.ceil(Math.sqrt(count / 2));
  closeCount = close;
  for (let i = 0; i < count; i++) {
    const row = Math.floor(i / cols), col = i % cols;
    const x = (col - (cols - 1) / 2) * 1.55;
    const z = row * 2.25 - Math.ceil(count / cols) * 1.125;
    dummy.position.set(x, i < close ? .9 : .6, z);
    dummy.rotation.y = (i % 3 - 1) * .05;
    dummy.updateMatrix();
    (i < close ? closeStones : farStones).setMatrixAt(i < close ? i : i - close, dummy.matrix);
  }
  closeStones.instanceMatrix.needsUpdate = true; farStones.instanceMatrix.needsUpdate = true;
  scene.add(closeStones, farStones);
  updateLabels();
  resetSample();
}

function resetSample() { sampleFrames = 0; sampleStart = performance.now(); lastSample = null; }

function createWorld() {
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(90, 120), new THREE.MeshLambertMaterial({ color: 0xb4b49e }));
  ground.rotation.x = -Math.PI / 2; ground.name = 'walkable-ground'; scene.add(ground);
  scene.add(new THREE.HemisphereLight(0xe8f1dc, 0x3d5149, 2.4));
  const sun = new THREE.DirectionalLight(0xffe6c5, 2); sun.position.set(-10, 24, 16); scene.add(sun);
  visitor = createVisitor(); visitor.position.set(0, 0, 12); scene.add(visitor);
}

function setView(next) {
  view = next;
  if (next === 'overview') { camera.position.set(0, 42, 30); camera.lookAt(0, 0, -2); }
  if (next === 'walk') { camera.position.set(5, 5.4, 15); camera.lookAt(0, 1, 4); visitor.position.set(0, 0, 12); }
  if (next === 'close') { camera.position.set(2.8, 3.2, 4.8); camera.lookAt(0, 1.1, 0); visitor.position.set(0, 0, 5.4); }
  updateLabels();
}

function moveToPointer(event) {
  const rect = canvas.getBoundingClientRect();
  ndc.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
  raycaster.setFromCamera(ndc, camera);
  if (raycaster.ray.intersectPlane(groundPlane, hit)) target = hit.clone();
}

function updateVisitor(delta) {
  if (!target && !pointer.moved) return;
  if (pointer.moved) visitor.rotation.y -= pointer.steer * delta * 1.8;
  if (!target) return;
  const dx = target.x - visitor.position.x, dz = target.z - visitor.position.z;
  const distance = Math.hypot(dx, dz);
  if (distance < .18) { target = null; return; }
  visitor.rotation.y = Math.atan2(dx, dz);
  visitor.position.x += dx / distance * delta * 2.4;
  visitor.position.z += dz / distance * delta * 2.4;
}

function updateLabels() {
  labelsEl.replaceChildren();
  if (view !== 'close') return;
  const label = document.createElement('span'); label.className = 'label'; label.textContent = '碑面文字（占位）';
  const p = new THREE.Vector3(0, 1.9, 0).project(camera);
  label.style.left = `${(p.x + 1) * 50}%`; label.style.top = `${(1 - p.y) * 50}%`; labelsEl.append(label);
}

function updateMetrics() {
  sampleFrames++;
  if (sampleFrames < 120) return;
  const elapsed = performance.now() - sampleStart;
  const info = renderer.info;
  const resources = performance.getEntriesByType('resource');
  const transferBytes = resources.reduce((sum, entry) => sum + (entry.transferSize || entry.encodedBodySize || 0), 0);
  lastSample = { count: Number(countEl.value), drawCalls: info.render.calls, triangles: info.render.triangles, avgFrameMs: elapsed / sampleFrames, transferBytes, note: 'swiftshader/浏览器指标，仅用于方案比较，不等于真机' };
  metricsEl.textContent = `绘制调用 ${lastSample.drawCalls} · 三角面 ${lastSample.triangles}\n平均帧时 ${lastSample.avgFrameMs.toFixed(2)} ms · 首屏传输 ${lastSample.transferBytes} B`;
  window.__tombPerf = lastSample;
  resetSample();
}

function frame() {
  const delta = Math.min(clock.getDelta(), .05);
  updateVisitor(delta);
  renderer.render(scene, camera);
  updateMetrics();
  requestAnimationFrame(frame);
}

createWorld(); createArray(Number(countEl.value)); setView('overview'); resize();
addEventListener('resize', resize);
countEl.addEventListener('change', () => createArray(Number(countEl.value)));
document.querySelector('#reload').addEventListener('click', () => createArray(Number(countEl.value)));
document.querySelector('#overview').addEventListener('click', () => setView('overview'));
document.querySelector('#walk').addEventListener('click', () => setView('walk'));
document.querySelector('#close').addEventListener('click', () => setView('close'));
canvas.addEventListener('pointerdown', (event) => { pointer.down = true; pointer.moved = false; pointer.x = event.clientX; pointer.y = event.clientY; canvas.setPointerCapture(event.pointerId); });
canvas.addEventListener('pointermove', (event) => { if (!pointer.down) return; const dx = event.clientX - pointer.x; pointer.x = event.clientX; pointer.steer = Math.max(-1, Math.min(1, dx / 80)); pointer.moved = pointer.moved || Math.abs(dx) > 2; });
canvas.addEventListener('pointerup', (event) => { if (!pointer.moved) moveToPointer(event); pointer.down = false; pointer.moved = false; pointer.steer = 0; canvas.releasePointerCapture(event.pointerId); });
requestAnimationFrame(frame);
