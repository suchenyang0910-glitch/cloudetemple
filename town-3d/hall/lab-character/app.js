import * as THREE from '../../../prototype-3d/vendor/three.module.min.js';

const canvas = document.querySelector('#view'), readout = document.querySelector('#readout');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' }); renderer.outputColorSpace = THREE.SRGBColorSpace;
const scene = new THREE.Scene(); scene.background = new THREE.Color(0xcbd5c9); scene.add(new THREE.HemisphereLight(0xfff1d5, 0x66725f, 2.6)); const light = new THREE.DirectionalLight(0xffead0, 2); light.position.set(-4, 8, 6); scene.add(light);
const camera = new THREE.PerspectiveCamera(35, 1, .1, 30); camera.position.set(0, 2.8, 8); camera.lookAt(0, 1.3, 0);
const ground = new THREE.Mesh(new THREE.PlaneGeometry(10, 10), new THREE.MeshToonMaterial({ color: 0xd3c8b6 })); ground.rotation.x = -Math.PI / 2; scene.add(ground);
const paperTexture = new THREE.TextureLoader().load('./assets/paper-bun-light.webp'); const paper = new THREE.Sprite(new THREE.SpriteMaterial({ map: paperTexture, transparent: true, depthWrite: false })); paper.scale.set(1.6, 2.4, 1); paper.position.set(1.05, 1.35, 0); scene.add(paper);
const model = new THREE.Group(); model.position.x = -.95; scene.add(model);
const skin = new THREE.MeshToonMaterial({ color: 0xb98263 }), shirt = new THREE.MeshToonMaterial({ color: 0xe4d8c2 }), pants = new THREE.MeshToonMaterial({ color: 0x4d4038 }), hair = new THREE.MeshToonMaterial({ color: 0x403b38 });
function mesh(geometry, material, x, y, z) { const m = new THREE.Mesh(geometry, material); m.position.set(x, y, z); model.add(m); return m; }
const torso = mesh(new THREE.CapsuleGeometry(.34, .62, 4, 8), shirt, 0, 1.23, 0); const head = mesh(new THREE.SphereGeometry(.25, 12, 8), skin, 0, 1.98, 0); const bun = mesh(new THREE.SphereGeometry(.17, 10, 6), hair, 0, 2.2, -.12);
const leftLeg = mesh(new THREE.CapsuleGeometry(.13, .66, 4, 6), pants, -.18, .55, 0), rightLeg = mesh(new THREE.CapsuleGeometry(.13, .66, 4, 6), pants, .18, .55, 0);
const leftArm = mesh(new THREE.CapsuleGeometry(.1, .52, 4, 6), shirt, -.43, 1.35, 0), rightArm = mesh(new THREE.CapsuleGeometry(.1, .52, 4, 6), shirt, .43, 1.35, 0);
const hands = [mesh(new THREE.SphereGeometry(.1, 8, 6), skin, -.43, 1.03, .02), mesh(new THREE.SphereGeometry(.1, 8, 6), skin, .43, 1.03, .02)];
const incense = [0, .07, .14].map(x => mesh(new THREE.CylinderGeometry(.018, .018, .6, 6), new THREE.MeshToonMaterial({ color: 0x7f4d2c }), x - .07, 1.6, .28));
let mode = 'front', phase = 0, last = performance.now();
function setMode(next) { mode = next; document.querySelectorAll('button').forEach(b => b.classList.toggle('active', b.dataset.mode === mode)); }
document.querySelectorAll('button[data-mode]').forEach(b => b.onclick = () => setMode(b.dataset.mode));
function animate(now) { const dt = Math.min(.04, (now - last) / 1000); last = now; phase += dt; const walk = mode === 'walk'; const palms = mode === 'palms' || mode === 'incense'; model.rotation.y = mode === 'side' ? Math.PI / 2 : mode === 'back' ? Math.PI : 0; leftLeg.rotation.x = walk ? Math.sin(phase * 8) * .55 : 0; rightLeg.rotation.x = walk ? -Math.sin(phase * 8) * .55 : 0; leftArm.rotation.z = palms ? -.65 : walk ? Math.sin(phase * 8) * .15 : 0; rightArm.rotation.z = palms ? .65 : walk ? -Math.sin(phase * 8) * .15 : 0; hands[0].position.set(palms ? -.12 : -.43, palms ? 1.55 : 1.03, palms ? .2 : .02); hands[1].position.set(palms ? .12 : .43, palms ? 1.55 : 1.03, palms ? .2 : .02); incense.forEach((m, i) => { m.visible = mode === 'incense'; m.rotation.z = .08; m.position.y = 1.8; m.position.z = .28; }); renderer.render(scene, camera); requestAnimationFrame(animate); }
function resize() { renderer.setSize(canvas.clientWidth, canvas.clientHeight, false); camera.aspect = canvas.clientWidth / canvas.clientHeight; camera.updateProjectionMatrix(); }
addEventListener('resize', resize); resize(); setMode('front'); readout.textContent = '3D 模型：约 1.6m 高，低面数平涂几何\n动画：走路循环 / 站立 / 合掌 / 持三炷香拜\n纸片对照：visitor-bun-light-inc-hold-v1.webp'; requestAnimationFrame(animate);
window.__CHARACTER_STATE__ = () => ({ mode, triangles: renderer.info.render.triangles, calls: renderer.info.render.calls });
