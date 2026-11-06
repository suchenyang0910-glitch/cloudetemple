import * as THREE from './vendor/three.module.min.js';
import { createVisitor, poseVisitor } from './character.js';

export const STYLE_PRESETS = Object.freeze({
  soft: { sky: 0xcbd0c6, fog: 0xd8d8cd, ground: 0xb9b29f, stone: 0xa39d8c, wood: 0x66503b, roof: 0x5b5548, moss: 0x69725f, paper: 0xe9e2d4, ink: 0x45443d, edge: .56, grain: .055, saturation: .88 },
  ink: { sky: 0xbfc5bd, fog: 0xc8cbc3, ground: 0xaaa596, stone: 0x8f8c82, wood: 0x534336, roof: 0x45473f, moss: 0x596353, paper: 0xd9d3c7, ink: 0x292b28, edge: 1.08, grain: .1, saturation: .72 }
});

function gradientMap() {
  const data = new Uint8Array([40, 40, 40, 118, 118, 118, 210, 210, 210, 255, 255, 255]);
  const texture = new THREE.DataTexture(data, 4, 1, THREE.RedFormat);
  texture.needsUpdate = true;
  texture.minFilter = texture.magFilter = THREE.NearestFilter;
  return texture;
}

const toonRamp = gradientMap();

function material(color, opacity = 1) {
  return new THREE.MeshToonMaterial({ color, gradientMap: toonRamp, transparent: opacity < 1, opacity });
}

function addMesh(group, geometry, mat, position, rotation, scale, edgeColor = 0x45443d, edgeOpacity = .44) {
  const mesh = new THREE.Mesh(geometry, mat);
  mesh.position.set(...position);
  if (rotation) mesh.rotation.set(...rotation);
  if (scale) mesh.scale.set(...scale);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  group.add(mesh);
  if (edgeOpacity > 0) {
    const lines = new THREE.LineSegments(new THREE.EdgesGeometry(geometry, 32), new THREE.LineBasicMaterial({ color: edgeColor, transparent: true, opacity: edgeOpacity }));
    lines.position.copy(mesh.position);
    lines.rotation.copy(mesh.rotation);
    lines.scale.copy(mesh.scale);
    group.add(lines);
  }
  return mesh;
}

function createHall(style) {
  const hall = new THREE.Group();
  const wood = material(style.wood);
  const roof = material(style.roof);
  const stone = material(style.stone);
  addMesh(hall, new THREE.BoxGeometry(17, .42, 5.2), stone, [0, .2, -7.7]);
  addMesh(hall, new THREE.BoxGeometry(16.2, .3, 4.5), material(0x7e6d59), [0, .52, -7.65]);
  for (const x of [-7.1, -4.7, 4.7, 7.1]) addMesh(hall, new THREE.CylinderGeometry(.22, .28, 5.1, 8), wood, [x, 3, -6.05]);
  for (const x of [-7.1, 7.1]) addMesh(hall, new THREE.BoxGeometry(3.3, 4.8, .28), material(0x87735d), [x * .83, 2.9, -8.8]);
  addMesh(hall, new THREE.BoxGeometry(15.2, .34, .38), wood, [0, 5.35, -6.05]);
  const eave = addMesh(hall, new THREE.BoxGeometry(18.2, .34, 6.5), roof, [0, 5.62, -7.4], [0, 0, 0], [1, 1, 1]);
  eave.geometry.translate(0, 0, 0);
  addMesh(hall, new THREE.CylinderGeometry(0, 5.4, 2.05, 4), roof, [0, 6.25, -7.5], [0, Math.PI / 4, 0], [1.75, .55, .64]);
  addMesh(hall, new THREE.CylinderGeometry(0, 4.2, 1.5, 4), material(0x686255), [0, 6.92, -7.55], [0, Math.PI / 4, 0], [1.72, .52, .62]);

  addMesh(hall, new THREE.BoxGeometry(5.6, 1.05, 1.55), wood, [0, 1.18, -8.15]);
  addMesh(hall, new THREE.BoxGeometry(4.9, .18, 1.9), material(0x8b6847), [0, 1.76, -8.15]);
  const silhouette = new THREE.Group();
  const ink = material(style.ink, .82);
  addMesh(silhouette, new THREE.SphereGeometry(.58, 12, 9), ink, [0, 3.54, -8.3], null, [.82, 1, .78], style.ink, 0);
  addMesh(silhouette, new THREE.SphereGeometry(1.03, 12, 8), ink, [0, 2.68, -8.3], null, [1.38, .7, .7], style.ink, 0);
  addMesh(silhouette, new THREE.CylinderGeometry(1.45, 1.72, .34, 16), ink, [0, 2.05, -8.3], null, null, style.ink, 0);
  const halo = new THREE.Mesh(new THREE.RingGeometry(1.33, 1.4, 40), new THREE.MeshBasicMaterial({ color: 0xb59b67, transparent: true, opacity: .35, side: THREE.DoubleSide }));
  halo.position.set(0, 3.15, -8.48);
  hall.add(halo);
  hall.add(silhouette);

  const burner = new THREE.Group();
  addMesh(burner, new THREE.CylinderGeometry(.48, .58, .72, 12), material(0x685b4b), [0, 1.04, -5.86]);
  addMesh(burner, new THREE.TorusGeometry(.46, .09, 7, 16), material(0x766653), [0, 1.4, -5.86], [Math.PI / 2, 0, 0]);
  for (const x of [-.18, 0, .18]) addMesh(burner, new THREE.CylinderGeometry(.018, .018, 1.18, 5), material(0x6b4935), [x, 1.92, -5.86], null, null, style.ink, 0);
  hall.add(burner);

  for (const [x, z] of [[-2.7, -3.15], [0, -3.15], [2.7, -3.15], [-2.7, -1.35], [0, -1.35], [2.7, -1.35]]) {
    addMesh(hall, new THREE.CylinderGeometry(.62, .68, .15, 18), material(0x886c52), [x, .12, z]);
  }
  return hall;
}

