// 云寺访客姿势库（Claude，2026-11-12）。全部用"世界方向"描述骨骼指向，模型面朝 +Z，左手在 +X。
// 每个姿势：{ spine:[x俯仰弧度], dirs:{骨骼:[x,y,z]}, hipsLift:是否按最低点贴地 }
export const POSES={
  stand:{spinePitch:0,dirs:{leftUpperArm:[.16,-1,.02],rightUpperArm:[-.16,-1,.02],leftLowerArm:[.10,-1,.10],rightLowerArm:[-.10,-1,.10],leftHand:[.05,-1,.1],rightHand:[-.05,-1,.1],
    leftUpperLeg:[.03,-1,0],rightUpperLeg:[-.03,-1,0],leftLowerLeg:[0,-1,0],rightLowerLeg:[0,-1,0]}},
  palms:{spinePitch:.06,dirs:{leftUpperArm:[.30,-1,.12],rightUpperArm:[-.30,-1,.12],leftLowerArm:[-.72,.42,.55],rightLowerArm:[.72,.42,.55],leftHand:[-.10,1,.12],rightHand:[.10,1,.12],
    leftUpperLeg:[.03,-1,0],rightUpperLeg:[-.03,-1,0],leftLowerLeg:[0,-1,0],rightLowerLeg:[0,-1,0]}},
  incense:{spinePitch:.38,dirs:{leftUpperArm:[.28,-.8,.55],rightUpperArm:[-.28,-.8,.55],leftLowerArm:[-.62,.55,.56],rightLowerArm:[.62,.55,.56],leftHand:[-.10,1,.1],rightHand:[.10,1,.1],
    leftUpperLeg:[.03,-1,0],rightUpperLeg:[-.03,-1,0],leftLowerLeg:[0,-1,0],rightLowerLeg:[0,-1,0]},incense:true},
  kneelUp:{spinePitch:.05,dirs:{leftUpperArm:[.30,-1,.12],rightUpperArm:[-.30,-1,.12],leftLowerArm:[-.72,.42,.55],rightLowerArm:[.72,.42,.55],leftHand:[-.10,1,.12],rightHand:[.10,1,.12],
    leftUpperLeg:[.05,-.30,.95],rightUpperLeg:[-.05,-.30,.95],leftLowerLeg:[0,-.04,-1],rightLowerLeg:[0,-.04,-1]},ground:true,footDown:true},
  kneel:{spinePitch:1.25,dirs:{leftUpperArm:[.22,-.45,.86],rightUpperArm:[-.22,-.45,.86],leftLowerArm:[-.05,-.85,.52],rightLowerArm:[.05,-.85,.52],leftHand:[0,-.1,1],rightHand:[0,-.1,1],
    leftUpperLeg:[.05,-.30,.95],rightUpperLeg:[-.05,-.30,.95],leftLowerLeg:[0,-.04,-1],rightLowerLeg:[0,-.04,-1]},ground:true,footDown:true},
  sit:{spinePitch:.02,dirs:{leftUpperArm:[.30,-1,.22],rightUpperArm:[-.30,-1,.22],leftLowerArm:[-.25,-.55,.80],rightLowerArm:[.25,-.55,.80],leftHand:[-.5,-.2,.8],rightHand:[.5,-.2,.8],
    leftUpperLeg:[.78,-.10,.62],rightUpperLeg:[-.78,-.10,.62],leftLowerLeg:[-.93,-.05,-.15],rightLowerLeg:[.93,-.05,.10]},ground:true},
};
export function walkPose(t){const s=Math.sin(t),c=Math.cos(t);return {spinePitch:.04,dirs:{
  leftUpperArm:[.16,-1,-.30*s],rightUpperArm:[-.16,-1,.30*s],leftLowerArm:[.10,-1,.12-.30*s],rightLowerArm:[-.10,-1,.12+.30*s],leftHand:[.05,-1,.1],rightHand:[-.05,-1,.1],
  leftUpperLeg:[.03,-1,.38*s],rightUpperLeg:[-.03,-1,-.38*s],leftLowerLeg:[0,-1,.38*s-.35*Math.max(0,c)],rightLowerLeg:[0,-1,-.38*s-.35*Math.max(0,-c)]}};}
const REST={leftUpperArm:[1,0,0],leftLowerArm:[1,0,0],leftHand:[1,0,0],rightUpperArm:[-1,0,0],rightLowerArm:[-1,0,0],rightHand:[-1,0,0],leftUpperLeg:[0,-1,0],rightUpperLeg:[0,-1,0],leftLowerLeg:[0,-1,0],rightLowerLeg:[0,-1,0]};
const ORDER=['leftUpperArm','leftLowerArm','leftHand','rightUpperArm','rightLowerArm','rightHand','leftUpperLeg','leftLowerLeg','rightUpperLeg','rightLowerLeg'];
export function applyPose(THREE,vrm,p){const h=vrm.humanoid,B=n=>h.getNormalizedBoneNode(n);
  for(const n of ['hips','spine','chest','upperChest','neck','head',...ORDER,'leftShoulder','rightShoulder','leftFoot','rightFoot']){const b=B(n);if(b)b.quaternion.identity();}
  const hips=B('hips');hips.position.copy(hips.userData.rest||(hips.userData.rest=hips.position.clone()));
  const sp=B('spine'),ch=B('chest');const pitch=p.spinePitch||0;if(sp)sp.rotation.x=pitch*.6;if(ch)ch.rotation.x=pitch*.4;const hd=B('head');if(hd&&pitch>.2)hd.rotation.x=pitch*.25;
  const v=new THREE.Vector3(),r=new THREE.Vector3(),q=new THREE.Quaternion();
  for(const n of ORDER){const b=B(n);if(!b||!p.dirs[n])continue;b.parent.updateWorldMatrix(true,false);b.parent.getWorldQuaternion(q).invert();v.fromArray(p.dirs[n]).normalize().applyQuaternion(q);r.fromArray(REST[n]);b.quaternion.setFromUnitVectors(r,v);}
  vrm.scene.updateMatrixWorld(true);
  if(p.footDown){for(const n of ['leftFoot','rightFoot']){const b=B(n);if(b)b.rotation.x=1.2;}vrm.scene.updateMatrixWorld(true);}
  if(p.ground){let min=Infinity;for(const n of ['leftFoot','rightFoot','leftLowerLeg','rightLowerLeg','leftToes','rightToes','hips']){const b=B(n);if(b){b.getWorldPosition(v);min=Math.min(min,v.y);}}hips.position.y-= (min-.05);}
  vrm.update(0);vrm.scene.updateMatrixWorld(true);}
