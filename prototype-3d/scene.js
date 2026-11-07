import * as THREE from './vendor/three.module.min.js';
import { createVisitor, poseVisitor } from './character.js';


const STYLE = Object.freeze({
  sky: 0xc7ccc2, fog: 0xd8d7cb, paper: 0xe8e0d1, ink: 0x3d3933,
  wood: 0x71583f, stone: 0xaaa392, bronze: 0x786650, grain: .065
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

const outlineMaterial = new THREE.MeshBasicMaterial({ color: STYLE.ink, side: THREE.BackSide, transparent: true, opacity: .42 });

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
  const wood = material(STYLE.wood, woodMap);
  const stone = material(STYLE.stone, floorMap);

  addMesh(hall, new THREE.BoxGeometry(18, .32, 8.4), stone, [0, .08, -6.2], null, null, false);
  addTexturedPlane(hall, 'assets/scene/hall-floor.webp', 17.7, 8.1, [0, .251, -6.2], 1, [-Math.PI / 2, 0, 0]);
  addTexturedPlane(hall, 'assets/scene/hall-wall.webp', 11.8, 6.3, [0, 3.25, -10.15]);
  addTexturedPlane(hall, 'assets/scene/hall-mountain-left.webp', 3.2, 6.1, [-7.5, 3.15, -9.96]);
  addTexturedPlane(hall, 'assets/scene/hall-mountain-right.webp', 3.2, 6.1, [7.5, 3.15, -9.96]);
  addTexturedPlane(hall, 'assets/scene/hall-roof.webp', 18.8, 7.1, [0, 6.28, -7.55], 1, [-Math.PI / 2, 0, 0]);

  const columnProfile = [[.35, 0], [.43, .1], [.46, .22], [.34, .34], [.25, .43], [.22, 5.25], [.27, 5.36]];
  for (const x of [-7.25, -4.65, 4.65, 7.25]) addLathe(hall, columnProfile, 12, wood, [x, .24, -6.75]);
  addMesh(hall, new THREE.BoxGeometry(16.2, .34, .46), wood, [0, 5.55, -6.76]);
  for (const x of [-7.1, -4.65, 4.65, 7.1]) addTexturedPlane(hall, 'assets/scene/cloud-bracket.webp', 1.9, 1.05, [x, 4.92, -6.5], .96);

  addMesh(hall, new THREE.BoxGeometry(4.8, .92, 1.45), wood, [0, 1.04, -9.12]);
  addTexturedPlane(hall, 'assets/scene/altar-table.webp', 4.5, 2.25, [0, 1.34, -8.36]);

  const burnerProfile = [[.24, 0], [.45, .08], [.56, .3], [.53, .62], [.38, .83], [.36, .95]];
  addLathe(hall, burnerProfile, 16, material(STYLE.bronze, loadTexture('assets/scene/incense-burner.webp')), [0, .28, -6.48], .58);
  for (const x of [-.1, 0, .1]) addMesh(hall, new THREE.CylinderGeometry(.01, .013, .78, 5), material(0x75503a), [x, 1.03, -6.48], null, null, false);

  const lampProfile = [[.18, 0], [.28, .08], [.19, .18], [.17, .46], [.43, .58], [.31, .78], [.18, .86]];
  for (const x of [-1.9, 1.9]) addLathe(hall, lampProfile, 14, material(0x8a7254, loadTexture('assets/scene/lotus-oil-lamp.webp')), [x, 1.55, -8.85], .58);

  const cushion = material(0xb59b78, loadTexture('assets/scene/meditation-cushion.webp'));
  for (const [x, z] of [[-2.7, -4], [0, -4], [2.7, -4], [-2.7, -2.15], [0, -2.15], [2.7, -2.15]]) {
    addMesh(hall, new THREE.CylinderGeometry(.65, .72, .16, 24), cushion, [x, .34, z]);
  }
  const silhouette = new THREE.MeshBasicMaterial({ color: STYLE.ink, transparent: true, opacity: .56, depthWrite: false, side: THREE.DoubleSide });
  addMesh(hall, new THREE.RingGeometry(1.25, 1.31, 48), new THREE.MeshBasicMaterial({ color: 0xb79b62, transparent: true, opacity: .25, depthWrite: false, side: THREE.DoubleSide }), [0, 4.15, -9.86], null, null, false);
  addMesh(hall, new THREE.CircleGeometry(.34, 32), silhouette, [0, 5.05, -9.84], null, null, false);
  addMesh(hall, new THREE.CircleGeometry(1, 40), silhouette, [0, 4.08, -9.84], null, [.86, 1.12, 1], false);
  addMesh(hall, new THREE.CircleGeometry(1, 40), silhouette, [0, 3.28, -9.83], null, [1.36, .5, 1], false);
  return hall;
}

function createCourtyard() {
  const yard = new THREE.Group();
  const floorMap = loadTexture('assets/scene/courtyard-floor.webp');
  floorMap.wrapS = floorMap.wrapT = THREE.MirroredRepeatWrapping;
  floorMap.repeat.set(1.35, 1.8);
  addMesh(yard, new THREE.PlaneGeometry(30, 28), material(0xffffff, floorMap), [0, -.02, 7], [-Math.PI / 2, 0, 0], null, false);
  addTexturedPlane(yard, 'assets/scene/courtyard-mist.webp', 17, 16.8, [-11.8, 6.6, 2], .7, [0, .45, 0]);
  addTexturedPlane(yard, 'assets/scene/courtyard-mist.webp', 17, 16.8, [11.8, 6.6, 2], .7, [0, -.45, 0]);
  const stone = material(STYLE.stone, loadTexture('assets/scene/column-stone-base.webp'));
  for (let z = -1; z < 15; z += 1.65) addMesh(yard, new THREE.BoxGeometry(2.55, .08, 1.02), stone, [0, .035, z], [0, Math.sin(z * 2.1) * .025, 0]);
  const trunk = material(0x6a5039, loadTexture('assets/scene/hall-roof.webp'));
  addLathe(yard, [[.78, 0], [.9, .3], [.72, 2.5], [.58, 5.8]], 10, trunk, [-6.8, 0, 7.2]);
  const leaves = material(0x66705c, loadTexture('assets/scene/courtyard-mist.webp'), .92);
  for (const [x, y, z, s] of [[-6.4, 5.8, 7.1, 2], [-7.6, 5.4, 7, 1.7], [-5.5, 4.8, 6.8, 1.55], [-7.1, 4.2, 6.5, 1.6]]) {
    addMesh(yard, new THREE.IcosahedronGeometry(1, 1), leaves, [x, y, z], null, [s, s * .72, s], false);
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
  renderer.toneMappingExposure = .9;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(STYLE.sky);
  scene.fog = new THREE.FogExp2(STYLE.fog, .018);
  const camera = new THREE.PerspectiveCamera(44, 1, .1, 80);
  camera.position.set(7.4, 6.2, 14.5);
  scene.add(new THREE.HemisphereLight(0xf3ead9, 0x5c6258, 2.45));
  const sun = new THREE.DirectionalLight(0xffe2b7, 2.25);
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
