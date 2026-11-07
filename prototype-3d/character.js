import * as THREE from './vendor/three.module.min.js';


const loader = new THREE.TextureLoader();
const FRAME_NAMES = [
  'stand-front', 'stand-side', 'stand-back', 'walk-side-1', 'walk-side-2',
  'walk-back-1', 'walk-back-2', 'palms', 'bow-1', 'bow-2', 'bow-3', 'sit', 'sit-side'
];
const FRAMES = Object.fromEntries(FRAME_NAMES.map(name => {
  const texture = loader.load(`assets/visitor/${name}.webp`);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  return [name, texture];
}));
const FLIPPED_FRAMES = Object.fromEntries(Object.entries(FRAMES).map(([name, texture]) => {
  const flipped = texture.clone();
  flipped.wrapS = THREE.RepeatWrapping;
  flipped.repeat.x = -1;
  flipped.offset.x = 1;
  flipped.needsUpdate = true;
  return [name, flipped];
}));

function shadowTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 128; canvas.height = 64;
  const context = canvas.getContext('2d');
  const gradient = context.createRadialGradient(64, 32, 2, 64, 32, 58);
  gradient.addColorStop(0, 'rgba(45,35,25,.34)');
  gradient.addColorStop(.62, 'rgba(45,35,25,.15)');
  gradient.addColorStop(1, 'rgba(45,35,25,0)');
  context.fillStyle = gradient;
  context.fillRect(0, 0, 128, 64);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

const SHADOW = shadowTexture();

function setFrame(visitor, name, flip = false) {
  const rig = visitor.userData.rig;
  if (rig.frame !== name || rig.frameFlip !== flip) {
    rig.sprite.material.map = flip ? FLIPPED_FRAMES[name] : FRAMES[name];
    rig.sprite.material.needsUpdate = true;
    rig.frame = name;
    rig.frameFlip = flip;
  }
  rig.sprite.scale.x = rig.size;
}

export function createVisitor({ ghost = false } = {}) {
  const group = new THREE.Group();
  const opacity = ghost ? .3 : 1;
  const material = new THREE.SpriteMaterial({
    map: FRAMES['stand-back'], transparent: true, opacity, alphaTest: .025,
    depthWrite: false, toneMapped: false
  });
  const sprite = new THREE.Sprite(material);
  const size = ghost ? 2.6 : 2.85;
  sprite.scale.set(size, size, 1);
  sprite.position.y = size * .5 - .02;
  sprite.renderOrder = 3;
  group.add(sprite);

  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(1.42, .72),
    new THREE.MeshBasicMaterial({ map: SHADOW, transparent: true, depthWrite: false, opacity: ghost ? .12 : .48 })
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = .012;
  shadow.renderOrder = 2;
  group.add(shadow);
  group.userData.rig = { sprite, shadow, size, frame: 'stand-back', frameFlip: false, view: 'back', flip: false, state: 'stand' };
  return group;
}

export function setVisitorView(visitor, camera, mode = 'free', buddha = null) {
  const rig = visitor.userData.rig;
  if (mode === 'ritual' && buddha) {
    const visitorScreen = visitor.position.clone().add(new THREE.Vector3(0, 1.3, 0)).project(camera);
    const buddhaScreen = buddha.clone().project(camera);
    rig.view = 'side';
    rig.flip = buddhaScreen.x > visitorScreen.x;
    return;
  }
  const forward = new THREE.Vector3(Math.sin(visitor.rotation.y), 0, Math.cos(visitor.rotation.y));
  const toCamera = camera.position.clone().sub(visitor.position).setY(0).normalize();
  const facing = forward.dot(toCamera);
  if (facing < -.58) rig.view = 'back';
  else if (facing > .58) rig.view = 'front';
  else rig.view = 'side';
  rig.flip = forward.x * toCamera.z - forward.z * toCamera.x < 0;
}

export function poseVisitor(visitor, state, phase = 0, reduced = false) {
  const rig = visitor.userData.rig;
  rig.state = state;
  rig.sprite.position.y = rig.size * .5 - .02;
  rig.shadow.scale.set(1, 1, 1);

  if (state === 'walk') {
    const step = reduced ? 1 : Math.floor(phase * 5.5) % 2 + 1;
    if (rig.view === 'back') setFrame(visitor, `walk-back-${step}`);
    else if (rig.view === 'side') setFrame(visitor, `walk-side-${step}`, rig.flip);
    else setFrame(visitor, 'stand-front');
    if (!reduced) rig.sprite.position.y += Math.abs(Math.sin(phase * Math.PI * 5.5)) * .035;
    return;
  }
  if (state === 'sit') { setFrame(visitor, 'sit-side', rig.flip); rig.shadow.scale.set(1.18, 1.18, 1); return; }
  if (state === 'palms' || state === 'incense') { setFrame(visitor, 'palms', rig.flip); return; }
  if (state === 'bow') {
    const cycle = reduced ? 3.2 : phase % 3.6;
    if (cycle < .55) setFrame(visitor, 'palms', rig.flip);
    else if (cycle < 1.15) setFrame(visitor, 'bow-1', rig.flip);
    else if (cycle < 1.75) setFrame(visitor, 'bow-2', rig.flip);
    else if (cycle < 2.45) setFrame(visitor, 'bow-3', rig.flip);
    else if (cycle < 3.05) setFrame(visitor, 'bow-2', rig.flip);
    else setFrame(visitor, 'bow-1', rig.flip);
    return;
  }
  const name = rig.view === 'back' ? 'stand-back' : rig.view === 'side' ? 'stand-side' : 'stand-front';
  setFrame(visitor, name, rig.view === 'side' && rig.flip);
}
