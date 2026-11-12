import * as THREE from './vendor/three.module.min.js';
import { createVisitor, poseVisitor } from './character.js';


const STYLE = Object.freeze({
  sky: 0xd9ddd5, fog: 0xe3e1d8, paper: 0xeee7da, ink: 0x514a40,
  wood: 0xe1ceb6, stone: 0xc8ccc5, bronze: 0xb79a62, grain: .055
});
const loader = new THREE.TextureLoader();
const textures = new Map();

function loadTexture(path) {
  if (textures.has(path)) return textures.get(path);
  const texture = loader.load(path);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  texture.wrapS = texture.wrapT = THREE.ClampToEdgeWrapping;
  textures.set(path, texture);
  return texture;
}

function material(color, map = null, opacity = 1) {
  return new THREE.MeshToonMaterial({
    color, map, transparent: opacity < 1, opacity, alphaTest: opacity < 1 ? .02 : 0,
    side: THREE.FrontSide
  });
}

const outlineMaterial = new THREE.MeshBasicMaterial({ color: STYLE.ink, side: THREE.BackSide, transparent: true, opacity: .28 });

function addMesh(group, geometry, meshMaterial, position, rotation = null, scale = null, outline = true) {
  const mesh = new THREE.Mesh(geometry, meshMaterial);
  mesh.position.set(...position);
  if (rotation) mesh.rotation.set(...rotation);
  if (scale) mesh.scale.set(...scale);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  group.add(mesh);
  if (outline && !meshMaterial.transparent) {
    const edge = new THREE.Mesh(geometry, outlineMaterial);
    edge.position.copy(mesh.position);
    edge.rotation.copy(mesh.rotation);
    edge.scale.copy(mesh.scale).multiplyScalar(1.012);
    edge.renderOrder = -1;
    group.add(edge);
  }
  return mesh;
}

function addTexturedPlane(group, path, width, height, position, opacity = 1, rotation = null) {
  return addMesh(
    group,
    new THREE.PlaneGeometry(width, height),
    new THREE.MeshBasicMaterial({ map: loadTexture(path), transparent: opacity < 1, opacity, alphaTest: .025, side: THREE.DoubleSide, toneMapped: false }),
    position,
    rotation,
    null,
    false
  );
}

function lathe(profile, segments, meshMaterial) {
  return new THREE.Mesh(new THREE.LatheGeometry(profile.map(([x, y]) => new THREE.Vector2(x, y)), segments), meshMaterial);
}

function addLathe(group, profile, segments, meshMaterial, position, scale = 1) {
  const mesh = lathe(profile, segments, meshMaterial);
  mesh.position.set(...position);
  mesh.scale.setScalar(scale);
  mesh.castShadow = mesh.receiveShadow = true;
  group.add(mesh);
  const edge = new THREE.Mesh(mesh.geometry, outlineMaterial);
  edge.position.copy(mesh.position);
  edge.scale.copy(mesh.scale).multiplyScalar(1.018);
  group.add(edge);
  return mesh;
}

