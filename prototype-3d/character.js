import * as THREE from './vendor/three.module.min.js';

const skin = 0xb98262;

function limb(material, radius, length) {
  const mesh = new THREE.Mesh(new THREE.CapsuleGeometry(radius, length, 4, 7), material);
  mesh.position.y = -(length / 2 + radius);
  return mesh;
}

export function createVisitor({ ghost = false, hair = 'short' } = {}) {
  const group = new THREE.Group();
  const opacity = ghost ? .34 : 1;
  const shirt = new THREE.MeshToonMaterial({ color: 0xe9e4d8, transparent: ghost, opacity });
  const trousers = new THREE.MeshToonMaterial({ color: 0x4d4035, transparent: ghost, opacity });
  const skinMat = new THREE.MeshToonMaterial({ color: skin, transparent: ghost, opacity });
  const hairMat = new THREE.MeshToonMaterial({ color: 0x282622, transparent: ghost, opacity });

  const body = new THREE.Group();
  body.position.y = 1.1;
  group.add(body);
  const torso = new THREE.Mesh(new THREE.CylinderGeometry(.34, .42, .98, 8), shirt);
  torso.position.y = 1.02;
  body.add(torso);

  const head = new THREE.Mesh(new THREE.SphereGeometry(.31, 12, 9), skinMat);
  head.scale.set(.88, 1.08, .9);
  head.position.set(0, 1.77, 0);
  body.add(head);
  const cap = new THREE.Mesh(new THREE.SphereGeometry(.318, 12, 8, 0, Math.PI * 2, 0, Math.PI * .58), hairMat);
  cap.position.set(0, 1.82, -.015);
  cap.rotation.x = -.05;
  body.add(cap);
  if (hair === 'bun') {
    const bun = new THREE.Mesh(new THREE.SphereGeometry(.14, 9, 7), hairMat);
    bun.position.set(0, 1.92, -.23);
    body.add(bun);
  }

  const armPivots = [];
  for (const side of [-1, 1]) {
    const pivot = new THREE.Group();
    pivot.position.set(side * .39, 1.39, 0);
    const arm = limb(shirt, .1, .56);
    pivot.add(arm);
    body.add(pivot);
    armPivots.push(pivot);
  }

  const legPivots = [];
  for (const side of [-1, 1]) {
    const pivot = new THREE.Group();
    pivot.position.set(side * .2, .68, 0);
    const leg = limb(trousers, .13, .64);
    pivot.add(leg);
    body.add(pivot);
    legPivots.push(pivot);
  }

  group.userData.rig = { body, torso, head, arms: armPivots, legs: legPivots, state: 'stand' };
  group.scale.setScalar(ghost ? .94 : 1);
  return group;
}

export function poseVisitor(visitor, state, phase = 0, reduced = false) {
  const rig = visitor.userData.rig;
  rig.state = state;
  const ease = reduced ? 1 : .5 - Math.cos(Math.min(1, phase) * Math.PI) / 2;
  rig.body.position.set(0, 1.1, 0);
  rig.body.rotation.set(0, 0, 0);
  rig.arms[0].rotation.set(0, 0, 0);
  rig.arms[1].rotation.set(0, 0, 0);
  rig.legs[0].rotation.set(0, 0, 0);
  rig.legs[1].rotation.set(0, 0, 0);

  if (state === 'walk') {
    const swing = Math.sin(phase * Math.PI * 2) * .56;
    rig.arms[0].rotation.x = swing;
    rig.arms[1].rotation.x = -swing;
    rig.legs[0].rotation.x = -swing;
    rig.legs[1].rotation.x = swing;
    rig.body.position.y += Math.abs(Math.sin(phase * Math.PI * 2)) * .035;
  } else if (state === 'sit') {
    rig.body.position.y = .53;
    rig.legs[0].rotation.x = -1.23;
    rig.legs[1].rotation.x = -1.23;
    rig.legs[0].rotation.z = -.58;
    rig.legs[1].rotation.z = .58;
    rig.arms[0].rotation.x = -.56;
    rig.arms[1].rotation.x = -.56;
  } else if (state === 'palms') {
    rig.arms[0].rotation.set(-.46, 0, .84);
    rig.arms[1].rotation.set(-.46, 0, -.84);
  } else if (state === 'bow') {
    rig.body.position.y = .72 - ease * .22;
    rig.body.rotation.x = -ease * 1.16;
    rig.arms[0].rotation.set(-1.34, 0, -.42);
    rig.arms[1].rotation.set(-1.34, 0, .42);
    rig.legs[0].rotation.x = -1.25;
    rig.legs[1].rotation.x = -1.25;
  }
}
