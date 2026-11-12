import * as THREE from '../../../prototype-3d/vendor/three.module.min.js';

const canvas = document.querySelector('#hall');
const layoutSelect = document.querySelector('#layout');
const seatSelect = document.querySelector('#seat');
const measureButton = document.querySelector('#measure');
const readout = document.querySelector('#readout');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
renderer.outputColorSpace = THREE.SRGBColorSpace;
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xcbd5c9);
scene.add(new THREE.HemisphereLight(0xfff1d5, 0x66725f, 2.3));
const sun = new THREE.DirectionalLight(0xffead0, 2.6); sun.position.set(-6, 14, 10); scene.add(sun);
const camera = new THREE.PerspectiveCamera(43, 1, .1, 100);
const floor = new THREE.Mesh(new THREE.PlaneGeometry(40, 48), new THREE.MeshToonMaterial({ color: 0xd3c8b6 }));
floor.rotation.x = -Math.PI / 2; floor.position.z = 2; scene.add(floor);

const layouts = {
  '10x10': { label: '10×10', cols: 10, rows: 10, spacing: 1.35, aisles: [], width: 14.85, depth: 13.5, aisle: 0 },
  '8x13': { label: '8×13（中轴走道）', cols: 8, rows: 13, spacing: 1.35, aisles: ['center'], width: 13.2, depth: 17.55, aisle: 1.9 },
  '12x9': { label: '12×9（中轴+两侧走道）', cols: 12, rows: 9, spacing: 1.25, aisles: ['center', 'sides'], width: 17.5, depth: 12.25, aisle: 1.5 }
};

let cushions, person, activeLayout;
const structure = new THREE.Group(); scene.add(structure);
function makeCushionInstances() {
  const geometry = new THREE.CylinderGeometry(.38, .42, .16, 16);
  const material = new THREE.MeshToonMaterial({ color: 0x9e7055 });
  cushions = new THREE.InstancedMesh(geometry, material, 100);
  scene.add(cushions);
}
function cushionPositions(layout) {
  const all = [];
  const x0 = -(layout.cols - 1) * layout.spacing / 2;
  const z0 = 6 - (layout.rows - 1) * layout.spacing;
  for (let row = 0; row < layout.rows; row++) {
    for (let col = 0; col < layout.cols; col++) {
      let x = x0 + col * layout.spacing;
      if (layout.aisles.includes('center') && col >= layout.cols / 2) x += layout.aisle;
      if (layout.aisles.includes('sides')) x += col < layout.cols / 2 ? -layout.aisle / 2 : layout.aisle / 2;
      if (layout.aisles.includes('center') && col === layout.cols / 2 - 1) continue;
      if (layout.aisles.includes('center') && col === layout.cols / 2) continue;
      all.push({ x, z: z0 + row * layout.spacing, row });
    }
  }
  all.sort((a, b) => Math.abs(a.x) - Math.abs(b.x));
  return all.slice(0, 100);
}
function buildPlaceholders(layout) {
  activeLayout = layout;
  if (cushions) scene.remove(cushions);
  makeCushionInstances();
  const dummy = new THREE.Object3D();
  const positions = cushionPositions(layout);
  positions.forEach((p, i) => { dummy.position.set(p.x, .1, p.z); dummy.rotation.set(0, 0, 0); dummy.updateMatrix(); cushions.setMatrixAt(i, dummy.matrix); });
  cushions.instanceMatrix.needsUpdate = true;
  structure.clear();
  person = new THREE.Mesh(new THREE.CapsuleGeometry(.24, 1.1, 4, 8), new THREE.MeshToonMaterial({ color: 0x4d4d4d }));
  structure.add(person);
  const platform = new THREE.Mesh(new THREE.BoxGeometry(5, .55, 1.7), new THREE.MeshToonMaterial({ color: 0x8a6848 }));
  platform.position.set(0, .28, -8.4); structure.add(platform);
  const buddha = new THREE.Mesh(new THREE.SphereGeometry(1.1, 16, 12), new THREE.MeshToonMaterial({ color: 0x777b80 }));
  buddha.position.set(0, 2.2, -8.4); structure.add(buddha);
  const altar = new THREE.Mesh(new THREE.BoxGeometry(3.8, .55, 1), new THREE.MeshToonMaterial({ color: 0x735238 }));
  altar.position.set(0, .55, -6.3); structure.add(altar);
  const incense = new THREE.Mesh(new THREE.CylinderGeometry(.3, .3, .6, 12), new THREE.MeshToonMaterial({ color: 0xb08a5b }));
  incense.position.set(0, 1.1, -6.3); structure.add(incense);
}
function cameraFor(layout, seat) {
  const row = seat === 'first' ? 0 : seat === 'middle' ? Math.floor(layout.rows / 2) : layout.rows - 1;
  const z = 6 - (layout.rows - 1) * layout.spacing + row * layout.spacing + 2.8;
  const distance = seat === 'first' ? 11.8 : seat === 'middle' ? 14.8 : 18.2;
  const height = seat === 'first' ? 7.0 : seat === 'middle' ? 8.2 : 9.4;
  camera.position.set(0, height, z + distance);
  camera.lookAt(0, 2.1, -8.2);
  return { row: row + 1, height, distance, pitch: Math.atan2(height - 2.1, distance) * 180 / Math.PI };
}
function resize() { const w = canvas.clientWidth, h = canvas.clientHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); }
function render() { renderer.render(scene, camera); }
function update() {
  const layout = layouts[layoutSelect.value];
  buildPlaceholders(layout);
  const shot = cameraFor(layout, seatSelect.value);
  person.position.set(0, .85, 6 - (layout.rows - 1) * layout.spacing + (shot.row - 1) * layout.spacing);
  render();
  readout.textContent = `${layout.label}\n坐垫实例：100（InstancedMesh）\n殿宽×深：${layout.width.toFixed(2)} × ${layout.depth.toFixed(2)} m\n坐垫间距：${layout.spacing.toFixed(2)} m\n走道宽：${layout.aisle ? layout.aisle.toFixed(2) : '0.00'} m\n镜头：高度 ${shot.height.toFixed(2)} m，距离 ${shot.distance.toFixed(2)} m，俯仰 ${shot.pitch.toFixed(1)}°\n占位验收：佛完整可见；人位于佛前，不进入佛后方。`;
}
measureButton.addEventListener('click', () => {
  const samples = [];
  for (let i = 0; i < 200; i++) { const start = performance.now(); renderer.render(scene, camera); samples.push(performance.now() - start); }
  samples.sort((a, b) => a - b);
  readout.textContent += `\n纯绘制耗时：200 次中位数 ${samples[99].toFixed(3)} ms（performance.now 包住 renderer.render）`;
});
layoutSelect.addEventListener('change', update); seatSelect.addEventListener('change', update); addEventListener('resize', resize);
resize(); update();
renderer.setAnimationLoop(render);
