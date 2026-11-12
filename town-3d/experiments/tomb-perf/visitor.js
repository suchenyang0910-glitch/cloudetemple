import * as THREE from '../../../prototype-3d/vendor/three.module.min.js';

// Same existing billboard visitor asset, with an experiment-local loader path.
export function createVisitor() {
  const texture = new THREE.TextureLoader().load('/prototype-3d/assets/visitor/stand-back.webp');
  texture.colorSpace = THREE.SRGBColorSpace;
  const group = new THREE.Group();
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, alphaTest: .025, depthWrite: false }));
  sprite.scale.set(2.8, 2.8, 1); sprite.position.y = 1.4; group.add(sprite);
  return group;
}
