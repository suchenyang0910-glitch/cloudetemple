import * as THREE from '../prototype-3d/vendor/three.module.min.js';

const _pt = new THREE.Vector3();

export function stepWalking({ visitor, keys, pointer, target, delta, canOccupy }) {
  let turn = 0, forward = 0;
  if (keys.has('arrowleft') || keys.has('a')) turn += 1;
  if (keys.has('arrowright') || keys.has('d')) turn -= 1;
  if (keys.has('arrowup') || keys.has('w')) forward += 1;
  if (keys.has('arrowdown') || keys.has('s')) forward -= .65;
  if (pointer.down && pointer.moved) { turn -= pointer.steer; forward = 1; target = null; }
  visitor.rotation.y += turn * delta * 1.7;
  let sx = 0, sz = 0;
  if (target) {
    const dx = target.x - visitor.position.x, dz = target.z - visitor.position.z;
    const dist = Math.hypot(dx, dz);
    if (dist < .15) target = null;
    else { visitor.rotation.y = Math.atan2(dx, dz); sx = dx / dist; sz = dz / dist; forward = 1; }
  }
  if (!forward) return { target, walking: false };
  if (!target) { sx = Math.sin(visitor.rotation.y); sz = Math.cos(visitor.rotation.y); }
  const step = 2.4 * delta * forward;
  const nx = visitor.position.x + sx * step, nz = visitor.position.z + sz * step;
  const movedX = canOccupy(nx, visitor.position.z), movedZ = canOccupy(visitor.position.x, nz);
  if (movedX) visitor.position.x = nx;
  if (movedZ) visitor.position.z = nz;
  if (!movedX && !movedZ) target = null;
  return { target, walking: true };
}

export function updateFollowCamera({ world, delta, reduced, mapMode, cameraOffset, mapPosition, mapTarget }) {
  const v = world.visitor;
  if (mapMode) {
    world.camera.position.lerp(mapPosition, reduced ? 1 : 1 - Math.pow(.001, delta));
    world.camera.lookAt(mapTarget);
  } else {
    const desired = v.position.clone().add(cameraOffset);
    world.camera.position.lerp(desired, reduced ? 1 : 1 - Math.pow(.002, delta));
    world.camera.lookAt(v.position.x, 1.2, v.position.z - 5);
  }
}

export function updateBillboards(billboards, camera, mapMode) {
  for (const b of billboards) {
    if (b.userData.veil) b.userData.veil.visible = !mapMode;
    if (b.userData.board) {
      const m = b.userData.board.material;
      m.opacity = mapMode ? 1 : 0.82;
      m.color.set(mapMode ? 0xffffff : 0xa8b0be);
      m.needsUpdate = true;
    }
    if (!b.userData.autoRotate) continue;
    if (mapMode) b.lookAt(camera.position);
    else {
      const dx = camera.position.x - b.position.x;
      const dz = camera.position.z - b.position.z;
      b.rotation.set(0, Math.atan2(dx, dz), 0);
    }
  }
}

function rectsOverlap(a, b) {
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
}

export function updateLabels({ world, temples, labelDivs, mapMode }) {
  const halfW = innerWidth / 2, halfH = innerHeight / 2, cam = world.camera;
  const visible = new Set(), finalPos = new Map(), LHW = 76;
  if (mapMode) {
    for (const t of temples) {
      const v = _pt.set(t.x, 0, t.z).project(cam);
      if (v.z > 1) continue;
      const sx = Math.max(50, Math.min(innerWidth - 50, v.x * halfW + halfW));
      const sy = Math.max(64, Math.min(innerHeight - 96, -v.y * halfH + halfH));
      visible.add(t.id);
      finalPos.set(t.id, { sx, sy });
    }
  } else {
    const BILL_TOP = 12;
    const vp = world.visitor.position;
    _pt.set(vp.x, 2.8, vp.z).project(cam);
    const visSx = _pt.x * halfW + halfW, visTop = -_pt.y * halfH + halfH;
    _pt.set(vp.x, 0, vp.z).project(cam);
    const visBot = -_pt.y * halfH + halfH;
    const visRect = { left: visSx - 24, right: visSx + 24, top: visTop, bottom: visBot }, placedRects = [];
    for (const t of temples) {
      _pt.set(t.x, BILL_TOP, t.z).project(cam);
      if (_pt.z > 1 || _pt.x < -1 || _pt.x > 1 || _pt.y < -1 || _pt.y > 1) continue;
      const rawSx = _pt.x * halfW + halfW, rawSy = -_pt.y * halfH + halfH;
      const sx = Math.max(LHW + 12, Math.min(innerWidth - LHW - 12, rawSx));
      const sy = Math.max(72, rawSy - 8);
      if (sy > innerHeight - 46) continue;
      const lRect = { left: sx - LHW, right: sx + LHW, top: sy - 4, bottom: sy + 42 };
      if (rectsOverlap(lRect, visRect) || placedRects.some(pr => rectsOverlap(lRect, pr))) continue;
      placedRects.push(lRect); visible.add(t.id); finalPos.set(t.id, { sx, sy });
    }
  }
  for (const t of temples) {
    const div = labelDivs[t.id]; if (!div) continue;
    if (!visible.has(t.id)) { div.style.display = 'none'; continue; }
    const pos = finalPos.get(t.id);
    div.style.display = ''; div.style.left = `${pos.sx}px`; div.style.top = `${pos.sy}px`;
  }
}
