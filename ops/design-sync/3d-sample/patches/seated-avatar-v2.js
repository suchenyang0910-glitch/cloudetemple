/* 坐着的人 v2（Claude 2026-11-22）：别人和自己用同一个人物，只换上衣颜色。
   做法：把自己的人物模型 me 摆成坐姿，"拍"成三块几何体（皮肤 / 上衣 / 其余），之后所有人共用这三块，只是上衣材质颜色不同。
   必须放在 template.html 的模块作用域里（要用到 me、hip、LL、LR、torso、headG、AL、AR、HIP、skin、shirt），放在 mergeMe() 之后任何位置。
   用法：const p = makeSeatedAvatar('sit'|'kneel'|'mo', 上衣颜色);  p.position.set(seat.x, 地面高度 + 坐垫高度, seat.z);  p.rotation.y = seat.yaw;
        const look = seatedTopColor(称呼);   // 给别人按称呼固定取一个上衣颜色
   每人 3 条绘制指令（皮肤、上衣、其余）+ 称呼牌 1 条。三角形数等于自己人物的三角形数。 */
const _seatedGeo={},_seatedTop=new Map();let _seatedRest=null;
function bakeAvatarPose(pose){
  if(_seatedGeo[pose])return _seatedGeo[pose];
  const kneel=pose==='kneel'?1:0,sit=kneel?0:1,pray=kneel?1:0,moA=pose==='mo'?1:0;
  const J=[me,hip,LL.th,LR.th,LL.kn,LR.kn,torso,headG,AL.up,AR.up,AL.el,AR.el],keep=J.map(o=>[o.position.clone(),o.rotation.clone()]);
  me.position.set(0,0,0);me.rotation.set(0,0,0);
  hip.position.y=HIP-kneel*.27-sit*.38;
  LL.th.rotation.set(-sit*1.5,0,-sit*.5);LR.th.rotation.set(-sit*1.5,0,sit*.5);LL.kn.rotation.x=LR.kn.rotation.x=kneel*1.55+sit*2.0;
  torso.rotation.x=0;headG.rotation.x=sit*.12+pray*.1;
  const uX=-sit*.5-pray*.95,fX=-.12-sit*.75-pray*1.3,uZ=pray*.42+sit*.28;
  AL.up.rotation.x=uX;AR.up.rotation.x=uX*(1-moA)-moA*.8;AL.el.rotation.x=fX;AR.el.rotation.x=fX*(1-moA)-moA*.75;AL.up.rotation.z=uZ;AR.up.rotation.z=-uZ*(1-moA);
  me.updateMatrixWorld(true);
  const inv=new THREE.Matrix4().copy(me.matrixWorld).invert(),M=new THREE.Matrix4(),nm=new THREE.Matrix3(),v=new THREE.Vector3(),sc=shirt.color;
  const B={skin:{p:[],n:[]},top:{p:[],n:[]},rest:{p:[],n:[],c:[]}};
  me.traverse(o=>{if(!o.isMesh)return;for(let a=o;a&&a!==me;a=a.parent)if(!a.visible)return;const m=o.material;if(Array.isArray(m)||m.transparent)return;
    const g=o.geometry.index?o.geometry.toNonIndexed():o.geometry,P=g.attributes.position,N=g.attributes.normal,C=g.attributes.color;if(!N)return;
    M.multiplyMatrices(inv,o.matrixWorld);nm.getNormalMatrix(M);
    for(let t=0;t<P.count;t+=3){let dst=m===skin?B.skin:m===shirt?B.top:B.rest,cr=m.color.r,cg=m.color.g,cb=m.color.b;
      if(C&&m.vertexColors){cr=C.getX(t);cg=C.getY(t);cb=C.getZ(t);if(Math.abs(cr-sc.r)+Math.abs(cg-sc.g)+Math.abs(cb-sc.b)<.012)dst=B.top}
      for(let k=t;k<t+3;k++){v.fromBufferAttribute(P,k).applyMatrix4(M);dst.p.push(v.x,v.y,v.z);v.fromBufferAttribute(N,k).applyMatrix3(nm).normalize();dst.n.push(v.x,v.y,v.z);if(dst.c)dst.c.push(cr,cg,cb)}}});
  J.forEach((o,i)=>{o.position.copy(keep[i][0]);o.rotation.copy(keep[i][1])});me.updateMatrixWorld(true);
  const mk=b=>{const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(b.p,3));g.setAttribute('normal',new THREE.Float32BufferAttribute(b.n,3));if(b.c)g.setAttribute('color',new THREE.Float32BufferAttribute(b.c,3));g.computeBoundingSphere();return g};
  return _seatedGeo[pose]={skin:mk(B.skin),top:mk(B.top),rest:mk(B.rest),tris:(B.skin.p.length+B.top.p.length+B.rest.p.length)/9}}
function makeSeatedAvatar(pose,topHex){const g=bakeAvatarPose(pose);_seatedRest??=new THREE.MeshLambertMaterial({vertexColors:true});
  let tm=_seatedTop.get(topHex);if(!tm){tm=shirt.clone();tm.color.setHex(topHex);_seatedTop.set(topHex,tm)}
  const p=new THREE.Group();p.add(new THREE.Mesh(g.skin,skin),new THREE.Mesh(g.top,tm),new THREE.Mesh(g.rest,_seatedRest));p.name='seated-person';p.userData.seatedPerson=true;p.userData.tris=g.tris;return p}
const SEATED_TOPS=[0xd9cdb6,0xb9c4b0,0xa9b9c6,0xd8b9a8,0xc9bcd0,0xc8c39a,0x9fb7b1,0xdcc7a0];
function seatedTopColor(key){let n=0;for(const ch of String(key))n=(n*31+ch.codePointAt(0))>>>0;return SEATED_TOPS[n%SEATED_TOPS.length]}
/* 称呼牌：屏幕上固定高度（不随远近变大变小）。
   用法：const t = makeNameTag(称呼); p.add(t); t.position.y = 1.22（坐）/ 1.42（跪）/ 自己站着时约 1.95;  sizeNameTag(t, camera, 画布高度像素, 20);
   窗口尺寸变化时对所有称呼牌重新调一次 sizeNameTag。自己的那块另加 t.userData.self = true。 */
function makeNameTag(name){const f=28,pad=18,c=document.createElement('canvas'),x=c.getContext('2d');x.font=`500 ${f}px system-ui,sans-serif`;const w=Math.ceil(x.measureText(name).width)+pad*2;c.width=w;c.height=48;x.font=`500 ${f}px system-ui,sans-serif`;x.fillStyle='rgba(25,18,12,.78)';x.beginPath();x.roundRect(0,0,w,48,24);x.fill();x.fillStyle='#fff7e6';x.textAlign='center';x.textBaseline='middle';x.fillText(name,w/2,25);
  const t=new THREE.CanvasTexture(c);if('colorSpace' in t)t.colorSpace=THREE.SRGBColorSpace;const s=new THREE.Sprite(new THREE.SpriteMaterial({map:t,transparent:true,depthWrite:false,sizeAttenuation:false}));s.name='name-tag';s.userData.nameTag=true;s.userData.text=name;s.userData.aspect=w/48;s.renderOrder=30;return s}
function sizeNameTag(tag,camera,viewportHeightPx,px=20){const k=px*2*Math.tan(camera.fov*Math.PI/360)/viewportHeightPx;tag.scale.set(k*tag.userData.aspect,k,1);tag.userData.px=px}