function createCourtyard(style) {
  const yard = new THREE.Group();
  addMesh(yard, new THREE.PlaneGeometry(38, 40), material(style.ground), [0, -.03, 3], [-Math.PI / 2, 0, 0], null, style.ink, 0);
  for (let z = -3; z < 15; z += 1.7) addMesh(yard, new THREE.BoxGeometry(2.3 + Math.sin(z) * .2, .08, 1.1), material(style.stone), [0, .015, z], [0, Math.sin(z * 2) * .035, 0], null, style.ink, .18);
  const trunk = material(0x5b4837);
  addMesh(yard, new THREE.CylinderGeometry(.72, .98, 5.6, 9), trunk, [-6.6, 2.65, 6.25], [0, 0, -.08]);
  for (const p of [[-6.2, 5.5, 6.1, 1.8], [-7.35, 5.2, 6.1, 1.55], [-5.8, 4.5, 5.9, 1.6], [-7.1, 4.1, 5.7, 1.45]]) addMesh(yard, new THREE.IcosahedronGeometry(1, 1), material(style.moss), [p[0], p[1], p[2]], null, [p[3], p[3] * .78, p[3]], style.ink, .25);
  for (const x of [-5.8, 5.8]) {
    addMesh(yard, new THREE.BoxGeometry(.58, 1.15, .58), material(style.stone), [x, .58, 1.4]);
    addMesh(yard, new THREE.CylinderGeometry(.28, .4, .58, 6), material(0x96745b), [x, 1.44, 1.4]);
    addMesh(yard, new THREE.CylinderGeometry(0, .68, .58, 4), material(style.roof), [x, 2, 1.4], [0, Math.PI / 4, 0]);
  }
  for (const x of [-7.7, 7.7]) for (const z of [3, 7.6, 12]) addMesh(yard, new THREE.CylinderGeometry(.12, .15, 2.6, 7), material(0x6a5540), [x, 1.3, z]);
  return yard;
}

