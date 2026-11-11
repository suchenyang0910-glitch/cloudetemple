import * as THREE from '../prototype-3d/vendor/three.module.min.js';

const loader = new THREE.TextureLoader();
const names = ['stand-front', 'stand-side', 'stand-back', 'walk-side-1', 'walk-side-2', 'walk-back-1', 'walk-back-2', 'palms'];
const frames = Object.fromEntries(names.map(name => {
  const texture = loader.load(`../prototype-3d/assets/visitor/${name}.webp`);
  texture.colorSpace = THREE.SRGBColorSpace;
  return [name, texture];
}));
const palmsBack = loader.load('./assets/visitor/palms-back.webp');
palmsBack.colorSpace = THREE.SRGBColorSpace;
frames['palms-back'] = palmsBack;
function setFrame(visitor, name, flip = false) {
  const rig = visitor.userData.rig;
  if (rig.frame !== name || rig.flip !== flip) {
    rig.sprite.material.map = frames[name]; rig.sprite.material.needsUpdate = true;
    rig.frame = name; rig.flip = flip;
  }
  rig.sprite.scale.x = flip ? -rig.size : rig.size;
}
export function createVisitor() {
  const group = new THREE.Group(), size = 2.8;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: frames['stand-back'], transparent: true, alphaTest: .025, depthWrite: false }));
  sprite.scale.set(size, size, 1); sprite.position.y = size / 2; group.add(sprite);
  group.userData.rig = { sprite, size, frame: 'stand-back', flip: false, view: 'back' };
  return group;
}
export function updateView(visitor, camera) {
  const rig = visitor.userData.rig;
  const forward = new THREE.Vector3(Math.sin(visitor.rotation.y), 0, Math.cos(visitor.rotation.y));
  const toCamera = camera.position.clone().sub(visitor.position).setY(0).normalize();
  const facing = forward.dot(toCamera);
  rig.view = facing < -.58 ? 'back' : facing > .58 ? 'front' : 'side';
  rig.flip = forward.x * toCamera.z - forward.z * toCamera.x < 0;
}
export function poseVisitor(visitor, state, phase = 0, reduced = false) {
  const rig = visitor.userData.rig;
  if (state === 'walk') {
    const step = reduced ? 1 : Math.floor(phase * 5.5) % 2 + 1;
    setFrame(visitor, rig.view === 'back' ? `walk-back-${step}` : rig.view === 'side' ? `walk-side-${step}` : 'stand-front', rig.view === 'side' && rig.flip);
  } else if (state === 'palms') {
    if (rig.view === 'back') setFrame(visitor, 'palms-back');
    else if (rig.view === 'side') setFrame(visitor, 'stand-side', rig.flip);
    else setFrame(visitor, 'palms', rig.flip); // front view (should not occur in-temple)
  }
  else setFrame(visitor, rig.view === 'back' ? 'stand-back' : rig.view === 'side' ? 'stand-side' : 'stand-front', rig.view === 'side' && rig.flip);
}