function createHall() {
  const hall = new THREE.Group();
  const woodMap = loadTexture('assets/scene/hall-roof.webp');
  const floorMap = loadTexture('assets/scene/hall-floor.webp');
  const floorCanvas = document.createElement('canvas');
  floorCanvas.width = floorCanvas.height = 512;
  const floorContext = floorCanvas.getContext('2d');
  floorContext.fillStyle = '#9b765d';
  floorContext.fillRect(0, 0, 512, 512);
  for (let row = 0; row < 8; row += 1) {
    floorContext.fillStyle = row % 2 ? 'rgba(236,211,180,.055)' : 'rgba(74,47,32,.035)';
    floorContext.fillRect(0, row * 64, 512, 64);
    floorContext.strokeStyle = 'rgba(63,42,29,.24)';
    floorContext.beginPath();
    floorContext.moveTo(0, row * 64);
    floorContext.lineTo(512, row * 64);
    floorContext.stroke();
    for (let x = row % 2 ? 64 : 0; x < 512; x += 128) {
      floorContext.beginPath();
      floorContext.moveTo(x, row * 64);
      floorContext.lineTo(x, row * 64 + 64);
      floorContext.stroke();
    }
  }
  const cleanFloorMap = new THREE.CanvasTexture(floorCanvas);
  cleanFloorMap.colorSpace = THREE.SRGBColorSpace;
  cleanFloorMap.wrapS = cleanFloorMap.wrapT = THREE.MirroredRepeatWrapping;
  cleanFloorMap.repeat.set(3, 4);
  const wood = material(STYLE.wood, woodMap);
  const stone = material(STYLE.stone, floorMap);

  addMesh(hall, new THREE.BoxGeometry(18, .32, 12.4), stone, [0, .08, -4.2], null, null, false);
  addMesh(hall, new THREE.PlaneGeometry(17.7, 12.1), new THREE.MeshBasicMaterial({ map: cleanFloorMap, toneMapped: false }), [0, .251, -4.2], [-Math.PI / 2, 0, 0], null, false);
  addMesh(hall, new THREE.PlaneGeometry(18.4, 6.5), new THREE.MeshBasicMaterial({ color: STYLE.paper }), [0, 3.25, -10.22], null, null, false);
  addTexturedPlane(hall, 'assets/scene/hall-wall.webp', 12.2, 6.3, [0, 3.25, -10.18]);
  addTexturedPlane(hall, 'assets/scene/hall-mountain-left.webp', 3.45, 6.1, [-7.65, 3.15, -10.17]);
  addTexturedPlane(hall, 'assets/scene/hall-mountain-right.webp', 3.45, 6.1, [7.65, 3.15, -10.17]);
  addTexturedPlane(hall, 'assets/scene/courtyard-mist.webp', 8.8, 7, [-8.95, 3.4, -5.8], 1, [0, Math.PI / 2, 0]);
  addTexturedPlane(hall, 'assets/scene/courtyard-mist.webp', 8.8, 7, [8.95, 3.4, -5.8], 1, [0, -Math.PI / 2, 0]);
  addTexturedPlane(hall, 'assets/scene/hall-roof.webp', 18.8, 7.1, [0, 6.28, -7.55], 1, [-Math.PI / 2, 0, 0]);

  const columnProfile = [[.35, 0], [.43, .1], [.46, .22], [.34, .34], [.25, .43], [.22, 5.25], [.27, 5.36]];
  for (const x of [-7.25, -4.65, 4.65, 7.25]) addLathe(hall, columnProfile, 12, wood, [x, .24, -6.75]);
  addMesh(hall, new THREE.BoxGeometry(16.2, .34, .46), wood, [0, 5.55, -6.76]);
  for (const x of [-7.1, -4.65, 4.65, 7.1]) addTexturedPlane(hall, 'assets/scene/cloud-bracket.webp', 1.9, 1.05, [x, 4.92, -6.5], .96);

  addMesh(hall, new THREE.BoxGeometry(4.8, .92, 1.45), wood, [0, 1.04, -9.12]);
  addTexturedPlane(hall, 'assets/scene/altar-table.webp', 4.5, 2.25, [0, 1.34, -8.36]);

  const bronze = material(STYLE.bronze);
  const burnerProfile = [[.26, 0], [.46, .08], [.58, .32], [.55, .64], [.4, .84], [.38, .96]];
  addLathe(hall, burnerProfile, 18, bronze, [0, 2.45, -8.08], .66);
  for (const x of [-.43, .43]) addMesh(hall, new THREE.TorusGeometry(.2, .055, 6, 16), bronze, [x, 2.91, -8.08], [0, Math.PI / 2, 0], null, false);
  for (const [x, z] of [[-.27, -.12], [.27, -.12], [0, .18]]) addMesh(hall, new THREE.CylinderGeometry(.045, .07, .3, 7), bronze, [x, 2.41, -8.08 + z], null, null, false);
  for (const x of [-.11, 0, .11]) addMesh(hall, new THREE.CylinderGeometry(.012, .015, .74, 5), material(0x8b5d42), [x, 3.4, -8.08], null, null, false);

  const lampProfile = [[.18, 0], [.28, .08], [.19, .18], [.17, .46], [.43, .58], [.31, .78], [.18, .86]];
  for (const x of [-1.9, 1.9]) addLathe(hall, lampProfile, 14, material(0x8a7254, loadTexture('assets/scene/lotus-oil-lamp.webp')), [x, 1.55, -8.85], .58);

  const weave = document.createElement('canvas');
  weave.width = weave.height = 256;
  const weaveContext = weave.getContext('2d');
  weaveContext.fillStyle = '#b8b39f';
  weaveContext.fillRect(0, 0, 256, 256);
  weaveContext.strokeStyle = 'rgba(107,91,59,.24)';
  weaveContext.lineWidth = 2;
  for (let radius = 18; radius < 128; radius += 11) {
    weaveContext.beginPath();
    weaveContext.arc(128, 128, radius, 0, Math.PI * 2);
    weaveContext.stroke();
  }
  weaveContext.strokeStyle = 'rgba(245,236,205,.28)';
  for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 18) {
    weaveContext.beginPath();
    weaveContext.moveTo(128, 128);
    weaveContext.lineTo(128 + Math.cos(angle) * 126, 128 + Math.sin(angle) * 126);
    weaveContext.stroke();
  }
  const weaveTexture = new THREE.CanvasTexture(weave);
  weaveTexture.colorSpace = THREE.SRGBColorSpace;
  const cushionTop = new THREE.MeshToonMaterial({ color: 0xc9c5b8, map: weaveTexture });
  const cushionSide = new THREE.MeshToonMaterial({ color: 0xa9a596 });
  for (const [x, z] of [[-2.7, -4], [0, -4], [2.7, -4], [-2.7, -2.15], [0, -2.15], [2.7, -2.15]]) {
    const cushion = new THREE.Mesh(new THREE.CylinderGeometry(.7, .72, .16, 32), [cushionSide, cushionTop, cushionSide]);
    cushion.position.set(x, .34, z);
    cushion.castShadow = cushion.receiveShadow = true;
    hall.add(cushion);
  }
  const seatStone = material(0xc5b79f, floorMap);
  addMesh(hall, new THREE.BoxGeometry(3.5, .3, 1.55), seatStone, [0, 1.72, -9.55]);
  addMesh(hall, new THREE.BoxGeometry(2.9, .27, 1.22), seatStone, [0, 2, -9.57]);
  addMesh(hall, new THREE.BoxGeometry(2.35, .24, .96), seatStone, [0, 2.25, -9.6]);
  addMesh(hall, new THREE.CylinderGeometry(1.05, 1.17, .22, 32), material(0xbca780), [0, 2.47, -9.61]);
  const silhouette = new THREE.MeshBasicMaterial({ color: 0xc8ad78, transparent: true, opacity: .7, depthWrite: false, side: THREE.DoubleSide });
  addMesh(hall, new THREE.CircleGeometry(1.58, 48), new THREE.MeshBasicMaterial({ color: 0xe1c77f, transparent: true, opacity: .12, depthWrite: false, side: THREE.DoubleSide }), [0, 3.82, -9.9], null, null, false);
  addMesh(hall, new THREE.RingGeometry(1.25, 1.31, 48), new THREE.MeshBasicMaterial({ color: 0xd4b66d, transparent: true, opacity: .42, depthWrite: false, side: THREE.DoubleSide }), [0, 3.88, -9.86], null, null, false);
  addMesh(hall, new THREE.CircleGeometry(.29, 32), silhouette, [0, 4.42, -9.82], null, null, false);
  addMesh(hall, new THREE.CircleGeometry(1, 40), silhouette, [0, 3.58, -9.82], null, [.58, .82, 1], false);
  addMesh(hall, new THREE.CircleGeometry(1, 40), silhouette, [-.48, 2.92, -9.81], null, [.72, .34, 1], false);
  addMesh(hall, new THREE.CircleGeometry(1, 40), silhouette, [.48, 2.92, -9.81], null, [.72, .34, 1], false);
  const haloLight = new THREE.PointLight(0xe5c77f, .85, 7, 2);
  haloLight.position.set(0, 3.9, -9.35);
  hall.add(haloLight);
  return hall;
}