function createPostProcessor(renderer, width, height, style) {
  const target = new THREE.WebGLRenderTarget(width, height, { depthBuffer: true });
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const uniforms = {
    inputMap: { value: target.texture }, resolution: { value: new THREE.Vector2(width, height) },
    ink: { value: style.edge }, grain: { value: style.grain }, paper: { value: new THREE.Color(style.paper) }, time: { value: 0 }
  };
  const shader = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: `varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position,1.);}`,
    fragmentShader: `
      uniform sampler2D inputMap;uniform vec2 resolution;uniform float ink;uniform float grain;uniform vec3 paper;uniform float time;varying vec2 vUv;
      float luma(vec3 c){return dot(c,vec3(.299,.587,.114));}
      float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      void main(){
        vec2 px=1./resolution;vec3 c=texture2D(inputMap,vUv).rgb;
        float tl=luma(texture2D(inputMap,vUv+px*vec2(-1.,1.)).rgb),tc=luma(texture2D(inputMap,vUv+px*vec2(0.,1.)).rgb),tr=luma(texture2D(inputMap,vUv+px).rgb);
        float ml=luma(texture2D(inputMap,vUv+px*vec2(-1.,0.)).rgb),mr=luma(texture2D(inputMap,vUv+px*vec2(1.,0.)).rgb);
        float bl=luma(texture2D(inputMap,vUv+px*vec2(-1.,-1.)).rgb),bc=luma(texture2D(inputMap,vUv+px*vec2(0.,-1.)).rgb),br=luma(texture2D(inputMap,vUv-px).rgb);
        float gx=-tl-2.*ml-bl+tr+2.*mr+br,gy=tl+2.*tc+tr-bl-2.*bc-br;float edge=smoothstep(.09,.38,length(vec2(gx,gy))*ink);
        float fiber=(hash(floor(vUv*resolution/3.))+hash(vec2(vUv.y*840.,vUv.x*47.))*.5-.75)*grain;
        vec3 wash=mix(c,paper,.035+fiber);wash=mix(wash,vec3(.12,.115,.1),edge*.62);
        float vignette=smoothstep(.95,.25,distance(vUv,vec2(.5)));wash=mix(paper,wash,.88+.12*vignette);
        gl_FragColor=vec4(wash,1.);
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

export function createTempleWorld(canvas, styleName = 'soft') {
  const style = STYLE_PRESETS[styleName] || STYLE_PRESETS.soft;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = .94;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(style.sky);
  scene.fog = new THREE.FogExp2(style.fog, .026);
  const camera = new THREE.PerspectiveCamera(48, 1, .1, 80);
  camera.position.set(6.8, 5.2, 13.2);
  scene.add(new THREE.HemisphereLight(0xf2e9d8, 0x5c6357, 2.2));
  const sun = new THREE.DirectionalLight(0xffe3bb, 2.5);
  sun.position.set(-5, 12, 8);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.left = sun.shadow.camera.bottom = -15;
  sun.shadow.camera.right = sun.shadow.camera.top = 15;
  scene.add(sun);
  const world = new THREE.Group();
  world.add(createCourtyard(style), createHall(style));
  scene.add(world);
  const visitor = createVisitor();
  visitor.position.set(0, 0, 10.5);
  visitor.rotation.y = Math.PI;
  scene.add(visitor);
  const locals = [createVisitor({ ghost: true, hair: 'bun' }), createVisitor({ ghost: true })];
  locals[0].position.set(-3.8, 0, 2.1); locals[0].rotation.y = Math.PI;
  locals[1].position.set(3.8, 0, 2.1); locals[1].rotation.y = Math.PI;
  for (const local of locals) { poseVisitor(local, 'sit'); local.visible = false; scene.add(local); }
  let post = createPostProcessor(renderer, 1, 1, style);

  function resize(width, height, dpr) {
    renderer.setPixelRatio(dpr);
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    post.target.dispose();
    disposeGraph(post.scene);
    post = createPostProcessor(renderer, Math.floor(width * dpr), Math.floor(height * dpr), style);
  }
  function render(time) {
    post.uniforms.time.value = time;
    renderer.setRenderTarget(post.target);
    renderer.render(scene, camera);
    renderer._sceneStats = { triangles: renderer.info.render.triangles, calls: renderer.info.render.calls };
    renderer.setRenderTarget(null);
    renderer.render(post.scene, post.camera);
  }
  function dispose() { disposeGraph(scene); disposeGraph(post.scene); post.target.dispose(); renderer.dispose(); }
  return { renderer, scene, camera, visitor, locals, render, resize, dispose, styleName };
}