function createCourtyard() {
  const yard = new THREE.Group();
  const floorMap = loadTexture('assets/scene/courtyard-floor.webp');
  floorMap.wrapS = floorMap.wrapT = THREE.MirroredRepeatWrapping;
  floorMap.repeat.set(1.15, 1.35);
  addMesh(yard, new THREE.PlaneGeometry(30, 28), material(0xb5beb9, floorMap), [0, -.02, 7], [-Math.PI / 2, 0, 0], null, false);
  addTexturedPlane(yard, 'assets/scene/courtyard-mist.webp', 15.2, 15, [-11.2, 6.5, 1.8], .82, [0, .35, 0]);
  addTexturedPlane(yard, 'assets/scene/courtyard-mist.webp', 15.2, 15, [11.2, 6.5, 1.8], .82, [0, -.35, 0]);
  const stone = material(0x929f9a);
  for (let z = -1; z < 15; z += 1.65) addMesh(yard, new THREE.BoxGeometry(2.55, .08, 1.02), stone, [0, .035, z], [0, Math.sin(z * 2.1) * .025, 0]);
  const trunk = material(0x6a5039, loadTexture('assets/scene/hall-roof.webp'));
  addLathe(yard, [[.78, 0], [.9, .3], [.72, 2.5], [.58, 5.8]], 10, trunk, [-6.8, 0, 7.2]);
  const leafTones = [material(0x71806d), material(0x82917b), material(0x657463)];
  let leafIndex = 0;
  for (const [x, y, z, s] of [[-6.4, 5.8, 7.1, 2], [-7.6, 5.4, 7, 1.7], [-5.5, 4.8, 6.8, 1.55], [-7.1, 4.2, 6.5, 1.6]]) {
    addMesh(yard, new THREE.IcosahedronGeometry(1, 1), leafTones[leafIndex++ % leafTones.length], [x, y, z], null, [s, s * .78, s], false);
  }
  return yard;
}

function createPostProcessor(renderer, width, height) {
  const target = new THREE.WebGLRenderTarget(width, height, { depthBuffer: true });
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const uniforms = { inputMap: { value: target.texture }, resolution: { value: new THREE.Vector2(width, height) }, paper: { value: new THREE.Color(STYLE.paper) }, grain: { value: STYLE.grain } };
  const shader = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: 'varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position,1.);}',
    fragmentShader: `
      uniform sampler2D inputMap;uniform vec2 resolution;uniform vec3 paper;uniform float grain;varying vec2 vUv;
      float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      void main(){
        vec3 c=texture2D(inputMap,vUv).rgb;
        float fiber=(hash(floor(vUv*resolution/3.))+hash(vec2(vUv.y*840.,vUv.x*47.))*.5-.75)*grain;
        c=mix(c,paper,.028+fiber);
        float mist=smoothstep(.92,.2,distance(vUv,vec2(.5,.53)));
        c=mix(paper,c,.9+.1*mist);
        gl_FragColor=vec4(c,1.);
      }`
  });
  scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), shader));
  return { target, scene, camera, uniforms };
}

function disposeGraph(root) {
  root.traverse(object => {
    object.geometry?.dispose();
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    materials.filter(Boolean).forEach(item => item.dispose());
  });
}

export function createTempleWorld(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(STYLE.sky);
  scene.fog = new THREE.FogExp2(STYLE.fog, .018);
  const camera = new THREE.PerspectiveCamera(44, 1, .1, 80);
  camera.position.set(7.4, 6.2, 14.5);
  scene.add(new THREE.HemisphereLight(0xfff4df, 0x7d8178, 2.75));
  const sun = new THREE.DirectionalLight(0xffe8c7, 2.35);
  sun.position.set(-5, 12, 8);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.left = sun.shadow.camera.bottom = -15;
  sun.shadow.camera.right = sun.shadow.camera.top = 15;
  scene.add(sun);
  const world = new THREE.Group();
  world.add(createCourtyard(), createHall());
  scene.add(world);
  const visitor = createVisitor();
  visitor.position.set(0, 0, 10.5);
  visitor.rotation.y = Math.PI;
  scene.add(visitor);
  const locals = [createVisitor({ ghost: true }), createVisitor({ ghost: true })];
  locals[0].position.set(-3.8, .01, 2.1); locals[1].position.set(3.8, .01, 2.1);
  for (const local of locals) { poseVisitor(local, 'sit'); local.visible = false; scene.add(local); }
  let post = createPostProcessor(renderer, 1, 1);

  function resize(width, height, dpr) {
    renderer.setPixelRatio(dpr);
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    post.target.dispose();
    disposeGraph(post.scene);
    post = createPostProcessor(renderer, Math.floor(width * dpr), Math.floor(height * dpr));
  }
  function render() {
    renderer.setRenderTarget(post.target);
    renderer.render(scene, camera);
    renderer._sceneStats = { triangles: renderer.info.render.triangles, calls: renderer.info.render.calls };
    renderer.setRenderTarget(null);
    renderer.render(post.scene, post.camera);
  }
  function dispose() { disposeGraph(scene); disposeGraph(post.scene); post.target.dispose(); renderer.dispose(); }
  return { renderer, scene, camera, visitor, locals, render, resize, dispose, styleName: 'hd2d' };
}
