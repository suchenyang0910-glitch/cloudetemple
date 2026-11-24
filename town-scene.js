// Exterior geometry, navigation and map extracted from approved v42 exterior.
// Source SHA256: F0D7CF9D43AA9CA202D8460D1C997D8FBA9B14BE7F95A99C8E3902694633892B.
import * as THREE from './town-three.js';
import {periodNow} from './period.js';
import {createFrameMonitor} from './town-performance.js';
export function startTown({onEnterHall,onFailure,onLowPerformance,restore}) {
const stage=document.getElementById('stage'), $=s=>document.querySelector(s),msgEl=$('#msg');
const RAD=.32,PLAT=.6;
const renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'});
renderer.setPixelRatio(Math.min(devicePixelRatio||1,2));stage.prepend(renderer.domElement);
renderer.domElement.setAttribute('aria-label','Thị trấn Mây');
renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();onFailure();});
const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(50,1,.1,400);
const sRGB=t=>{t.colorSpace=THREE.SRGBColorSpace;return t};
function canvasTex(w,h,draw,rep){const c=document.createElement('canvas');c.width=w;c.height=h;draw(c.getContext('2d'),w,h);const t=sRGB(new THREE.CanvasTexture(c));if(rep){t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(rep[0],rep[1])}t.anisotropy=4;return t}
let seed=7;const rnd=()=>(seed=(seed*16807)%2147483647)/2147483647;
const lam=(o)=>new THREE.MeshLambertMaterial(o);
function box(w,h,d,mat,x,y,z,parent=scene){const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);m.position.set(x,y,z);parent.add(m);return m}
function cyl(rt,rb,h,mat,x,y,z,seg=14,parent=scene){const m=new THREE.Mesh(new THREE.CylinderGeometry(rt,rb,h,seg),mat);m.position.set(x,y,z);parent.add(m);return m}


const stoneTex=canvasTex(512,512,(g,w,h)=>{g.fillStyle='#a89c88';g.fillRect(0,0,w,h);const n=4,s=w/n;for(let i=0;i<n;i++)for(let j=0;j<n;j++){const v=168+rnd()*14|0;g.fillStyle=`rgb(${v+26},${v+17},${v})`;g.fillRect(i*s+2,j*s+2,s-4,s-4)}for(let k=0;k<2600;k++){g.fillStyle=`rgba(${rnd()<.5?60:255},${rnd()<.5?50:245},${rnd()<.5?40:225},${rnd()*.07})`;g.fillRect(rnd()*w,rnd()*h,2+rnd()*3,2+rnd()*3)}},[9,11]);
const woodTex=canvasTex(256,256,(g,w,h)=>{g.fillStyle='#8a4a26';g.fillRect(0,0,w,h);for(let i=0;i<90;i++){g.strokeStyle=`rgba(${rnd()<.5?40:190},${rnd()<.5?18:110},${rnd()<.5?8:60},${.05+rnd()*.12})`;g.lineWidth=1+rnd()*3;g.beginPath();const x=rnd()*w;g.moveTo(x,0);g.bezierCurveTo(x+rnd()*14-7,h*.3,x+rnd()*14-7,h*.7,x+rnd()*10-5,h);g.stroke()}},[1,2]);
const floorTex=canvasTex(256,256,(g,w,h)=>{g.fillStyle='#9a6a44';g.fillRect(0,0,w,h);for(let i=0;i<8;i++){g.fillStyle=`rgba(${rnd()<.5?60:210},${rnd()<.5?30:150},${rnd()<.5?10:90},${.05+rnd()*.1})`;g.fillRect(i*32,0,31,h);g.fillStyle='rgba(40,20,8,.35)';g.fillRect(i*32+31,0,1,h)}},[5,3]);
const tileTex=canvasTex(256,256,(g,w,h)=>{g.fillStyle='#b4502a';g.fillRect(0,0,w,h);const r=16;for(let j=0;j<h/r+1;j++)for(let i=0;i<w/(r*2)+1;i++){const x=i*r*2+(j%2?r:0),y=j*r;const v=rnd()*30|0;g.fillStyle=`rgb(${176+v},${78+v*.6|0},${40+v*.3|0})`;g.beginPath();g.arc(x,y,r,0,Math.PI);g.fill();g.strokeStyle='rgba(70,22,8,.45)';g.lineWidth=1.5;g.beginPath();g.arc(x,y,r,0,Math.PI);g.stroke()}},[14,5]);
const latticeTex=canvasTex(256,384,(g,w,h)=>{g.fillStyle='#7a3f20';g.fillRect(0,0,w,h);g.fillStyle='#2a160b';g.fillRect(18,18,w-36,h*.5);g.strokeStyle='#8f4c26';g.lineWidth=7;for(let x=18;x<=w-18;x+=22){g.beginPath();g.moveTo(x,18);g.lineTo(x,18+h*.5);g.stroke()}g.lineWidth=6;g.strokeRect(18,18,w-36,h*.5);g.strokeStyle='#5c2e15';g.lineWidth=5;g.strokeRect(22,h*.58,w-44,h*.36)},null);
const softTex=(()=>{const n=128,d=new Uint8Array(n*n*4);for(let y=0;y<n;y++)for(let x=0;x<n;x++){const r=Math.hypot(x-63.5,y-63.5)/64,a=r<.5?1-r*1.3:r<1?.35*(2-2*r):0,i=(y*n+x)*4;d[i]=d[i+1]=d[i+2]=255;d[i+3]=Math.round(a*255)}const t=new THREE.DataTexture(d,n,n,THREE.RGBAFormat);t.colorSpace=THREE.SRGBColorSpace;t.magFilter=THREE.LinearFilter;t.minFilter=THREE.LinearFilter;t.needsUpdate=true;return t})();
const mStone=lam({map:stoneTex}), mWood=lam({map:woodTex,color:0xd88a5a}), mWoodDark=lam({map:woodTex,color:0x9a5a36}), mFloor=lam({map:floorTex}), mTile=lam({map:tileTex,side:THREE.DoubleSide}), mWall=lam({color:0x4a2f1c}), mBase=lam({color:0xcfc5b4}), mBronze=lam({color:0x8a7a3e}), mGold=lam({color:0xd9a441,emissive:0x5a3a08});
const shadowMat=new THREE.MeshBasicMaterial({map:softTex,color:0x000000,transparent:true,opacity:.34,depthWrite:false});
function shade(x,y,z,s,o,par=scene){const m=new THREE.Mesh(new THREE.PlaneGeometry(s,s),o?shadowMat.clone():shadowMat);if(o)m.material.opacity=o;m.rotation.x=-Math.PI/2;m.position.set(x,y+.016,z);m.renderOrder=1;par.add(m);return m}

const hills=[];function hill(z,h,col,w,x){const s=new THREE.Shape();s.moveTo(-w/2,0);const n=14;for(let i=0;i<=n;i++){const t=i/n;s.lineTo(-w/2+w*t,h*(.35+.65*Math.sin(t*Math.PI))*(.75+.25*Math.sin(t*9+z)))}s.lineTo(w/2,0);const m=new THREE.Mesh(new THREE.ShapeGeometry(s),new THREE.MeshBasicMaterial({color:col,fog:true}));m.position.set(x,-.5,z);scene.add(m);hills.push(m);return m}
hill(-600,240,0x7f9a94,1680,-30);hill(-520,180,0x6b8a7f,1440,60);hill(-440,120,0x5c7a6a,1200,-70);
function ridge(len,h,col,x,z,ry,seed){const sh=new THREE.Shape();sh.moveTo(-len/2,-2);const n=64;for(let i=0;i<=n;i++){const t=i/n,u=t*len/h;sh.lineTo(-len/2+len*t,h*(.5+.24*Math.sin(u*1.9+seed)+.16*Math.sin(u*4.3+seed*2.1)+.1*Math.sin(u*9.1+seed*.7))*(.55+.45*Math.sin(t*Math.PI)))}sh.lineTo(len/2,-2);const m=new THREE.Mesh(new THREE.ShapeGeometry(sh),new THREE.MeshBasicMaterial({color:col,fog:true,side:THREE.DoubleSide}));m.position.set(x,-.5,z);m.rotation.y=ry;scene.add(m);hills.push(m);return m}
for(const sx of [-1,1]){ridge(420,84,0x587868,sx*280,500,-sx*Math.PI/2,sx*2+1);ridge(480,129,0x6f8f84,sx*330,500,-sx*Math.PI/2,sx*3+4);ridge(540,158,0x8fa9a6,sx*380,500,-sx*Math.PI/2,sx*5+7)}
ridge(432,34,0x587868,0,270,Math.PI,2.2);ridge(546,57,0x6f8f84,0,330,Math.PI,5.1);ridge(672,87,0x8fa9a6,0,390,Math.PI,8.4);

const mists=[];for(let i=0;i<7;i++){const m=new THREE.Sprite(new THREE.SpriteMaterial({map:softTex,color:0xffffff,opacity:.5,depthWrite:false,transparent:true}));m.scale.set(70+rnd()*50,14+rnd()*8,1);m.position.set(-90+rnd()*180,6+rnd()*14,-60-rnd()*40);m.userData.v=.25+rnd()*.5;scene.add(m);mists.push(m)}

const orb=new THREE.Sprite(new THREE.SpriteMaterial({map:softTex,color:0xffffff,opacity:0,transparent:true,depthWrite:false,fog:false}));scene.add(orb);

const starG=new THREE.BufferGeometry();{const p=[];for(let i=0;i<260;i++){const a=rnd()*Math.PI*2,e=.15+rnd()*1.2;p.push(Math.cos(a)*Math.cos(e)*300,Math.sin(e)*300,Math.sin(a)*Math.cos(e)*300-40)}starG.setAttribute('position',new THREE.Float32BufferAttribute(p,3))}
const stars=new THREE.Points(starG,new THREE.PointsMaterial({color:0xfff4d8,size:1.6,sizeAttenuation:false,transparent:true,opacity:0,fog:false}));scene.add(stars);
const seaMat=new THREE.MeshLambertMaterial({color:0x4f8fc0}),lanterns=[],dGlow=[];
const flameM=new THREE.MeshBasicMaterial({color:0xffb347});
function umbPine(P,x,z,h){const tm=umbPine.t||(umbPine.t=lam({color:0x6a4a34})),cm=umbPine.c||(umbPine.c=[0x2f5a40,0x3b6a48,0x487a52].map(c=>lam({color:c}))),lean=(Math.abs(x*7.3+z*3.1)%1)*.5-.25,t=cyl(.11,.24,h*.86,tm,x,h*.43,z,6,P);t.rotation.z=lean*.16;[[1.9,.74,.5,0],[1.45,.88,-.4,.3],[.95,1,.1,-.2]].forEach(([r,f,ox,oz],k)=>{const c=new THREE.Mesh(new THREE.SphereGeometry(r*(h/6+.35),8,4),cm[k]);c.scale.y=.26;c.position.set(x+ox-lean*h*.14,h*f,z+oz);P.add(c)})}
function frangi(P,x,z){const gm=frangi.t||(frangi.t=lam({color:0x9a9488})),lm=frangi.l||(frangi.l=lam({color:0x6f9a58})),fm=frangi.f||(frangi.f=lam({color:0xfaf4e2}));cyl(.14,.2,1.1,gm,x,.55,z,6,P);for(let i=0;i<4;i++){const a=i*1.57+(Math.abs(x+z)%1)*1.2,t=.55+(i%2)*.2,L=1.3+(i%3)*.2,dx=-Math.sin(t)*Math.cos(a),dy=Math.cos(t),dz=Math.sin(t)*Math.sin(a),b=cyl(.06,.1,L,gm,x+dx*L/2,1.05+dy*L/2,z+dz*L/2,5,P);b.rotation.set(0,a,t);const cx=x+dx*L,cy=1.05+dy*L,cz=z+dz*L,k=new THREE.Mesh(new THREE.IcosahedronGeometry(.58,0),lm);k.scale.y=.55;k.position.set(cx,cy+.12,cz);P.add(k);for(let j=0;j<3;j++){const f=new THREE.Mesh(new THREE.SphereGeometry(.1,6,4),fm);f.position.set(cx+Math.cos(j*2.1+i)*.3,cy+.34,cz+Math.sin(j*2.1+i)*.3);P.add(f)}}}
function bamboo(P,x,z){const cm=bamboo.c||(bamboo.c=lam({color:0x9aa85a})),lm=bamboo.l||(bamboo.l=lam({color:0x7fae5c}));for(let i=0;i<7;i++){const a=i*.9,t=.1+(i%3)*.07,H=4.2+(i%4)*.5,r=.12+(i%2)*.16,bx=x+Math.cos(a)*r,bz=z+Math.sin(a)*r,dx=-Math.sin(t)*Math.cos(a),dy=Math.cos(t),dz=Math.sin(t)*Math.sin(a),c=cyl(.03,.05,H,cm,bx+dx*H/2,dy*H/2,bz+dz*H/2,5,P);c.rotation.set(0,a,t);const k=new THREE.Mesh(new THREE.IcosahedronGeometry(.62,0),lm);k.scale.set(1,.5,1);k.position.set(bx+dx*H*.93,dy*H*.93,bz+dz*H*.93);P.add(k)}}
function areca(P,x,z,h=6){const tm=areca.t||(areca.t=lam({color:0x8f887a})),lm=areca.l||(areca.l=lam({color:0x4f8a4a})),g=areca.g||(areca.g=new THREE.SphereGeometry(1,6,4));cyl(.07,.1,h,tm,x,h/2,z,6,P);cyl(.09,.08,.5,lm,x,h+.2,z,6,P);for(let i=0;i<7;i++){const a=i*.9,t=-.42,dx=Math.cos(t)*Math.cos(a),dy=Math.sin(t),dz=-Math.cos(t)*Math.sin(a),f=new THREE.Mesh(g,lm);f.scale.set(1.2,.06,.3);f.rotation.set(0,a,t);f.position.set(x+dx*1.1,h+.55+dy*1.1,z+dz*1.1);P.add(f)}const n=new THREE.Mesh(new THREE.SphereGeometry(.16,6,4),lam({color:0xc9862a}));n.position.set(x+.12,h-.12,z);P.add(n)}
function lampAt(P,x,y,z,sc=1){cyl(.07*sc,.09*sc,.1*sc,lam({color:0x7a5a3a}),x,y+.05*sc,z,8,P);const f=new THREE.Mesh(new THREE.SphereGeometry(.045*sc,8,6),flameM);f.scale.y=1.6;f.position.set(x,y+.17*sc,z);P.add(f);
  const g=new THREE.Sprite(new THREE.SpriteMaterial({map:softTex,color:0xffa040,opacity:.5,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,fog:false}));g.scale.set(.9*sc,.9*sc,1);g.position.set(x,y+.18*sc,z);g.userData.p=rnd()*6;P.add(g);dGlow.push(g);return [f,g]}
// Preserve the original procedural random stream after omitting interior scenes.
seed=1590201975;
const V39_BUILD='v39-linear-roads-r3';let v39TreeCount=0;const townG=new THREE.Group();townG.visible=false;scene.add(townG);const TW_SOLID=[],TW_FORCE=[],TW_RECT=[],TOWN_PL=[],HALLR=[],PATHBAD=[],TALL=[[-27,30,4.4,13],[-34,21.5,6,10.5],[-15,35.5,7,6.5],[-33,5,4.5,9]];
const LAKE=[[-10,8,12],[10,4,12],[0,-4,9],[0,15,8.5]],ISLE=[0,6,9.4],BRIDGE=[[-1.4,1.4,12.5,24.4],[6.5,13.2,4.9,7.1],[10.9,13.2,.9,7.1],[10.9,18.2,.9,3.1],[15.9,18.2,.9,6.1],[15.9,23.2,3.9,6.1]],STREAM=[];
const tileGray=canvasTex(256,256,(g,w,h)=>{g.fillStyle='#b8b8b8';g.fillRect(0,0,w,h);const r=16;for(let j=0;j<h/r+1;j++)for(let i=0;i<w/(r*2)+1;i++){const x=i*r*2+(j%2?r:0),y=j*r,v=205+rnd()*45|0;g.fillStyle=`rgb(${v},${v},${v})`;g.beginPath();g.arc(x,y,r,0,Math.PI);g.fill();g.strokeStyle='rgba(30,30,30,.45)';g.lineWidth=1.5;g.beginPath();g.arc(x,y,r,0,Math.PI);g.stroke()}},[5,2]);
const rep1=t=>{t.wrapS=t.wrapT=THREE.RepeatWrapping;return t};
const tubeT=rep1(canvasTex(128,128,(g,w,h)=>{const n=4,s=w/n;for(let i=0;i<n;i++){const gr=g.createLinearGradient(i*s,0,i*s+s,0);gr.addColorStop(0,'#5e5e5e');gr.addColorStop(.16,'#8a8a8a');gr.addColorStop(.34,'#e6e6e6');gr.addColorStop(.56,'#ffffff');gr.addColorStop(.8,'#c4c4c4');gr.addColorStop(1,'#6a6a6a');g.fillStyle=gr;g.fillRect(i*s,0,s,h)}for(let j=0;j<4;j++){g.fillStyle='rgba(20,20,20,.3)';g.fillRect(0,j*h/4,w,2.5);g.fillStyle='rgba(255,255,255,.22)';g.fillRect(0,j*h/4+2.5,w,2)}for(let k=0;k<500;k++){g.fillStyle=`rgba(${rnd()<.5?0:255},${rnd()<.5?0:255},${rnd()<.5?0:255},${rnd()*.06})`;g.fillRect(rnd()*w,rnd()*h,3,5)}}));
const scaleT=rep1(canvasTex(128,128,(g,w,h)=>{g.fillStyle='#9a9a9a';g.fillRect(0,0,w,h);const r=16;for(let j=h/r+1;j>=-1;j--)for(let i=-1;i<w/(r*2)+1;i++){const x=i*r*2+(j%2?r:0)+r,y=j*r,v=200+rnd()*50|0;g.fillStyle=`rgb(${v},${v},${v})`;g.beginPath();g.moveTo(x-r,y-r);g.lineTo(x-r,y);g.arc(x,y,r,Math.PI,0,true);g.lineTo(x+r,y-r);g.fill();g.strokeStyle='rgba(20,20,20,.5)';g.lineWidth=1.6;g.beginPath();g.arc(x,y,r,Math.PI,0,true);g.stroke()}}));
const rafterT=rep1(canvasTex(64,64,(g,w,h)=>{g.fillStyle='#7a4526';g.fillRect(0,0,w,h);g.fillStyle='#4a2512';g.fillRect(0,0,w*.42,h);g.fillStyle='rgba(255,220,170,.12)';g.fillRect(w*.42,0,3,h)}));
const plasterM=lam({color:0xcfc6b4,side:THREE.DoubleSide}),goldM=new THREE.MeshLambertMaterial({color:0xc9a24a,emissive:0x4a3408}),jadeM=lam({color:0x3f7f78});
function ribbon(G,pts,h0,h1,th,mat,seg=20){const c=new THREE.CatmullRomCurve3(pts.map(q=>new THREE.Vector3(q[0],q[1],q[2]))),pos=[],idx=[],up=new THREE.Vector3(0,1,0);for(let i=0;i<=seg;i++){const t=i/seg,q=c.getPoint(t),tg=c.getTangent(t),n=new THREE.Vector3().crossVectors(tg,up);if(n.lengthSq()<1e-6)n.set(1,0,0);n.normalize();const u2=new THREE.Vector3().crossVectors(n,tg).normalize(),hh=(h0+(h1-h0)*t)/2;for(const [a,b] of [[1,1],[1,-1],[-1,-1],[-1,1]])pos.push(q.x+u2.x*hh*a+n.x*th/2*b,q.y+u2.y*hh*a+n.y*th/2*b,q.z+u2.z*hh*a+n.z*th/2*b)}for(let i=0;i<seg;i++)for(let k=0;k<4;k++){const a=i*4+k,b=i*4+(k+1)%4;idx.push(a,a+4,b,b,a+4,b+4)}const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setIndex(idx);const gg=g.toNonIndexed();gg.computeVertexNormals();const m=new THREE.Mesh(gg,mat);G.add(m);return m}
function tube(G,pts,r,mat,seg=18){const m=new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map(q=>new THREE.Vector3(q[0],q[1],q[2]))),seg,r,6,false),mat);G.add(m);return m}

function hipRoof(G,y0,ex,ez,rx,h,lift,color,opt={}){const bac=opt.style==='bac',fk=bac?1.15:.75,tex=opt.tile==='scale'?scaleT:tubeT,TS=opt.tile==='scale'?1.5:1.25,mat=lam({map:tex,color,side:THREE.DoubleSide}),s=THREE.MathUtils.clamp(h/2.1,.42,1.15),eY=u=>y0+lift*Math.pow(Math.abs(2*u-1),2.6),P=1.55;
  function sl(ea,eb,ra,rb,n,ax){const m=7,pos=[],uv=[],idx=[],L=Math.hypot(ea[0]+eb[0]-ra[0]-rb[0],ea[1]+eb[1]-ra[1]-rb[1])/2,SL=Math.hypot(L,h);for(let i=0;i<=n;i++){const u=i/n,e=[ea[0]+(eb[0]-ea[0])*u,eY(u),ea[1]+(eb[1]-ea[1])*u],r=[ra[0]+(rb[0]-ra[0])*u,y0+h,ra[1]+(rb[1]-ra[1])*u];for(let k=0;k<=m;k++){const v=k/m,c=Math.pow(v,P),X=e[0]+(r[0]-e[0])*v,Z=e[2]+(r[2]-e[2])*v;pos.push(X,e[1]+(r[1]-e[1])*c,Z);uv.push((ax?Z:X)/TS,(1-v)*SL/TS)}}
    for(let i=0;i<n;i++)for(let k=0;k<m;k++){const a=i*(m+1)+k,b=a+m+1;idx.push(a,b,a+1,b,b+1,a+1)}const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(idx);g.computeVertexNormals();G.add(new THREE.Mesh(g,mat))}
  sl([-ex,ez],[ex,ez],[-rx,0],[rx,0],18,0);sl([ex,-ez],[-ex,-ez],[rx,0],[-rx,0],18,0);sl([ex,ez],[ex,-ez],[rx,0],[rx,0],14,1);sl([-ex,-ez],[-ex,ez],[-rx,0],[-rx,0],14,1);
  const yr=y0+h,dark=lam({color:new THREE.Color(color).multiplyScalar(.55)});

  if(rx>.25){box(rx*2+.5*s,.34*s,.3*s,plasterM,0,yr+.1*s,0,G);box(rx*2+.6*s,.08*s,.4*s,dark,0,yr+.31*s,0,G);
    for(const sx of [-1,1])ribbon(G,[[sx*(rx-.1),yr+.16*s,0],[sx*(rx+.3*s),yr+.24*s,0],[sx*(rx+.5*s),yr+.4*s,0],[sx*(rx+.46*s),yr+.62*s,0],[sx*(rx+.28*s),yr+.7*s,0]],.3*s,.06*s,.13*s,plasterM,14);
    if(opt.orn&&rx>1.5*s){const d=cyl(.3*s,.3*s,.1*s,goldM,0,yr+.72*s,0,20,G);d.rotation.x=Math.PI/2;for(let i=0;i<10;i++){const an=i/10*Math.PI*2,f=new THREE.Mesh(new THREE.ConeGeometry(.07*s,.26*s,5),goldM);f.position.set(Math.cos(an)*.4*s,yr+.72*s+Math.sin(an)*.4*s,0);f.rotation.z=an-Math.PI/2;G.add(f)}
      if(opt.orn==='dragon')for(const sx of [-1,1]){const pts=[];for(let i=0;i<=8;i++){const t=i/8;pts.push([sx*(.62*s+t*(rx*.82-.62*s)),yr+.42*s+.17*s*Math.sin(t*7.5+1.2)+(i===0?.22*s:0)+t*.1*s,0])}tube(G,pts,.07*s,jadeM,26);const hd=new THREE.Mesh(new THREE.SphereGeometry(.12*s,8,6),jadeM);hd.scale.set(1.5,1,1);hd.position.set(pts[0][0],pts[0][1],0);G.add(hd)}}}
  else{cyl(.16*s,.22*s,.3*s,plasterM,0,yr+.1*s,0,8,G);const f=new THREE.Mesh(new THREE.SphereGeometry(.2*s,10,8),goldM);f.scale.y=1.5;f.position.set(0,yr+.5*s,0);G.add(f)}

  for(const sx of [-1,1])for(const sz of [-1,1]){const pts=[];for(let i=8;i>=0;i--){const v=i/8;pts.push([sx*(ex+(rx-ex)*v),y0+lift+(h-lift)*Math.pow(v,P)+.05*s,sz*ez*(1-v)])}ribbon(G,pts,.2*s,.2*s,.13*s,plasterM,16);const c0=[sx*ex,y0+lift+.05*s,sz*ez];ribbon(G,[[sx*(ex-(ex-rx)*.06),y0+lift+.05*s+(h-lift)*Math.pow(.06,P),sz*ez*.94],c0,[sx*(ex+.28*s*fk),c0[1]+.22*s*fk,sz*(ez+.28*s*fk)],[sx*(ex+.46*s*fk),c0[1]+.62*s*fk,sz*(ez+.46*s*fk)],[sx*(ex+.42*s*fk),c0[1]+.95*s*fk,sz*(ez+.42*s*fk)]],.22*s,.04*s,.12*s,plasterM,14)}

  const fm=lam({color:0x5a2a16});for(const [ea,eb] of [[[-ex,ez],[ex,ez]],[[ex,-ez],[-ex,-ez]],[[ex,ez],[ex,-ez]],[[-ex,-ez],[-ex,ez]]]){const pts=[];for(let i=0;i<=14;i++){const u=i/14;pts.push([ea[0]+(eb[0]-ea[0])*u,eY(u)-.05,ea[1]+(eb[1]-ea[1])*u])}tube(G,pts,.07*Math.max(.7,s),fm,28)}

  const ov=opt.ov||Math.min(1.4,Math.min(ex,ez)*.38),ix=ex-ov,iz=ez-ov,rm=lam({map:rafterT,color:0xffffff,side:THREE.DoubleSide});
  for(const [ea,eb,ia,ib,ax] of [[[-ex,ez],[ex,ez],[-ix,iz],[ix,iz],0],[[ex,-ez],[-ex,-ez],[ix,-iz],[-ix,-iz],0],[[ex,ez],[ex,-ez],[ix,iz],[ix,-iz],1],[[-ex,-ez],[-ex,ez],[-ix,-iz],[-ix,iz],1]]){const n=14,pos=[],uv=[],idx=[];for(let i=0;i<=n;i++){const u=i/n,X=ea[0]+(eb[0]-ea[0])*u,Z=ea[1]+(eb[1]-ea[1])*u;pos.push(X,eY(u)-.1,Z,ia[0]+(ib[0]-ia[0])*u,y0-.02,ia[1]+(ib[1]-ia[1])*u);const U=(ax?Z:X)/.34;uv.push(U,0,U,1)}for(let i=0;i<n;i++){const a=i*2;idx.push(a,a+1,a+2,a+1,a+3,a+2)}const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(idx);g.computeVertexNormals();G.add(new THREE.Mesh(g,rm))}
  box(ix*2,.1,iz*2,lam({color:0x4a2512}),0,y0-.03,0,G)}
const doorTex=(base,frame,lat,line)=>canvasTex(256,384,(g,w,h)=>{g.fillStyle=frame;g.fillRect(0,0,w,h);for(const x0 of [0,w/2]){const x=x0+7,W=w/2-14;g.fillStyle=base;g.fillRect(x,7,W,h-14);g.fillStyle='#160d08';g.fillRect(x+9,18,W-18,h*.52);g.strokeStyle=lat;g.lineWidth=4;g.save();g.beginPath();g.rect(x+9,18,W-18,h*.52);g.clip();for(let k=0;k<9;k++){g.beginPath();g.moveTo(x+9+k*(W-18)/8,18);g.lineTo(x+9+k*(W-18)/8,18+h*.52);g.stroke()}for(let k=1;k<6;k++){g.beginPath();g.moveTo(x,18+k*h*.52/6);g.lineTo(x+W,18+k*h*.52/6);g.stroke()}g.restore();g.strokeStyle=line;g.lineWidth=1.6;g.strokeRect(x+9,18,W-18,h*.52);g.strokeRect(x+11,h*.59,W-22,h*.1);g.strokeRect(x+11,h*.72,W-22,h*.24);for(let k=0;k<300;k++){g.fillStyle=`rgba(${rnd()<.5?0:255},${rnd()<.5?0:230},${rnd()<.5?0:200},${rnd()*.05})`;g.fillRect(x+rnd()*W,h*.56+rnd()*h*.4,2,10)}}g.fillStyle='#120a06';g.fillRect(w/2-2,0,4,h)});
const doorT=doorTex('#55301f','#3a2015','#6a3c26','#c9a24a'),doorB=doorTex('#4a2e22','#35211a','#5a3a2a','#5a3a2a'),doorW=doorTex('#b89a72','#8f7350','#cdb48c','#8f7350');
const signTexD=t=>canvasTex(512,112,(c,w,h)=>{c.fillStyle='#34190f';c.fillRect(0,0,w,h);c.strokeStyle='#c9a24a';c.lineWidth=5;c.strokeRect(6,6,w-12,h-12);c.fillStyle='#d9b45a';c.textAlign='center';c.textBaseline='middle';c.font='600 50px Cambria,Georgia,"Times New Roman","Noto Serif",serif';c.fillText(t,w/2,h/2+3)});
const plasterT=rep1(canvasTex(128,128,(g,w,h)=>{g.fillStyle='#d8d0be';g.fillRect(0,0,w,h);for(let k=0;k<900;k++){const d=rnd()<.5;g.fillStyle=`rgba(${d?110:255},${d?104:250},${d?92:238},${rnd()*.06})`;g.fillRect(rnd()*w,rnd()*h,4+rnd()*10,3+rnd()*7)}for(let k=0;k<14;k++){g.fillStyle='rgba(95,110,80,.06)';g.fillRect(rnd()*w,h*.7+rnd()*h*.3,14+rnd()*20,10+rnd()*20)}}));
const brickT=rep1(canvasTex(128,128,(g,w,h)=>{g.fillStyle='#8c6a58';g.fillRect(0,0,w,h);for(let j=0;j<8;j++)for(let i=-1;i<4;i++){const v=rnd()*26|0;g.fillStyle=`rgb(${172+v},${122+v*.8|0},${100+v*.7|0})`;g.fillRect(i*32+(j%2?16:0)+1,j*16+1,30,14)}}));
const archT=canvasTex(128,256,(g,w,h)=>{g.clearRect(0,0,w,h);const pth=(m)=>{g.beginPath();g.moveTo(m,h);g.lineTo(m,w/2);g.arc(w/2,w/2,w/2-m,Math.PI,0);g.lineTo(w-m,h);g.closePath()};g.fillStyle='#ece4d2';pth(2);g.fill();g.fillStyle='#1a120c';pth(16);g.fill()});
const friezeT=rep1(canvasTex(512,64,(g,w,h)=>{g.fillStyle='#4a2a1c';g.fillRect(0,0,w,h);for(let i=0;i<8;i++){const x=i*64+4;g.fillStyle='#e6dfd0';g.fillRect(x,7,56,h-14);g.strokeStyle='#4f6b88';g.lineWidth=2.2;if(i%2){g.beginPath();for(let a=0;a<9;a+=.25){const r=2+a*1.5;g.lineTo(x+20+Math.cos(a)*r,32+Math.sin(a)*r*.8)}g.stroke();g.beginPath();for(let a=0;a<7;a+=.25){const r=2+a*1.3;g.lineTo(x+40-Math.cos(a)*r,36+Math.sin(a)*r*.7)}g.stroke()}else{g.lineWidth=1.6;for(let c=0;c<5;c++){g.beginPath();g.moveTo(x+10+c*9,15);g.lineTo(x+10+c*9,15+18+((c*7)%3)*8);g.stroke()}}}}));
const winT=canvasTex(128,128,(g,w,h)=>{g.fillStyle='#1c120c';g.fillRect(0,0,w,h);g.strokeStyle='#e9dcc0';g.lineWidth=5;for(let i=1;i<6;i++){g.beginPath();g.moveTo(i*w/6,0);g.lineTo(i*w/6,h);g.stroke();g.beginPath();g.moveTo(0,i*h/6);g.lineTo(w,i*h/6);g.stroke()}g.lineWidth=7;g.beginPath();g.arc(w/2,h/2,w*.2,0,7);g.stroke()});
const ashlarT=rep1(canvasTex(256,128,(g,w,h)=>{g.fillStyle='#8f887a';g.fillRect(0,0,w,h);for(let j=0;j<2;j++)for(let i=-1;i<4;i++){const x=i*64+(j?32:0),v=176+rnd()*22|0;g.fillStyle=`rgb(${v+8},${v+3},${v-8})`;g.fillRect(x+2,j*64+2,60,60)}for(let k=0;k<700;k++){g.fillStyle=`rgba(${rnd()<.5?40:255},${rnd()<.5?40:250},${rnd()<.5?30:230},${rnd()*.07})`;g.fillRect(rnd()*w,rnd()*h,3,3)}}));
const flowT=rep1(canvasTex(64,256,(g,w,h)=>{g.fillStyle='#7fb2c4';g.fillRect(0,0,w,h);for(let i=0;i<80;i++){g.strokeStyle=`rgba(255,255,255,${.15+rnd()*.5})`;g.lineWidth=1+rnd()*2.5;const x=rnd()*w,y=rnd()*h,l=20+rnd()*60;g.beginPath();g.moveTo(x,y);g.bezierCurveTo(x+rnd()*6-3,y+l*.3,x+rnd()*6-3,y+l*.7,x+rnd()*4-2,y+l);g.stroke()}})),fallT2=flowT.clone();fallT2.needsUpdate=true;
const flowM=new THREE.MeshBasicMaterial({map:flowT,transparent:true,opacity:.9,side:THREE.DoubleSide}),fallM2=new THREE.MeshBasicMaterial({map:fallT2,color:0xeef8ff,transparent:true,opacity:.93,side:THREE.DoubleSide});
function archWall(G,w,h,ops,dep,mat,x=0,z=0){const sh=new THREE.Shape();sh.moveTo(-w/2,0);sh.lineTo(w/2,0);sh.lineTo(w/2,h);sh.lineTo(-w/2,h);sh.closePath();for(const o of ops){const hl=new THREE.Path(),r=o.w/2;hl.moveTo(o.x-r,0);hl.lineTo(o.x-r,o.h-r);hl.absarc(o.x,o.h-r,r,Math.PI,0,true);hl.lineTo(o.x+r,0);hl.closePath();sh.holes.push(hl)}const g=new THREE.ExtrudeGeometry(sh,{depth:dep,bevelEnabled:false,curveSegments:10});g.translate(0,0,-dep/2);const m=new THREE.Mesh(g,mat);m.position.set(x,0,z);G.add(m);return m}
const plM=(c)=>lam({map:plasterT,color:c});

function tHall(G,o){const {bws,dep,ver,colH,plat,roof,wall,name}=o,bac=o.style==='bac',wh=!!o.white,bays=bws.length,W=bws.reduce((a,b)=>a+b,0),xs=[-W/2];for(const b of bws)xs.push(xs[xs.length-1]+b);const bw=Math.max(...bws),T=dep+ver,zF=T/2,zW=T/2-ver,zB=-T/2,cr=o.cr||.17,y1=plat+colH,red=lam({map:woodTex,color:wh?0xe6dfd0:bac?0x8a6048:0x8a3228}),beam=lam({color:wh?0xcfc4ae:bac?0x3e261c:0x55241a}),wallM=plM(wall),stoneM=lam({color:0xa8a294}),dT=wh?doorW:bac?doorB:doorT;
  const tx=ashlarT.clone();tx.repeat.set(Math.round((W+1.6)/1.6),1);tx.needsUpdate=true;const pm=lam({map:tx});
  box(W+1.8,plat-.12,T+1.8,pm,0,(plat-.12)/2,0,G);box(W+2.1,.12,T+2.1,stoneM,0,plat-.06,0,G);
  const ns=Math.max(3,Math.round(plat/.15)),sw=bw+1.2,sd=.32;for(let i=0;i<ns;i++){const hh=plat*(1-(i+1)/(ns+1));box(sw,hh,sd,stoneM,0,hh/2,T/2+1.05+sd/2+i*sd,G)}
  for(const sx of [-1,1]){const L=Math.hypot(plat,ns*sd)+.3,c=box(.3,.34,L,pm,sx*(sw/2+.15),plat*.5+.1,T/2+1.05+ns*sd/2,G);c.rotation.x=Math.atan2(plat,ns*sd);const sc=cyl(.26,.26,.3,stoneM,sx*(sw/2+.15),.3,T/2+1.05+ns*sd+.12,14,G);sc.rotation.z=Math.PI/2}
  const colAt=(x,z)=>{cyl(cr*1.5,cr*1.8,.18,stoneM,x,plat+.09,z,12,G);cyl(cr*.92,cr,colH-.18,red,x,plat+.18+(colH-.18)/2,z,12,G)};
  for(const x of xs){colAt(x,zF);colAt(x,zW);colAt(x,zB)}
  for(const z of [zF,zB]){box(W+.5,.28,.22,beam,0,y1-.16,z,G);box(W+.3,.14,.18,beam,0,y1-.62,z,G)}
  for(const sx of [-1,1]){box(.22,.28,T+.4,beam,sx*W/2,y1-.16,0,G);box(.18,.14,ver,beam,sx*W/2,y1-.62,(zF+zW)/2,G)}
  for(const x of xs){const k=box(.14,.22,1.5,beam,x,y1-.4,zF+.62,G);k.rotation.x=.3;box(.14,.26,ver,beam,x,y1-.2,(zF+zW)/2,G)}
  box(W,colH,.26,wallM,0,plat+colH/2,zB,G);box(W+.06,.6,.32,pm,0,plat+.3,zB,G);
  for(const sx of [-1,1]){box(.26,colH,dep,wallM,sx*W/2,plat+colH/2,(zB+zW)/2,G);box(.32,.6,dep+.06,pm,sx*W/2,plat+.3,(zB+zW)/2,G);const wr=Math.min(.7,dep*.15),wn=new THREE.Mesh(new THREE.CircleGeometry(wr,28),lam({map:winT,color:0xd8c8a8}));wn.position.set(sx*(W/2+.14),plat+colH*.58,(zB+zW)/2);wn.rotation.y=sx*Math.PI/2;G.add(wn);const rg=new THREE.Mesh(new THREE.TorusGeometry(wr,.06,6,28),beam);rg.position.copy(wn.position);rg.rotation.y=Math.PI/2;G.add(rg)}
  const dh=Math.min(2.6,colH-.75);for(let i=0;i<bays;i++){const b=bws[i]-cr*2,x=(xs[i]+xs[i+1])/2,mid=i===(bays-1)/2;box(b,.2,.18,beam,x,plat+dh+.1,zW,G);const th=colH-dh-.5;if(th>.18){const tr=new THREE.Mesh(new THREE.PlaneGeometry(b-.08,th),lam({map:winT,color:wh?0xf2ead8:0xb89068}));tr.position.set(x,plat+dh+.2+th/2,zW+.02);G.add(tr)}
    if(mid){const dk=new THREE.Mesh(new THREE.PlaneGeometry(b,dh),new THREE.MeshBasicMaterial({color:0x1a0f08}));dk.position.set(x,plat+dh/2,zW-.05);G.add(dk);const gl=new THREE.Sprite(new THREE.SpriteMaterial({map:softTex,color:0xffc070,opacity:.7,transparent:true,depthWrite:false}));gl.scale.set(b*.95,dh*.9,1);gl.position.set(x,plat+dh*.5,zW);G.add(gl);
      for(const e of [-1,1]){const lf=new THREE.Mesh(new THREE.PlaneGeometry(b/2,dh),lam({map:dT,side:THREE.DoubleSide}));lf.rotation.y=e*1.25;lf.position.set(x+e*(b/2-b/4*Math.cos(1.25)),plat+dh/2,zW+b/4*.95);G.add(lf)}}
    else{const d=new THREE.Mesh(new THREE.PlaneGeometry(b,dh),lam({map:dT}));d.position.set(x,plat+dh/2,zW+.03);G.add(d);box(b,dh,.1,beam,x,plat+dh/2,zW-.04,G)}}
  const ov=o.ov||1.45;let top;const ro={tile:o.tile,style:o.style};
  if(!bac&&!o.single){const ex=W/2+ov,ez=T/2+ov,h1=ez*.33,lf=colH/7;hipRoof(G,y1,ex,ez,W/2-.5,h1,lf,roof,{...ro,ov,orn:false});
    const nx=W/2-bws[0]*.45,nz=T/2-Math.min(1.3,T*.2),ny=y1+h1*.45,nh=.85+colH*.1;box(nx*2,nh+h1*.4,nz*2,wallM,0,ny+(nh-h1*.4)/2+h1*.2,0,G);const nt=friezeT.clone();nt.repeat.set(Math.max(1,Math.round(nx/2.2)),1);nt.needsUpdate=true;for(const sz of [-1,1]){const f=new THREE.Mesh(new THREE.PlaneGeometry(nx*2-.2,nh*.6),lam({map:nt}));f.position.set(0,ny+nh*.6,sz*(nz+.01));if(sz<0)f.rotation.y=Math.PI;G.add(f)}
    const y2=ny+nh,ex2=nx+ov*.9,ez2=nz+ov*.9,h2=Math.max(2,ez2*.74);hipRoof(G,y2,ex2,ez2,Math.max(W*.2,ex2-ez2*.95),h2,lf*.9,roof,{...ro,ov:ov*.9,orn:o.orn||'pearl'});top=y2+h2+1}
  else{const ex=W/2+ov+.2,ez=T/2+ov+.2,h=bac?Math.max(colH*1.25,ez*.78):Math.max(colH*.95,ez*.66);hipRoof(G,y1,ex,ez,Math.max(W*.24,ex-ez*.8),h,bac?colH*.3:colH/7,roof,{...ro,ov:ov+.2,orn:o.orn||false});top=y1+h+1.2}
  if(name){const sw2=Math.min(bw*.95,3.2),sh=sw2*.22,sy=y1-.62-.1-sh/2;box(sw2+.14,sh+.14,.08,lam({color:0x241008}),0,sy,zF+.14,G);const sg=new THREE.Mesh(new THREE.PlaneGeometry(sw2,sh),new THREE.MeshBasicMaterial({map:signTexD(name)}));sg.position.set(0,sy,zF+.19);G.add(sg)}
  return {W,T,y1,top,zF,zW,ex:W/2+ov,ez:T/2+ov,plat,colH}}
function signTex(t){return canvasTex(512,96,(c,w,h)=>{c.fillStyle='#fbf3df';c.fillRect(0,0,w,h);c.strokeStyle='#8a5a3a';c.lineWidth=6;c.strokeRect(3,3,w-6,h-6);c.fillStyle='#3a2415';c.textAlign='center';c.textBaseline='middle';c.font='600 44px Cambria,Georgia,"Times New Roman","Noto Serif",serif';c.fillText(t,w/2,h/2+2)})}
const townPathMat=lam({map:(()=>{const t=stoneTex.clone();t.repeat.set(1,1);t.needsUpdate=true;return t})(),color:0xfff0d6});
function inWater(x,z,R){for(const b of BRIDGE)if(x>b[0]+R*.6&&x<b[1]-R*.6&&z>b[2]-.4&&z<b[3]+.4)return false;if(Math.hypot(x-ISLE[0],z-ISLE[1])<ISLE[2]-R)return false;
  for(const c of LAKE)if(Math.hypot(x-c[0],z-c[1])<c[2]+R*.5)return true;if(Math.hypot(x-22.3,z+12)<3.4)return false;for(const c of STREAM)if(Math.hypot(x-c[0],z-c[1])<1.5+R*.5)return true;return false}
(function(){const P=townG,V=(x,z)=>new THREE.Vector3(x,0,z);
  const g=new THREE.Mesh(new THREE.PlaneGeometry(120,120),lam({color:0x9db97a}));g.rotation.x=-Math.PI/2;g.position.set(0,.0,8);P.add(g);
  const pathMat=townPathMat,pathPts=[];
  function ribbon(pts,w,mat,y,closed){const cv=new THREE.CatmullRomCurve3(pts.map(p=>V(p[0],p[1])),!!closed,'catmullrom',.5),n=pts.length*10,pos=[],uv=[],idx=[];let L=0,prev=null;
    for(let i=0;i<=n;i++){const t=i/n,pt=cv.getPoint(t),tg=cv.getTangent(t),nx=-tg.z,nz=tg.x;if(prev)L+=pt.distanceTo(prev);prev=pt;pos.push(pt.x+nx*w/2,y,pt.z+nz*w/2,pt.x-nx*w/2,y,pt.z-nz*w/2);uv.push(0,L/w/2,1,L/w/2);if(mat===pathMat){pathPts.push([pt.x,pt.z]);PATHBAD.push([pt.x,pt.z,w/2])}if(i<n){const a=i*2;idx.push(a,a+1,a+2,a+1,a+3,a+2)}}
    const ge=new THREE.BufferGeometry();ge.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));ge.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));ge.setIndex(idx);ge.computeVertexNormals();const m=new THREE.Mesh(ge,mat);m.material.side=THREE.DoubleSide;P.add(m);return cv}

  const sand=lam({color:0xd9cfa8});for(const c of LAKE){const a=new THREE.Mesh(new THREE.CircleGeometry(c[2]+1,48),sand);a.rotation.x=-Math.PI/2;a.position.set(c[0],.02,c[1]);P.add(a)}
  for(const c of LAKE){const a=new THREE.Mesh(new THREE.CircleGeometry(c[2],48),seaMat);a.rotation.x=-Math.PI/2;a.position.set(c[0],.05,c[1]);P.add(a)}
  {const a=new THREE.Mesh(new THREE.CircleGeometry(ISLE[2]+.5,40),sand);a.rotation.x=-Math.PI/2;a.position.set(ISLE[0],.07,ISLE[1]);P.add(a);const b=new THREE.Mesh(new THREE.CircleGeometry(ISLE[2],40),lam({color:0xa9c088}));b.rotation.x=-Math.PI/2;b.position.set(ISLE[0],.09,ISLE[1]);P.add(b)}
  const leaf=lam({color:0x4f8f5c}),pink=lam({color:0xf4a3bd});for(let i=0;i<46;i++){const a=rnd()*6.28,r=rnd()*10,x=-11+Math.cos(a)*r,z=8+Math.sin(a)*r;if(Math.hypot(x,z-6)<10.8||Math.abs(x)<2)continue;const l=new THREE.Mesh(new THREE.CircleGeometry(.5+rnd()*.5,12),leaf);l.rotation.x=-Math.PI/2;l.position.set(x,.07,z);P.add(l);if(i%4===0){const b=new THREE.Mesh(new THREE.SphereGeometry(.22,8,6),pink);b.scale.y=1.4;b.position.set(x,.35,z);P.add(b)}}
  for(const [x,z,r] of [[12,-3,1.6],[14.5,-1.5,1.1],[-4,-8,1.3],[9,13,1.2]]){const k=new THREE.Mesh(new THREE.IcosahedronGeometry(r,1),lam({color:0x8f8a80}));k.scale.y=1.5;k.position.set(x,r*.5,z);P.add(k)}

  const redM=lam({color:0xb5392e}),redD=lam({color:0x8f2c24}),aY=z=>.22+.62*Math.sin((z-12.5)/11.9*Math.PI);for(let i=0;i<14;i++){const z0=12.5+i*.85,z1=z0+.85,zm=(z0+z1)/2,sl=Math.atan2(aY(z1)-aY(z0),.85),wet=z0>15.7&&z0<23.6;const d=box(2.8,.16,.9,redM,0,aY(zm)-.08,zm,P);d.rotation.x=-sl;if(wet)box(2.6,.12,.14,redD,0,aY(z0)-.24,z0,P);
    for(const sx of [-1,1]){for(const yy of [.9,.2]){const r=box(.09,.08,.9,redM,sx*1.32,aY(zm)+yy,zm,P);r.rotation.x=-sl}box(.11,1.02,.11,redM,sx*1.32,aY(z0)+.51,z0,P);for(let j=1;j<4;j++){const zz=z0+j*.2125;box(.04,.66,.04,redM,sx*1.32,aY(zz)+.55,zz,P)}if(wet)cyl(.1,.1,aY(z0)+.5,redD,sx*1.2,(aY(z0)-.5)/2,z0,8,P)}}
  for(const sx of [-1,1])box(.11,1.02,.11,redM,sx*1.32,aY(24.4)+.51,24.4,P);
  for(const b of BRIDGE.slice(1)){box(b[1]-b[0],.22,b[3]-b[2],mBase,(b[0]+b[1])/2,.2,(b[2]+b[3])/2,P)}

  const sc=ribbon([[31.5,-66],[30.6,-50],[29.6,-36],[28,-24],[25.2,-16.5],[22,-12],[17,-7],[13,-3]],2.6,seaMat,.05);for(let i=0;i<=70;i++){const pt=sc.getPoint(i/70);STREAM.push([pt.x,pt.z])}
  {const st=new THREE.Mesh(new THREE.CircleGeometry(3.5,28),mBase);st.rotation.x=-Math.PI/2;st.position.set(22.3,.1,-12);P.add(st);for(let i=0;i<7;i++){const a=i*.9,k=new THREE.Mesh(new THREE.IcosahedronGeometry(.45,0),lam({color:0x9a968c}));k.position.set(22.3+Math.cos(a)*3.5,.2,-12+Math.sin(a)*3.5);P.add(k)}}

  const R1=[[0,55],[-1.2,49],[-5,43.5],[-8,37],[-9,31],[-6,26.5],[0,25]],R2=[[0,55],[1.2,49],[3.6,43.5],[4.5,37],[4.6,31],[3.6,27],[0,25]];ribbon(R1,2.8,pathMat,.03);ribbon(R2,2.8,pathMat,.03);
  ribbon([[0,26.5],[-14,25],[-24,16],[-26,3],[-19,-10],[-7,-17],[8,-16],[19,-10.5],[23.1,2.5],[23,15],[13,24.5]],4,pathMat,.03,true);
  for(const b of [[[-8,37],[-12,41.5],[-15,43]],[[-24,16],[-28.5,14],[-32.6,12.4]],[[23.6,8.5],[25.4,12],[31.5,12.2]],[[-19,-10],[-21,-13],[-22,-15.8]],[[20,-10.5],[22.3,-12],[22,-15.8]],[[-14,25],[-21,28],[-26,33],[-27,36.5]],[[13,24.5],[22.5,27.3],[26.6,32.5],[27,38]]])ribbon(b,2.2,pathMat,.035);

  function sign(G,name,y,z,sc=1){const sgn=new THREE.Mesh(new THREE.PlaneGeometry(2.7,.56),new THREE.MeshBasicMaterial({map:signTexD(name)}));sgn.position.set(0,y,z);sgn.scale.setScalar(sc);G.add(sgn)}
  function pav(id,name,x,z,k,roof,wall,deco,cfg={}){const zo=.33*k,G=new THREE.Group();G.position.set(x,0,z+zo);P.add(G);
    const o=k>2.6?{bws:[2.3,2.8,3.4,2.8,2.3],dep:5.6,ver:1.9,colH:3.5,plat:1.0,cr:.2}:k>2?{bws:[2.6,3.3,2.6],dep:4.3,ver:1.6,colH:3.1,plat:.75}:{bws:[2.1,2.7,2.1],dep:3.3,ver:1.3,colH:2.7,plat:.5,cr:.15};
    const I=tHall(G,{...o,roof,wall,name,...cfg});shade(x,0,z+zo,(I.W+5),.3,P);TW_SOLID.push([x,z,2.7*k]);TW_RECT.push([x-I.W/2-.8,x+I.W/2+.8,z+zo-I.T/2-.8,z+zo+I.T/2+.8]);HALLR.push([x-I.W/2-1.05,x+I.W/2+1.05,z+zo-I.T/2-1.05,z+zo+I.T/2+1.05]);TALL.push([x,z+zo,I.ex+.3,I.top]);if(deco)deco(G,I);TOWN_PL.push({id,name,dx:x,dz:z+2.7*k+.9,ay:I.top+.6,ax:x,az:z});return G}
  const stone=lam({color:0x9a968c}),whiteM=lam({color:0xf6f2ea});
  function tower(x,z,n,r0,dr,h,body,eave,seg=8,doors){TALL.push([x,z,r0+1.6,n*(h+.3)+4]);if(doors){const b=cyl(r0+1.1,r0+1.3,.5,mBase,x,.25,z,8,P);b.rotation.y=Math.PI/8}for(let i=0;i<n;i++){const r=r0-i*dr,y=i*(h+.3)+(doors?.5:0);const t=cyl(r*.9,r,h,body,x,y+h/2,z,seg,P);if(seg===8)t.rotation.y=Math.PI/8;if(doors){box(r*.45,h*.55,.12,lam({color:0x3a2a22}),x,y+h*.36,z+r*.9,P);const ar=cyl(r*.225,r*.225,.12,lam({color:0x3a2a22}),x,y+h*.63,z+r*.9,12,P);ar.rotation.x=Math.PI/2}const e=new THREE.Mesh(new THREE.ConeGeometry(r+.55,.5,seg),eave);e.position.set(x,y+h+.2,z);e.rotation.y=seg===4?Math.PI/4:Math.PI/8;P.add(e)}const t=new THREE.Mesh(new THREE.ConeGeometry(.3,1.6,8),mGold);t.position.set(x,n*(h+.3)+(doors?1.3:.7),z);P.add(t);shade(x,0,z,r0*3.6,.3,P);TW_SOLID.push([x,z,r0+.2])}

  function phuocDuyen(x,z){const bt=brickT.clone();bt.repeat.set(16,6);bt.needsUpdate=true;const bm=lam({map:bt,color:0xf0d8c8}),tm=lam({color:0x6a4034}),am=new THREE.MeshLambertMaterial({map:archT,transparent:true,alphaTest:.5});const b=cyl(3.5,3.7,.8,lam({map:ashlarT}),x,.4,z,8,P);b.rotation.y=Math.PI/8;let y=.8;
    for(let i=0;i<7;i++){const r=2.7*Math.pow(.9,i),h=3.0*Math.pow(.9,i),t=cyl(r*.95,r,h,bm,x,y+h/2,z,8,P);t.rotation.y=Math.PI/8;for(let k=0;k<8;k++){const a=k*Math.PI/4+Math.PI/8,rb=box(.16,h,.16,plasterM,x+Math.sin(a)*r*.975,y+h/2,z+Math.cos(a)*r*.975,P);rb.rotation.y=a}
      for(let k=0;k<8;k+=2){const a=k*Math.PI/4,d=new THREE.Mesh(new THREE.PlaneGeometry(r*.42,h*.62),am);d.position.set(x+Math.sin(a)*(r*.905+.02),y+h*.33,z+Math.cos(a)*(r*.905+.02));d.rotation.y=a;P.add(d)}
      const wb=cyl(r+.1,r+.02,.14,plasterM,x,y+h-.07,z,8,P);wb.rotation.y=Math.PI/8;const e=cyl(r*.95+.1,r+.5,.2,tm,x,y+h+.1,z,8,P);e.rotation.y=Math.PI/8;y+=h+.22}
    const dm=new THREE.Mesh(new THREE.SphereGeometry(.7,12,8,0,Math.PI*2,0,Math.PI/2),tm);dm.position.set(x,y,z);P.add(dm);const sp=new THREE.Mesh(new THREE.ConeGeometry(.16,2.2,8),mGold);sp.position.set(x,y+1.6,z);P.add(sp);TALL.push([x,z,4.2,y+3]);shade(x,0,z,10,.3,P);TW_SOLID.push([x,z,2.9])}
  function steleHouse(x,z){const G5=new THREE.Group();G5.position.set(x,0,z);P.add(G5);box(3.9,.4,3.9,lam({map:ashlarT}),0,.2,0,G5);{const b2=brickT.clone();b2.repeat.set(3,3);b2.needsUpdate=true;box(3.1,2.7,3.1,lam({map:b2,color:0xf0d8c8}),0,1.75,0,G5)}const am=new THREE.MeshLambertMaterial({map:archT,transparent:true,alphaTest:.5});for(let k=0;k<4;k++){const a=k*Math.PI/2,d=new THREE.Mesh(new THREE.PlaneGeometry(1.3,2.1),am);d.position.set(Math.sin(a)*1.57,1.45,Math.cos(a)*1.57);d.rotation.y=a;G5.add(d)}hipRoof(G5,3.1,2.4,2.4,0,1.5,.3,0x9a4632,{ov:.8});TW_SOLID.push([x,z,2.2]);TALL.push([x,z,2.8,5.5])}

  pav('dilac','Chùa Di Lặc',0,3.6,2.2,0x7a4030,0xd9c9a8,(G,I)=>{for(let i=0;i<7;i++){const l=new THREE.Mesh(new THREE.SphereGeometry(.17,10,8),new THREE.MeshLambertMaterial({color:0xb5392e,emissive:0xff5a30,emissiveIntensity:0}));l.scale.y=1.25;const u=i/6;l.position.set(-I.W/2+.5+u*(I.W-1),I.y1-.95-Math.sin(u*Math.PI)*.22,I.zF+.35);G.add(l);lanterns.push(l);cyl(.012,.012,.3,mWoodDark,l.position.x,l.position.y+.38,l.position.z,4,G)}},{style:'bac',tile:'scale'});
  {const G2=new THREE.Group();G2.position.set(0,0,12.7);P.add(G2);const pm2=plM(0xe6dfd0);archWall(G2,5.2,3.5,[{x:0,w:2.4,h:2.9}],.9,pm2);hipRoof(G2,3.5,3.2,1.05,2.4,.55,.3,0x7a4030,{style:'bac',tile:'scale',ov:.5});box(3.2,2.0,.8,pm2,0,4.6,0,G2);for(const sz of [-1,1]){const mw=new THREE.Mesh(new THREE.CircleGeometry(.52,24),lam({map:winT,color:0xd8c8a8}));mw.position.set(0,4.75,sz*.41);if(sz<0)mw.rotation.y=Math.PI;G2.add(mw);const rg=new THREE.Mesh(new THREE.TorusGeometry(.52,.06,6,24),lam({color:0x4a2e22}));rg.position.copy(mw.position);G2.add(rg)}hipRoof(G2,5.6,2.4,1.1,1.4,1.0,.45,0x7a4030,{style:'bac',tile:'scale',ov:.6});for(const sx of [-1,1]){TW_SOLID.push([sx*2,12.7,.5]);TW_RECT.push([sx>0?1.2:-2.6,sx>0?2.6:-1.2,12.25,13.15])}TALL.push([0,12.7,3.2,7.5])}
  {const x=6.1,z=10.5;cyl(1.5,1.6,.3,mBase,x,.25,z,8,P);for(const a of [0,1,2,3]){const an=a*Math.PI/2+Math.PI/4;cyl(.1,.11,2.2,mWood,x+Math.cos(an)*1.1,1.5,z+Math.sin(an)*1.1,8,P)}for(const [r,y] of [[2,2.9],[1.2,3.7]]){const c=new THREE.Mesh(new THREE.ConeGeometry(r,.8,4),lam({color:0xc8482c}));c.rotation.y=Math.PI/4;c.position.set(x,y,z);P.add(c)}TW_SOLID.push([x,z,1.5])}
  for(const [a,b,r] of [[-3.4,29.6,2.2],[-4.9,30.4,1.3],[-2.2,30.8,1.1]]){const k=new THREE.Mesh(new THREE.IcosahedronGeometry(r,1),stone);k.scale.y=.6;k.position.set(a,r*.25,b);P.add(k)}TW_SOLID.push([-3.4,29.9,2.3]);{const x=-3.4,z=29.6,sm=lam({map:ashlarT,color:0xe8e2d6});let y=.9;for(let i=0;i<5;i++){const w=1.5*Math.pow(.9,i);box(w,1.3,w,sm,x,y+.65,z,P);box(w+.14,.1,w+.14,stone,x,y+1.35,z,P);y+=1.4}const tp=new THREE.Mesh(new THREE.ConeGeometry(.52,1.9,12),lam({color:0x6e6a62}));tp.position.set(x,y+.95,z);P.add(tp);TALL.push([x,z,2,y+2])}
  for(const [x,z,c] of [[-7.1,4.2,0xf59ab5],[7.1,3.0,0xf6cf3a]]){cyl(.14,.2,1.6,lam({color:0x5a3a28}),x,.9,z,6,P);const m=lam({color:c});for(let i=0;i<8;i++){const b=new THREE.Mesh(new THREE.IcosahedronGeometry(.5+rnd()*.3,1),m);b.position.set(x+rnd()*1.6-.8,1.9+rnd()*1.2,z+rnd()*1.4-.7);P.add(b)}TW_SOLID.push([x,z,.5])}

  pav('quanam','Chùa Quan Âm',31.5,4,2.2,0x4f6b78,0xf2ecdf,null,{style:'hue',white:true,tile:'tube'});tower(36,-3,9,1.35,.07,1.15,whiteM,lam({color:0x5f7f95}));
  for(const [x,z,r] of [[37,10.5,1.7],[38,7,1.3],[36.5,13.5,1.2],[38.2,-.5,1.1],[36.6,-.2,1.0]]){const k=new THREE.Mesh(new THREE.IcosahedronGeometry(r,1),stone);k.scale.y=.8;k.position.set(x,r*.5,z);P.add(k);TW_SOLID.push([x,z,r])}
  for(let i=0;i<7;i++){const f=new THREE.Sprite(new THREE.SpriteMaterial({map:softTex,color:0xffffff,opacity:.7,transparent:true,depthWrite:false}));f.scale.set(14+rnd()*8,1.1,1);f.position.set(46+i*5,.3,-20+rnd()*50);P.add(f)}

  {const x=-33,z=5,wood=lam({color:0x8a4a26});const pd=new THREE.Mesh(new THREE.PlaneGeometry(10,10),seaMat);pd.rotation.x=-Math.PI/2;pd.position.set(x,.08,z);P.add(pd);
    for(const [a,b,w,d] of [[0,5.15,10.6,.4],[0,-5.15,10.6,.4],[5.15,0,.4,10.6],[-5.15,0,.4,10.6]])box(w,.7,d,mBase,x+a,.35,z+b,P);
    for(let i=0;i<18;i++){const lx=x-4.3+rnd()*8.6,lz=z-4.3+rnd()*8.6;if(Math.hypot(lx-x,lz-z)<1.2)continue;const l=new THREE.Mesh(new THREE.CircleGeometry(.4+rnd()*.35,12),leaf);l.rotation.x=-Math.PI/2;l.position.set(lx,.1,lz);P.add(l);if(i%3===0){const b=new THREE.Mesh(new THREE.SphereGeometry(.2,8,6),pink);b.scale.y=1.4;b.position.set(lx,.36,lz);P.add(b)}}
    cyl(.6,.65,3.4,stone,x,1.7,z,14,P);for(let a=0;a<8;a++){const an=a*Math.PI/4;const br=box(2.0,.2,.2,wood,x+Math.cos(an)*1.0,2.95,z+Math.sin(an)*1.0,P);br.rotation.y=-an;br.rotation.z=.52}
    box(3.8,.25,3.8,wood,x,3.5,z,P);box(3,1.5,3,lam({color:0xb9703a}),x,4.4,z,P);const d=new THREE.Mesh(new THREE.PlaneGeometry(1.2,1.3),lam({map:latticeTex}));d.position.set(x,4.3,z+1.51);P.add(d);
    {const G1=new THREE.Group();G1.position.set(x,0,z);P.add(G1);hipRoof(G1,5.15,2.75,2.75,.9,1.45,.7,0xb8683c);const mo=cyl(.28,.28,.08,mGold,0,7.05,0,16,G1);mo.rotation.x=Math.PI/2;for(const sx of [-1,1]){const dr=new THREE.Mesh(new THREE.TorusGeometry(.42,.07,6,12,Math.PI*.8),mWoodDark);dr.position.set(sx*.75,6.75,0);dr.rotation.z=sx>0?.4:Math.PI-.4+Math.PI*.2;G1.add(dr)}}
    {const bm=lam({map:brickT}),cm=lam({color:0xc9c2b2});for(let i=0;i<14;i++){const hh=(i+1)*.25,zz=z+2.1+(13-i)*.36;box(1.4,hh,.36,bm,x,hh/2,zz,P);box(1.44,.05,.38,cm,x,hh+.02,zz,P);for(const sx of [-1,1]){box(.22,hh+.5,.36,bm,x+sx*.81,(hh+.5)/2,zz,P);box(.3,.07,.38,cm,x+sx*.81,hh+.53,zz,P)}}}
   const sg=new THREE.Mesh(new THREE.PlaneGeometry(2.7,.5),new THREE.MeshBasicMaterial({map:signTex('Chùa Liên Trì')}));sg.position.set(x,5.05,z+1.53);P.add(sg);
    TW_RECT.push([x-5.35,x+5.35,z-5.35,z+5.35],[x-1,x+1,z+5.35,z+7.05]);TOWN_PL.push({id:'lientri',name:'Chùa Liên Trì',dx:x,dz:z+8,ay:8.4,ax:x,az:z})}

  pav('diatang','Chùa Địa Tạng',-22,-50,2.2,0x5e4236,0x8a7a68,null,{style:'bac',tile:'scale'});
  {const x=-22,c=new THREE.Mesh(new THREE.CircleGeometry(6.2,36),lam({color:0xb5694a}));c.rotation.x=-Math.PI/2;c.position.set(x,.03,-12.5);P.add(c);

    for(const sx of [-1,1]){for(let i=0;i<6;i+=2){const z=-16.4+i*1.7;box(.5,.7,.5,lam({color:0x4a4038}),x+sx*4.4,.35,z,P);lampAt(P,x+sx*4.4,.7,z,1.2);TW_SOLID.push([x+sx*4.4,z,.36])}TW_SOLID.push([x+sx*2.6,-6.6,.35]);TW_RECT.push([x+(sx>0?1.3:-2.7),x+(sx>0?2.7:-1.3),-7.1,-6.1])}for(const sx of [-1,1]){const z=-10.4,jm=lam({color:0x6a4a3a});cyl(.62,.4,.75,jm,x+sx*2.9,.375,z,16,P);cyl(.66,.62,.08,jm,x+sx*2.9,.79,z,16,P);const wd=new THREE.Mesh(new THREE.CircleGeometry(.56,16),seaMat);wd.rotation.x=-Math.PI/2;wd.position.set(x+sx*2.9,.76,z);P.add(wd);const lf=new THREE.Mesh(new THREE.CircleGeometry(.3,12),lam({color:0x5f9a5a}));lf.rotation.x=-Math.PI/2;lf.position.set(x+sx*2.9+.12,.78,z);P.add(lf);TW_SOLID.push([x+sx*2.9,z,.66])}
    {const G6=new THREE.Group();G6.position.set(x,0,-6.6);P.add(G6);archWall(G6,5.4,3.9,[{x:0,w:2.6,h:3.1}],1.0,plM(0x9a968a));hipRoof(G6,3.9,3.3,1.15,2.3,.95,.4,0x5e4236,{style:'bac',tile:'scale',ov:.6});TALL.push([x,-6.6,3.3,6.2])}}

  pav('duocsu','Chùa Dược Sư',22,-50,2.2,0x35506c,0xd9c492,null,{style:'hue',tile:'tube',orn:'dragon'});
  {const gx=22,gz=-6.6,gm=plM(0xc9c2a6),G3=new THREE.Group();G3.position.set(gx,0,gz);P.add(G3);for(const dx of [-3.6,-1.4,1.4,3.6])TW_SOLID.push([gx+dx,gz,.5]);archWall(G3,9,3.8,[{x:0,w:2.2,h:3.0},{x:-2.9,w:1.5,h:2.3},{x:2.9,w:1.5,h:2.3}],1.0,gm);for(const dx of [-3.1,3.1]){const G4=new THREE.Group();G4.position.set(dx,0,0);G3.add(G4);hipRoof(G4,3.8,1.75,1.0,1.0,.6,.2,0x35506c,{ov:.5})}box(3.0,1.5,.9,gm,0,4.45,0,G3);for(const sz of [-1,1])for(const e of [-1,1]){const lf=new THREE.Mesh(new THREE.SphereGeometry(.34,12,8),lam({color:0x4f8a5a}));lf.scale.set(1.5,.7,.12);lf.rotation.z=e*.5;lf.position.set(e*.5,4.5,sz*.47);G3.add(lf)}hipRoof(G3,5.2,2.2,1.05,1.3,.9,.22,0x35506c,{ov:.6,orn:'pearl'});TALL.push([gx,gz,4.6,7.2])}
  {const hp=new THREE.Mesh(new THREE.CircleGeometry(3.2,24,0,Math.PI),seaMat);hp.rotation.x=-Math.PI/2;hp.position.set(13.5,.06,-17.5);P.add(hp);const rm2=new THREE.Mesh(new THREE.TorusGeometry(3.2,.18,6,24,Math.PI),mBase);rm2.rotation.x=-Math.PI/2;rm2.position.set(13.5,.1,-17.5);P.add(rm2);TW_SOLID.push([13.5,-19,2.6]);
    for(const sx of [-1,1]){cyl(.12,.16,1.2,lam({color:0x6a4a34}),22+sx*5.2,.6,-16.6,6,P);const lf=new THREE.Mesh(new THREE.SphereGeometry(1.2,14,10),lam({color:0x4f9a52}));lf.scale.set(.9,1.7,.3);lf.rotation.z=sx*.35;lf.position.set(22+sx*5.2,2.7,-16.6);P.add(lf);TW_SOLID.push([22+sx*5.2,-16.6,.6])}
    const soil=lam({color:0x7a5a3e});for(const z of [-25,-21,-17]){box(4.4,.3,2.6,soil,32.5,.15,z,P);for(let i=0;i<10;i++){const c=new THREE.Mesh(new THREE.ConeGeometry(.2+rnd()*.1,.5+rnd()*.4,6),lam({color:[0x5fa35a,0x7fbf6a,0x4f8f52][i%3]}));c.position.set(30.8+(i%5)*.85,.55,z-.6+(i/5|0)*1.2);P.add(c)}TW_RECT.push([30.3,34.7,z-1.3,z+1.3])}}

  {const x=-27,z=30,gold=lam({color:0xc9a24a,emissive:0x3a2806}),white=lam({color:0xf6f1e6});function stp(sx,sz,k){const G=new THREE.Group();G.position.set(sx,0,sz);G.scale.setScalar(k);P.add(G);cyl(1.7,1.8,.4,white,0,.2,0,8,G);cyl(1.3,1.45,.4,white,0,.6,0,8,G);const bell=new THREE.Mesh(new THREE.SphereGeometry(1.05,18,12,0,Math.PI*2,0,Math.PI*.62),gold);bell.scale.y=1.15;bell.position.y=.85;G.add(bell);const sp=new THREE.Mesh(new THREE.ConeGeometry(.26,1.7,10),gold);sp.position.y=2.9;G.add(sp);TW_SOLID.push([sx,sz,1.9*k]);return G}
    const sd=new THREE.Mesh(new THREE.CircleGeometry(8.5,36),lam({color:0xe9d9b0}));sd.rotation.x=-Math.PI/2;sd.position.set(x,.025,z);P.add(sd);const G=stp(x,z,2.3);for(const a of [-1,1])for(const b of [-1,1])stp(x+a*5.8,z+b*5.4-.6,.62);
    {const vx=-34,vz=21.5,V=new THREE.Group();V.position.set(vx,0,vz);P.add(V);box(6.4,.7,10,white,0,.35,0,V);box(4.6,3.2,8,lam({color:0xf4e6c0}),0,2.3,0,V);for(const sz of [-1,1])for(const sx of [-1,1])for(let q=0;q<3;q++)cyl(.14,.15,3.2,white,sx*2.75,2.3,sz*(1.2+q*1.3),8,V);
      [[3.9,5.9,0xb8562c,3.9,1.5],[2.9,5.1,0xb8562c,4.9,2.3],[1.9,4.3,0xb8562c,6.4,2.5]].forEach(([w,l,c,y,h])=>{const sh=new THREE.Shape();sh.moveTo(-w,0);sh.lineTo(w,0);sh.lineTo(0,h);sh.closePath();const ge=new THREE.ExtrudeGeometry(sh,{depth:l*2,bevelEnabled:false});ge.translate(0,0,-l);const g2=new THREE.Mesh(ge,lam({map:tubeT,color:c}));g2.position.y=y;V.add(g2);for(const sx of [-1,1]){const eb=box(.12,.12,l*2+.1,gold,sx*w,y+.02,0,V);const L=Math.hypot(w,h);for(const sz of [-1,1]){const rk=box(.14,L,.14,gold,sx*w/2,y+h/2,sz*l,V);rk.rotation.z=sx*Math.atan2(w,h)}}for(const sz of [-1,1]){const f=new THREE.Mesh(new THREE.ConeGeometry(.09,1.1,6),gold);f.position.set(0,y+.5,sz*l*.98);f.rotation.x=-sz*.9;V.add(f)}});
      const sp2=new THREE.Mesh(new THREE.ConeGeometry(.14,1.6,8),gold);sp2.position.y=9;V.add(sp2);shade(vx,0,vz,13,.3,P);TW_SOLID.push([vx,vz-2.4,3.6],[vx,vz+2.4,3.6])}
    cyl(.05,.05,1.3,mWoodDark,0,.65,2.25,6,G);sign(G,'Chùa Nam Tông',.95,2.28,.5);shade(x,0,z,11,.3,P);TW_SOLID.push([x,z+5.2,.4]);TOWN_PL.push({id:'namtong',name:'Chùa Nam Tông',dx:x,dz:z+6.9,ay:9,ax:x,az:z})}

  {const x=-15,z=35.5,G=new THREE.Group();G.position.set(x,0,z);G.scale.setScalar(1.2);P.add(G);for(const sx of [-1,1])for(const dz of [6.4,10.2]){areca(P,x+sx*6.4,z+dz,5.6+(dz>8?.7:0));TW_SOLID.push([x+sx*6.4,z+dz,.3])}box(11,.4,6.6,mBase,0,.2,0,G);box(9.4,2.5,4.4,lam({color:0xb9855a}),0,1.65,0,G);for(const cx of [-4.3,-1.45,1.45,4.3])cyl(.16,.18,2.5,mWood,cx,1.65,2.85,10,G);
    for(const dx of [-2.9,0,2.9]){const d=new THREE.Mesh(new THREE.PlaneGeometry(1.7,2),lam({map:latticeTex}));d.position.set(dx,1.4,2.21);G.add(d)}
    hipRoof(G,2.95,6.3,4.0,3.7,2.5,.38,0x7a4030,{style:'hue',ov:1.3,orn:'pearl'});
    const sg=new THREE.Mesh(new THREE.PlaneGeometry(3.6,.66),new THREE.MeshBasicMaterial({map:signTex('Từ Đường')}));sg.position.set(0,2.62,2.24);G.add(sg);
    for(const sx of [-1,1]){cyl(.5,.4,.5,lam({color:0x3f5f66}),sx*4,.25,4.6,12,G);const b=new THREE.Mesh(new THREE.IcosahedronGeometry(.6,1),lam({color:0x4f8f52}));b.position.set(sx*4,1.1,4.6);G.add(b);TW_SOLID.push([x+sx*4.8,z+5.5,.66])}
    box(4.4,1.8,.45,lam({color:0xe9dcc0}),0,.9,11.6,G);box(4.8,.25,.7,lam({color:0x7a4a30}),0,1.9,11.6,G);TW_RECT.push([x-2.9,x+2.9,z+13.55,z+14.3]);
    shade(x,0,z,17,.3,P);TW_SOLID.push([x-3.3,z,4.2],[x+3.3,z,4.2]);TOWN_PL.push({id:'tuduong',name:'Từ Đường',dx:x,dz:z+5.7,ay:7.8,ax:x,az:z})}

  {const x=27,z=31,G=new THREE.Group();G.position.set(x,0,z);G.scale.setScalar(2);P.add(G);const gp=new THREE.Mesh(new THREE.PlaneGeometry(6,4.6),lam({color:0x8fd06c}));gp.rotation.x=-Math.PI/2;gp.position.y=.02;G.add(gp);const paw=new THREE.MeshBasicMaterial({color:0xffffff});
    [0xf7b8c4,0xa9dcf2,0xfbe08f].forEach((c,i)=>{const m=lam({color:c}),sx=-1.5+i*1.5;box(.6,.6,.16,m,sx,.4,-.6,G);const t=cyl(.3,.3,.16,m,sx,.7,-.6,16,G);t.rotation.x=Math.PI/2;const pd=new THREE.Mesh(new THREE.CircleGeometry(.1,12),paw);pd.position.set(sx,.55,-.51);G.add(pd);for(let q=0;q<4;q++){const toe=new THREE.Mesh(new THREE.CircleGeometry(.04,8),paw);toe.position.set(sx-.13+q*.087,.7-Math.abs(q-1.5)*.025,-.51);G.add(toe)}TW_SOLID.push([x+sx*2,z-1.2,.9])});
    for(let i=0;i<14;i++){const b=new THREE.Mesh(new THREE.SphereGeometry(.08,8,6),lam({color:[0xff8fa3,0xffd166,0xffffff,0xc79bf2][i%4]}));b.position.set(-2.7+rnd()*5.4,.14,.4+rnd()*1.2);G.add(b)}
    for(const sx of [-1,1]){cyl(.1,.11,2.2,lam({color:0xf2e9d6}),sx*1.6,1.1,2.1,8,G);TW_SOLID.push([x+sx*3.2,z+4.2,.35])}box(3.6,.16,.2,lam({color:0xf2e9d6}),0,2.25,2.1,G);sign(G,'Vườn Tưởng Niệm',1.9,2.12);TOWN_PL.push({id:'pet',name:'Vườn Tưởng Niệm',dx:x,dz:z+6.4,ay:6.6,ax:x,az:z+2})}

  const wallM=plM(0xd2b98a),cap=lam({map:tubeT,color:0x5a4a40});function wall(x0,z0,x1,z1){const dx=x1-x0,dz=z1-z0,L=Math.hypot(dx,dz),m=box(L,2.2,.5,wallM,(x0+x1)/2,1.1,(z0+z1)/2,P);m.rotation.y=-Math.atan2(dz,dx);const c=box(L,.3,.9,cap,(x0+x1)/2,2.35,(z0+z1)/2,P);c.rotation.y=m.rotation.y;TW_RECT.push([Math.min(x0,x1)-.3,Math.max(x0,x1)+.3,Math.min(z0,z1)-.3,Math.max(z0,z1)+.3])}
  wall(-40,56,-7.8,56);wall(7.8,56,40,56);wall(-40,56,-40,-65);wall(40,56,40,16);wall(40,-8,40,-65);for(let z=-8;z<=16;z+=2)cyl(.12,.14,1,lam({color:0xf6f2ea}),40,.5,z,8,P);box(.2,.12,24,lam({color:0xf6f2ea}),40,1.0,4,P);TW_RECT.push([39.7,40.3,-8,16]);wall(-40,-65,40,-65);wall(-2.6,39.5,2.6,39.5);
  function tamQuan(gz,open,label,k=1){const G7=new THREE.Group();G7.position.set(0,0,gz);G7.scale.setScalar(k);P.add(G7);const pm3=plM(0xe6dfd0);
    archWall(G7,5.6,4.7,[{x:0,w:3.3,h:3.9}],1.2,pm3);for(const sx of [-1,1]){archWall(G7,5.0,3.8,[{x:0,w:2.1,h:2.9}],1.1,pm3,sx*5.3,0);if(!open){const d=new THREE.Mesh(new THREE.PlaneGeometry(2.1,2.9),lam({map:doorT}));d.position.set(sx*5.3,1.45,0);G7.add(d);const d2=d.clone();d2.rotation.y=Math.PI;d2.position.z=-.01;G7.add(d2)}const G8=new THREE.Group();G8.position.set(sx*5.3,0,0);G7.add(G8);hipRoof(G8,3.8,3.1,1.2,2.2,.95,.3,0x9a4632,{ov:.6})}
    hipRoof(G7,4.7,3.5,1.3,2.6,.7,.3,0x9a4632,{ov:.6});box(3.4,1.5,1.0,pm3,0,5.6,0,G7);const nt=friezeT.clone();nt.repeat.set(1,1);nt.needsUpdate=true;for(const sz of [-1,1]){const f=new THREE.Mesh(new THREE.PlaneGeometry(3.1,.6),lam({map:nt}));f.position.set(0,5.75,sz*.51);if(sz<0)f.rotation.y=Math.PI;G7.add(f);const sg=new THREE.Mesh(new THREE.PlaneGeometry(2.6,.57),new THREE.MeshBasicMaterial({map:signTexD(label)}));sg.position.set(0,4.25,sz*.62);if(sz<0)sg.rotation.y=Math.PI;G7.add(sg)}hipRoof(G7,6.35,2.6,1.2,1.6,1.1,.3,0x9a4632,{ov:.6,orn:'pearl'});TALL.push([0,gz,3*k,8.6*k],[-5.3*k,gz,3*k,6*k],[5.3*k,gz,3*k,6*k]);for(const [a,b] of [[1.65,2.8],[2.8,4.25],[6.35,7.8]])for(const e of [-1,1])TW_RECT.push([(e>0?a:-b)*k,(e>0?b:-a)*k,gz-.6*k,gz+.6*k]);if(!open)for(const e of [-1,1])TW_RECT.push([e>0?4.25:-6.35,e>0?6.35:-4.25,gz-.6,gz+.6])}
  tamQuan(56,false,'Thị trấn Mây');

  {const g2=new THREE.Mesh(new THREE.PlaneGeometry(120,104),lam({color:0x9db97a}));g2.rotation.x=-Math.PI/2;g2.position.set(0,0,120);P.add(g2);
    const pave=(w,d,x,z,c=0xc4beb0)=>{const t=stoneTex.clone();t.repeat.set(Math.round(w/3),Math.round(d/3));t.needsUpdate=true;const m=new THREE.Mesh(new THREE.PlaneGeometry(w,d),lam({map:t,color:c}));m.rotation.x=-Math.PI/2;m.position.set(x,.02,z);P.add(m)};
    pave(62,29,0,141.5);pave(40,27,0,112.5);pave(31,17,0,92,0xcfc8b8);pave(24,7,0,160);
    wall(-40,156,-40,56);wall(40,156,40,56);wall(-40,156,-8.6,156);wall(8.6,156,40,156);wall(-40,126,-10.5,126);wall(10.5,126,40,126);

    for(const [x,h] of [[-8,5.2],[-3.4,6.6],[3.4,6.6],[8,5.2]]){const pm=plM(0xe6dfd0);box(1.5,.5,1.5,lam({map:ashlarT}),x,.25,156,P);box(1.05,h,1.05,pm,x,h/2+.5,156,P);box(1.35,.25,1.35,pm,x,h+.6,156,P);box(1.15,.5,1.15,lam({map:friezeT}),x,h-.2,156,P);const bd=new THREE.Mesh(new THREE.SphereGeometry(.42,12,10),pm);bd.scale.y=1.5;bd.position.set(x,h+1.25,156);P.add(bd);TW_SOLID.push([x,156,.85]);TALL.push([x,156,1.2,h+2])}
    box(6.8,.3,.3,plM(0xe6dfd0),0,6.2,156,P);const sg0=new THREE.Mesh(new THREE.PlaneGeometry(3.4,.75),new THREE.MeshBasicMaterial({map:signTexD('Thị trấn Mây'),side:THREE.DoubleSide}));sg0.position.set(0,5.55,156);P.add(sg0);

    {const c=new THREE.Mesh(new THREE.CircleGeometry(7,8),lam({map:ashlarT,color:0xf2ead8}));c.rotation.x=-Math.PI/2;c.rotation.z=Math.PI/8;c.position.set(0,.05,141);P.add(c)}
    phuocDuyen(0,141);for(const x of [-12,12,-23,23])steleHouse(x,141);
    tamQuan(126,true,'Chùa Mây',1.35);

    const roofC=0x9a4632,TY=1.2,zh=88,zf=98.2;

    {const tm=lam({map:(()=>{const t=ashlarT.clone();t.repeat.set(24,1);t.needsUpdate=true;return t})()}),cm=lam({color:0xb9b1a0});
      box(36,TY-.12,24.6,tm,0,(TY-.12)/2,94.2,P);box(36.3,.12,24.9,cm,0,TY-.06,94.2,P);box(16,TY-.12,4.6,tm,0,(TY-.12)/2,108.6,P);box(16.3,.12,4.8,cm,0,TY-.06,108.6,P);
      const stair=(x,z0,w)=>{const n=8,sd=.32;for(let i=0;i<n;i++){const hh=TY*(1-(i+1)/(n+1));box(w,hh,sd,cm,x,hh/2,z0+sd/2+i*sd,P)}for(const e of [-1,1]){const L=Math.hypot(TY,n*sd)+.3,c=box(.34,.36,L,tm,x+e*(w/2+.17),TY*.5+.1,z0+n*sd/2,P);c.rotation.x=Math.atan2(TY,n*sd)}};
      stair(0,110.9,6);stair(-13,106.5,3.4);stair(13,106.5,3.4);
      const post=(x,z)=>{box(.24,.95,.24,cm,x,TY+.47,z,P);const b=new THREE.Mesh(new THREE.SphereGeometry(.15,8,6),cm);b.scale.y=1.4;b.position.set(x,TY+1.08,z);P.add(b)};
      const rail=(x0,z0,x1,z1)=>{const L=Math.hypot(x1-x0,z1-z0),n=Math.max(1,Math.round(L/2.2));for(let i=0;i<=n;i++)post(x0+(x1-x0)*i/n,z0+(z1-z0)*i/n);box(x1===x0?.14:L,.14,x1===x0?L:.14,cm,(x0+x1)/2,TY+.78,(z0+z1)/2,P);box(x1===x0?.1:L,.3,x1===x0?L:.1,tm,(x0+x1)/2,TY+.3,(z0+z1)/2,P)};
      rail(-17.9,82.1,-17.9,106.3);rail(17.9,82.1,17.9,106.3);rail(-17.9,106.3,-14.9,106.3);rail(-11.1,106.3,-8,106.3);rail(17.9,106.3,14.9,106.3);rail(11.1,106.3,8,106.3);rail(-8,106.3,-8,110.7);rail(8,106.3,8,110.7);rail(-8,110.7,-3.2,110.7);rail(8,110.7,3.2,110.7)}
    const G=new THREE.Group();G.position.set(0,TY,zh);P.add(G);const I=tHall(G,{bws:[2.4,2.8,3.2,3.6,4.0,3.6,3.2,2.8,2.4],dep:8,ver:2.4,colH:4.2,plat:1.2,cr:.25,ov:1.9,roof:roofC,wall:0xe6dfd0,style:'hue',tile:'tube',orn:'dragon'});
    const F=new THREE.Group();F.position.set(0,TY,zf);P.add(F);const I2=tHall(F,{bws:[2.8,3.2,3.6,4.0,3.6,3.2,2.8],dep:3.6,ver:2.2,colH:3.6,plat:1.2,cr:.22,ov:1.7,roof:roofC,wall:0xe6dfd0,name:'Chùa Mây',style:'hue',tile:'tube',single:true,orn:'pearl'});
    shade(0,0,95,46,.3,P);TW_RECT.push([-14.9,14.9,81.9,94.1],[-13,13,94.1,102.1],[-2.8,2.8,102.1,104.8],[-18.4,-17.6,81.5,106.8],[17.6,18.4,81.5,106.8],[-18.4,-14.9,81.5,82.1],[14.9,18.4,81.5,82.1],[-18.4,-14.9,106.2,106.8],[-11.1,-8,106.2,106.8],[8,11.1,106.2,106.8],[14.9,18.4,106.2,106.8],[-8.4,-7.7,106.5,111.1],[7.7,8.4,106.5,111.1],[-8.4,-3.2,110.6,111.2],[3.2,8.4,110.6,111.2],[-3.5,-3.1,110.9,113.6],[3.1,3.5,110.9,113.6],[-15.1,-14.7,106.5,109.2],[-11.3,-10.9,106.5,109.2],[10.9,11.3,106.5,109.2],[14.7,15.1,106.5,109.2]);HALLR.push([-18.4,18.4,81.5,106.9],[-8.5,8.5,106.5,113.8]);TALL.push([0,90,I.ex+.6,TY+I.top],[0,98.2,I2.ex+.3,TY+I2.top]);TOWN_PL.push({id:'chuamay',name:'Chùa Mây',dx:0,dz:105.6,ay:TY+I.top+.6,ax:0,az:90});

    for(const sx of [-1,1]){const Gg=new THREE.Group();Gg.position.set(sx*34,0,104.5);Gg.rotation.y=Math.PI/2;P.add(Gg);box(41,.4,3.4,lam({map:ashlarT}),0,.2,0,Gg);const cmat=lam({map:woodTex,color:0x8a3228}),bmat=lam({color:0x55241a});for(let i=0;i<13;i++){const lx=-20.2+i*3.366;for(const lz of [-1.3,1.3])cyl(.13,.15,2.9,cmat,lx,1.85,lz,10,Gg)}for(const lz of [-1.3,1.3])box(41,.22,.18,bmat,0,3.2,lz,Gg);box(41,2.9,.2,plM(0xe6dfd0),0,1.85,sx*1.55,Gg);hipRoof(Gg,3.32,21.6,2.6,20.2,1.25,.22,roofC,{ov:.9,orn:false});TW_RECT.push([sx*34-1.9,sx*34+1.9,83.8,125.2]);for(let z=88;z<=122;z+=8.5)TALL.push([sx*34,z,3.6,5.6])}

    for(const sx of [-1,1]){const S=new THREE.Group();S.position.set(sx*27.6,0,111);S.rotation.y=-sx*Math.PI/2;P.add(S);const J=tHall(S,{bws:[2.2,2.6,3.0,2.6,2.2],dep:4,ver:1.5,colH:3.0,plat:.6,roof:roofC,wall:0xe6dfd0,style:'hue',tile:'tube',single:true});shade(sx*27.6,0,111,16,.3,P);TW_RECT.push([sx*27.6-J.T/2-.9,sx*27.6+J.T/2+.9,111-J.W/2-.9,111+J.W/2+.9]);HALLR.push([sx*27.6-J.T/2-1,sx*27.6+J.T/2+1,111-J.W/2-1,111+J.W/2+1]);TALL.push([sx*27.6,111,J.ex+.3,J.top])}

    for(const sx of [-1,1]){const x=sx*13,z=120.5,L=new THREE.Group();L.position.set(x,0,z);P.add(L);box(5.2,.5,5.2,lam({map:ashlarT}),0,.25,0,L);for(const a of [-1,1])for(const b of [-1,1]){cyl(.27,.32,.16,lam({color:0xa8a294}),a*1.8,.58,b*1.8,12,L);cyl(.17,.19,3.0,lam({map:woodTex,color:0xa8483a}),a*1.8,2.15,b*1.8,12,L)}box(4.0,.26,.2,lam({color:0x55241a}),0,3.5,1.8,L);box(4.0,.26,.2,lam({color:0x55241a}),0,3.5,-1.8,L);box(.2,.26,4.0,lam({color:0x55241a}),1.8,3.5,0,L);box(.2,.26,4.0,lam({color:0x55241a}),-1.8,3.5,0,L);
      hipRoof(L,3.65,3.3,3.3,1.0,1.0,.4,roofC,{ov:1.3});box(2.4,1.5,2.4,plM(0xe6dfd0),0,4.9,0,L);for(let k=0;k<4;k++){const w=new THREE.Mesh(new THREE.PlaneGeometry(1.2,.8),lam({map:winT,color:0xb89068}));w.position.set(Math.sin(k*Math.PI/2)*1.21,5.0,Math.cos(k*Math.PI/2)*1.21);w.rotation.y=k*Math.PI/2;L.add(w)}hipRoof(L,5.65,2.3,2.3,0,1.6,.4,roofC,{ov:1.0});
      if(sx<0){const bl=cyl(.42,.6,1.1,lam({color:0x4a4034}),0,2.3,0,16,L);cyl(.08,.08,.5,lam({color:0x4a4034}),0,3.1,0,8,L)}else{const dr=cyl(.6,.6,1.0,lam({color:0x8a3a2a}),0,2.2,0,18,L);dr.rotation.z=Math.PI/2;box(1.2,1.2,.9,lam({color:0x55241a}),0,1.0,0,L)}
      TW_SOLID.push([x,z,3.2]);TALL.push([x,z,3.6,8.6]);shade(x,0,z,8,.3,P)}

    {const bz=lam({color:0x5a4a3a}),z=119;box(2.2,.5,2.2,lam({map:ashlarT}),0,.25,z,P);for(let k=0;k<3;k++)cyl(.1,.13,.6,bz,Math.sin(k*2.094)*.5,.8,z+Math.cos(k*2.094)*.5,8,P);cyl(.95,.6,.9,bz,0,1.5,z,18,P);cyl(1.02,.97,.12,bz,0,2.0,z,18,P);for(const e of [-1,1]){const hd=new THREE.Mesh(new THREE.TorusGeometry(.26,.06,6,14),bz);hd.position.set(e*1.02,2.05,z);P.add(hd)}TW_SOLID.push([0,z,1.5])}

    for(const sx of [-1,1])for(let z=114.5;z<=124.5;z+=5){const x=sx*5.6;cyl(.5,.38,.55,lam({color:0x4a6a78}),x,.275,z,12,P);const b=new THREE.Mesh(new THREE.IcosahedronGeometry(.62,1),lam({color:0x4f8f52}));b.position.set(x,1.1,z);P.add(b);TW_SOLID.push([x,z,.6])}
    const pine=(x,z,h)=>{if(Math.hypot(Math.abs(x)-33,z-73)<13)return;umbPine(P,x,z,h*1.15);shade(x,0,z,4,.26,P);TW_SOLID.push([x,z,.6])};
    for(const sx of [-1,1]){for(const x of [30.5,36])for(let z=131;z<=153;z+=5.5)pine(sx*x,z,6+((x+z)%3));for(const x of [20,27,34])for(let z=63;z<=83;z+=6.5)pine(sx*x,z,5.5+((x*2+z)%4)*.6);}

    {const G9=new THREE.Group();G9.position.set(-33,0,73);P.add(G9);archWall(G9,4.4,3.4,[{x:0,w:2.2,h:2.7}],.9,plM(0x9a968a));hipRoof(G9,3.4,2.8,1.1,1.8,.9,.4,0x3e3a38,{style:'bac',tile:'scale',ov:.6});const dk=new THREE.Mesh(new THREE.PlaneGeometry(2.2,2.7),new THREE.MeshBasicMaterial({color:0x22301f}));dk.position.set(0,1.35,-.3);G9.add(dk);const sg=new THREE.Mesh(new THREE.PlaneGeometry(1.9,.42),new THREE.MeshBasicMaterial({map:signTexD('Suối Thiền')}));sg.position.set(0,3.05,.47);G9.add(sg);
      const rk=lam({color:0x7c7d74});for(const [a,b,r] of [[-3.6,-1.5,2.4],[3.4,-1.8,2.2],[0,-3.6,3.2],[-2.2,-5,2.6],[2.6,-5.2,2.8],[-5.2,.6,1.3],[5,.4,1.2]]){const k=new THREE.Mesh(new THREE.IcosahedronGeometry(r,1),rk);k.position.set(a,r*.6,b);G9.add(k);TW_SOLID.push([-33+a,73+b,r*.9])}
      TW_RECT.push([-35.3,-30.7,72.4,73.6]);TALL.push([-33,71,6,7]);TOWN_PL.push({id:'suoi',name:'Suối Thiền',dx:-33,dz:76,ay:5.6,ax:-33,az:73});ribbon([[-20.4,80],[-19,79.4],[-27,79.4],[-33,77]],2.4,pathMat,.035)}

    {const g3=new THREE.Mesh(new THREE.PlaneGeometry(120,30),lam({color:0x9db97a}));g3.rotation.x=-Math.PI/2;g3.position.set(0,0,-67);P.add(g3)}
    function sideHall(x,z,sx,roof,wall,style,wh){const S=new THREE.Group();S.position.set(x,0,z);S.rotation.y=-sx*Math.PI/2;P.add(S);const J=tHall(S,{bws:[2.0,2.6,2.0],dep:3.4,ver:1.3,colH:2.7,plat:.5,cr:.15,roof,wall,style,white:wh,tile:style==='bac'?'scale':'tube',single:true});shade(x,0,z,10,.3,P);TW_RECT.push([x-J.T/2-.9,x+J.T/2+.9,z-J.W/2-.9,z+J.W/2+.9]);HALLR.push([x-J.T/2-1,x+J.T/2+1,z-J.W/2-1,z+J.W/2+1]);TALL.push([x,z,J.ex+.3,J.top])}
    function bellHouse(x,z,roofC,kind,colC=0xa8483a,style='hue'){const L=new THREE.Group();L.position.set(x,0,z);P.add(L);const bm=lam({color:colC===0xe6dfd0?0xcfc4ae:0x55241a});box(4.6,.45,4.6,lam({map:ashlarT}),0,.225,0,L);for(const a of [-1,1])for(const b of [-1,1]){cyl(.24,.29,.15,lam({color:0xa8a294}),a*1.6,.52,b*1.6,12,L);cyl(.15,.17,2.7,lam({map:woodTex,color:colC}),a*1.6,1.95,b*1.6,12,L)}for(const b of [-1,1]){box(3.6,.24,.18,bm,0,3.2,b*1.6,L);box(.18,.24,3.6,bm,b*1.6,3.2,0,L)}
      hipRoof(L,3.33,3.0,3.0,.9,.9,style==='bac'?.7:.38,roofC,{ov:1.2,style,tile:style==='bac'?'scale':'tube'});box(2.1,1.3,2.1,plM(0xe6dfd0),0,4.45,0,L);hipRoof(L,5.1,2.1,2.1,0,1.45,style==='bac'?.6:.36,roofC,{ov:.9,style,tile:style==='bac'?'scale':'tube'});
      if(kind==='bell'){cyl(.38,.55,1.0,lam({color:0x4a4034}),0,2.1,0,16,L);cyl(.07,.07,.5,lam({color:0x4a4034}),0,2.85,0,8,L)}else if(kind==='drum'){const dr=cyl(.55,.55,.9,lam({color:0x8a3a2a}),0,2.0,0,18,L);dr.rotation.z=Math.PI/2;box(1.1,1.1,.8,bm,0,.95,0,L)}else{box(.9,.5,.9,lam({color:0xa8a294}),0,.7,0,L)}
      TW_SOLID.push([x,z,2.9]);TALL.push([x,z,3.3,7.8]);shade(x,0,z,7,.3,P)}

    {const x=-22,rc=0x5e4236,wc=0x8a7a68;sideHall(x-11.5,-34,-1,rc,wc,'bac');sideHall(x+11.5,-34,1,rc,wc,'bac');bellHouse(x-7.6,-22,rc,'bell',0x8a6048,'bac');bellHouse(x+7.6,-22,rc,'drum',0x8a6048,'bac');
      const c=new THREE.Mesh(new THREE.PlaneGeometry(12,22),lam({color:0xb5694a}));c.rotation.x=-Math.PI/2;c.position.set(x,.025,-31);P.add(c);ribbon([[x,-15.8],[x,-29],[x,-42.6]],3,pathMat,.035);
      for(const sx of [-1,1])for(let z=-27;z>=-41;z-=7){box(.42,.3,.42,lam({color:0x4a4038}),x+sx*4.6,.15,z,P);lampAt(P,x+sx*4.6,.3,z,1.2);TW_SOLID.push([x+sx*4.6,z,.3])}
      for(const dx of [-13,-6.5,0,6.5,13])pine(x+dx,-60,6.5+(dx%2))}

    {const x=22,rc=0x35506c,wc=0xe6dfd0;sideHall(x-11.5,-35,-1,rc,wc,'hue');sideHall(x+13,-37,1,rc,wc,'hue');bellHouse(x-8,-25.5,rc,'bell');ribbon([[x,-15.8],[21.2,-22],[21.5,-32],[x,-42.6]],3,pathMat,.035);
      for(const dx of [-13,-6.5,0])pine(x+dx,-60,6.5);for(const sx of [-1,1])for(let z=-28;z>=-40;z-=6){cyl(.45,.34,.5,lam({color:0x4a6a78}),x+sx*3.4,.25,z,12,P);const b=new THREE.Mesh(new THREE.IcosahedronGeometry(.55,1),lam({color:0x4f8f52}));b.position.set(x+sx*3.4,1.0,z);P.add(b);TW_SOLID.push([x+sx*3.4,z,.55])}}

    {const D=new THREE.Group();D.position.set(-33,0,-10);P.add(D);const J=tHall(D,{bws:[2.0,2.6,2.0],dep:3.2,ver:1.2,colH:2.6,plat:.5,cr:.15,roof:0xb8683c,wall:0xd9c9a8,style:'bac',tile:'scale'});shade(-33,0,-10,11,.3,P);TW_RECT.push([-33-J.W/2-.9,-33+J.W/2+.9,-10-J.T/2-.9,-10+J.T/2+.9]);HALLR.push([-33-J.W/2-1,-33+J.W/2+1,-10-J.T/2-1,-10+J.T/2+1]);TALL.push([-33,-10,J.ex+.3,J.top]);ribbon([[-25.4,-1.5],[-28.5,-4.2],[-33,-4.4]],2.2,pathMat,.035);steleHouse(-36.3,17.2)}

    bellHouse(36,19,0x4f6b78,'none',0xe6dfd0);

    {const V=new THREE.Group();V.position.set(-33.5,0,44.5);V.rotation.y=Math.PI/2;P.add(V);const wm=lam({color:0xf6f1e6}),gd=lam({color:0xc9a24a,emissive:0x3a2806});box(5.2,.5,8.4,wm,0,.25,0,V);for(const a of [-1,1])for(const zz of [-3.3,-1.1,1.1,3.3])cyl(.14,.16,3.0,wm,a*2.1,2.0,zz,10,V);box(4.6,.2,7.6,lam({color:0x7a4a30}),0,3.55,0,V);
      [[3.4,4.8,3.6,1.3],[2.4,4.2,4.5,2.3]].forEach(([w,l,y,h])=>{const sh=new THREE.Shape();sh.moveTo(-w,0);sh.lineTo(w,0);sh.lineTo(0,h);sh.closePath();const ge=new THREE.ExtrudeGeometry(sh,{depth:l*2,bevelEnabled:false});ge.translate(0,0,-l);const g2=new THREE.Mesh(ge,lam({map:tubeT,color:0xb8562c}));g2.position.y=y;V.add(g2);const L=Math.hypot(w,h);for(const sx of [-1,1])for(const sz of [-1,1]){const rk=box(.13,L,.13,gd,sx*w/2,y+h/2,sz*l,V);rk.rotation.z=sx*Math.atan2(w,h)}});
      TW_RECT.push([-33.5-4.6,-33.5+4.6,44.5-3,44.5+3]);TALL.push([-33.5,44.5,5,7.5]);shade(-33.5,0,44.5,10,.3,P)}
    {const G9=new THREE.Group();G9.position.set(33,0,73);P.add(G9);archWall(G9,4.4,3.4,[{x:0,w:2.2,h:2.7}],.9,plM(0x9a968a));hipRoof(G9,3.4,2.8,1.1,1.8,.9,.4,0x3e3a38,{style:'bac',tile:'scale',ov:.6});const dk=new THREE.Mesh(new THREE.PlaneGeometry(2.2,2.7),new THREE.MeshBasicMaterial({color:0x8fa6b0}));dk.position.set(0,1.35,-.3);G9.add(dk);const sg=new THREE.Mesh(new THREE.PlaneGeometry(1.9,.42),new THREE.MeshBasicMaterial({map:signTexD('Vách Núi')}));sg.position.set(0,3.05,.47);G9.add(sg);
      const rk=lam({color:0x7c7d74});for(const [a,b,r] of [[-3.6,-1.5,2.6],[3.4,-1.8,2.4],[0,-3.8,3.6],[-2.2,-5.4,3.0],[2.6,-5.6,3.2],[-5.2,.6,1.3],[5,.4,1.2]]){const k=new THREE.Mesh(new THREE.IcosahedronGeometry(r,1),rk);k.position.set(a,r*.7,b);G9.add(k);TW_SOLID.push([33+a,73+b,r*.9])}
      TW_RECT.push([30.7,35.3,72.4,73.6]);TALL.push([33,71,6,8]);TOWN_PL.push({id:'cliff',name:'Vách Núi',dx:33,dz:76,ay:5.6,ax:33,az:73});ribbon([[20.4,80],[19,79.4],[27,79.4],[33,77]],2.4,pathMat,.035)}
    {const rk=lam({color:0x6f7068,flatShading:true}),rk2=lam({color:0x85867c,flatShading:true}),ms=lam({color:0x5f8a55,flatShading:true});
      for(const sx of [-1,1]){const cx=sx*58;for(const [dx,y,dz,r,sy] of [[0,9,0,16,1.5],[-sx*9,6,4,11,1.3],[sx*7,14,-5,12,1.7],[-sx*4,24,-2,8,1.5],[sx*2,31,-3,5.5,1.3],[-sx*13,3,-8,9,1.0],[-sx*11,3,12,8,1.0]]){const k=new THREE.Mesh(new THREE.IcosahedronGeometry(r,1),(dx+dz)%2?rk:rk2);k.scale.y=sy;k.position.set(cx+dx,y,73+dz);k.rotation.y=dx;P.add(k)}
        for(const [dx,y,dz,r] of [[-sx*6,30,0,4],[sx*4,37,-3,3.2],[-sx*12,15,6,4.5]]){const m=new THREE.Mesh(new THREE.SphereGeometry(r,8,6),ms);m.scale.y=.3;m.position.set(cx+dx,y,73+dz);P.add(m)}
        TALL.push([cx,73,13,40])}

      {const c=box(9,1.6,4.2,rk2,49,34.6,71,P);c.rotation.z=.06;const tr=cyl(.25,.4,4,lam({color:0x5a4030}),52,37.4,70.6,6,P);tr.rotation.z=-.3;for(const [dx,dy,sxx] of [[-1.8,2.4,3.2],[.6,3.1,2.4]]){const b=new THREE.Mesh(new THREE.IcosahedronGeometry(1,1),lam({color:0x3a6245,flatShading:true}));b.scale.set(sxx,.4,sxx*.8);b.position.set(52+dx,37.4+dy,70.6);P.add(b)}}

      for(const [w,h,x,y,z] of [[3.2,26,-46.2,15,73],[1.6,14,-45.4,9,77.5]]){const f=new THREE.Mesh(new THREE.PlaneGeometry(w,h),fallM2);f.position.set(x,y,z);f.rotation.y=Math.PI/2;P.add(f)}
      for(let k=0;k<4;k++){const m=new THREE.Sprite(new THREE.SpriteMaterial({map:softTex,color:0xffffff,opacity:.5,transparent:true,depthWrite:false}));m.scale.set(6,2.6,1);m.position.set(-44.5,2.2+k*.5,71+k*2);P.add(m)}}
    const LP=[[-20.7,109],[-20.7,97],[-21.2,85],[-18.6,77.5],[-7.5,68],[-1.6,61.5],[0,57.4]];ribbon(LP,3.6,pathMat,.035);ribbon(LP.map(q=>[-q[0],q[1]]),3.6,pathMat,.035)}

  {const kerb=lam({color:0xb9ae98}),soilM=lam({color:0x6f5a40}),fcol=[0xf2a65a,0xf6d04a,0xe8647a,0xfaf4e2].map(c=>lam({color:c})),fg=new THREE.IcosahedronGeometry(.17,0),lfM=lam({color:0x5f9a5a});
    const plaza=(x,z,r)=>{const c=new THREE.Mesh(new THREE.CircleGeometry(r,40),pathMat);c.rotation.x=-Math.PI/2;c.position.set(x,.045,z);P.add(c);const rim=new THREE.Mesh(new THREE.RingGeometry(r,r+.28,40),kerb);rim.rotation.x=-Math.PI/2;rim.position.set(x,.05,z);P.add(rim);for(let a=0;a<6.28;a+=.45)for(const q of [r*.4,r*.85])pathPts.push([x+Math.cos(a)*q,z+Math.sin(a)*q]);PATHBAD.push([x,z,r])};
    const bench=(x,z,ry)=>{const g=new THREE.Group();g.position.set(x,0,z);g.rotation.y=ry;P.add(g);box(1.7,.12,.5,mBase,0,.46,0,g);for(const s of [-1,1])box(.2,.4,.42,mBase,s*.6,.2,0,g);TW_SOLID.push([x,z,.6])};
    const bed=(x,z,w,d)=>{box(w+.3,.22,d+.3,kerb,x,.11,z,P);box(w,.26,d,soilM,x,.14,z,P);for(let i=0;i<w*d*2.4;i++){const f=new THREE.Mesh(fg,fcol[i%4]);f.position.set(x-w/2+.25+rnd()*(w-.5),.38,z-d/2+.25+rnd()*(d-.5));P.add(f)}for(let i=0;i<w*d*.8;i++){const f=new THREE.Mesh(fg,lfM);f.scale.setScalar(1.5);f.position.set(x-w/2+.3+rnd()*(w-.6),.3,z-d/2+.3+rnd()*(d-.6));P.add(f)}TW_RECT.push([x-w/2-.15,x+w/2+.15,z-d/2-.15,z+d/2+.15]);TW_SOLID.push([x,z,1.0])};
    const pavR=(x,z,k)=>{const G=new THREE.Group();G.position.set(x,0,z);P.add(G);box(4.6*k,.1,4.6*k,mBase,0,.05,0,G);for(const sx of [-1,1])for(const sz of [-1,1]){cyl(.13,.15,2.7,mWood,sx*1.75*k,1.4,sz*1.75*k,8,G);TW_SOLID.push([x+sx*1.75*k,z+sz*1.75*k,.3]);TW_FORCE.push([x+sx*1.75*k,z+sz*1.75*k,.3])}hipRoof(G,2.75,2.4*k,2.4*k,.6,1.3,.5,0x7a4030,{style:'bac',tile:'scale',ov:.7});TALL.push([x,z,3.4*k,5])};
    const pot=(x,z)=>{cyl(.5,.38,.5,lam({color:0x3f5f66}),x,.25,z,12,P);const b=new THREE.Mesh(new THREE.IcosahedronGeometry(.55,1),lfM);b.position.set(x,1.0,z);P.add(b);TW_SOLID.push([x,z,.55])};

    plaza(1,-23,5.5);ribbon([[.5,-16.2],[1,-19]],2.6,pathMat,.03);cyl(2.0,2.15,.5,stone,1,.25,-23,24,P);{const w=new THREE.Mesh(new THREE.CircleGeometry(1.82,24),seaMat);w.rotation.x=-Math.PI/2;w.position.set(1,.47,-23);P.add(w);cyl(.34,.46,.9,stone,1,.7,-23,12,P);const pk=lam({color:0xf4a3bd});for(let i=0;i<8;i++){const a=i*.785,pt=new THREE.Mesh(new THREE.SphereGeometry(.3,8,6),pk);pt.scale.set(1,.5,.55);pt.rotation.set(0,-a,.5);pt.position.set(1+Math.cos(a)*.42,1.28,-23+Math.sin(a)*.42);P.add(pt)}const bd=new THREE.Mesh(new THREE.SphereGeometry(.24,10,8),lam({color:0xf6d04a}));bd.scale.y=1.3;bd.position.set(1,1.42,-23);P.add(bd);TW_SOLID.push([1,-23,2.3])}
    for(const a of [.9,2.25,4.05,5.4])bench(1+Math.cos(a)*4.4,-23+Math.sin(a)*4.4,-a+Math.PI/2);
    ribbon([[1,-27.6],[1,-34],[1,-41],[.3,-47.6]],2.6,pathMat,.03);ribbon([[-15.5,-42],[-7,-42.5],[1,-42],[9,-42.5],[15.5,-42]],2.0,pathMat,.032);
    plaza(0,-52.5,5);pavR(0,-52.5,1.15);for(const a of [0,Math.PI])bench(Math.cos(a)*4.1,-52.5+Math.sin(a)*4.1,Math.PI/2);ribbon([[0,-45],[5.3,-47.2],[7.5,-52.5],[5.3,-57.8],[0,-60],[-5.3,-57.8],[-7.5,-52.5],[-5.3,-47.2]],1.3,pathMat,.034,true);

    plaza(0,26.3,3.6);
    plaza(20,48,6);pavR(20,48,1);for(const a of [.6,2.54,3.74,5.68])bench(20+Math.cos(a)*5,48+Math.sin(a)*5,-a+Math.PI/2);for(const a of [1.57,4.71])pot(20+Math.cos(a)*4.9,48+Math.sin(a)*4.9);
    for(const [bx,bz] of [[31.4,44.6],[34.9,44.6],[31.4,48.4],[34.9,48.4]])bed(bx,bz,2.4,2.2);
    ribbon([[3.6,43.5],[8.5,45.6],[14.2,47.4]],1.4,pathMat,.034);ribbon([[25.8,47.6],[29.3,46.6]],1.4,pathMat,.034);ribbon([[24.6,44.2],[26.8,41],[27,38.4]],1.4,pathMat,.034);ribbon([[29.3,46.5],[33.1,46.5],[36.6,46.5]],1.2,pathMat,.034);
    plaza(-26,50,4);pot(-26,50);for(const a of [.3,2.0,4.2])bench(-26+Math.cos(a)*3.1,50+Math.sin(a)*3.1,-a+Math.PI/2);ribbon([[-5,43.5],[-8.6,46.6],[-10.2,51.2],[-16,53.2],[-22.2,51]],1.4,pathMat,.034)}

  const near=(x,z,d)=>pathPts.some(p=>Math.hypot(p[0]-x,p[1]-z)<d);
  for(let i=0;i<pathPts.length;i+=17){const p0=pathPts[i],p1=pathPts[Math.min(i+1,pathPts.length-1)],tx=p1[0]-p0[0],tz=p1[1]-p0[1],l=Math.hypot(tx,tz)||1,x=p0[0]-tz/l*2.1,z=p0[1]+tx/l*2.1;if(inWater(x,z,.6)||TW_SOLID.some(c=>Math.hypot(c[0]-x,c[1]-z)<c[2]+1))continue;
    box(.34,.14,.34,mBase,x,.07,z,P);box(.17,1.0,.17,mBase,x,.6,z,P);const lit=new THREE.Mesh(new THREE.BoxGeometry(.3,.3,.3),new THREE.MeshLambertMaterial({color:0xd8d0c0,emissive:0xffb060,emissiveIntensity:0}));lit.position.set(x,1.25,z);P.add(lit);lanterns.push(lit);box(.4,.06,.4,mBase,x,1.43,z,P);const cp=new THREE.Mesh(new THREE.SphereGeometry(.11,10,8),mBase);cp.scale.y=1.6;cp.position.set(x,1.6,z);P.add(cp);TW_SOLID.push([x,z,.3])}
  for(let i=0;i<150;i++){const x=-38+rnd()*76,z=-29+rnd()*74;if(near(x,z,3.2)||inWater(x,z,1.6)||TW_SOLID.some(c=>Math.hypot(c[0]-x,c[1]-z)<c[2]+2.2)||Math.hypot(x-27,z-33)<8||Math.hypot(x+27,z-31)<8||(Math.abs(x)<7&&z>38)||TOWN_PL.some(q=>Math.abs(x-q.dx)<5.5&&z>q.dz-2&&z<q.dz+17))continue;
    const r0=rnd(),pine=z<-6||r0<.3,h=pine?5+rnd()*3:2.2+rnd();
    if(pine)umbPine(P,x,z,h);else if(r0<.5)frangi(P,x,z);else if(r0<.62)bamboo(P,x,z);else{cyl(.16,.24,h*.5,lam({color:0x6a4a34}),x,h*.25,z,6,P);const b=new THREE.Mesh(new THREE.IcosahedronGeometry(1.3+rnd()*.5,1),lam({color:[0x5fae5a,0x74bf66,0x8acd72][i%3]}));b.scale.y=1.1;b.position.set(x,h*.5+1.2,z);P.add(b)}
    shade(x,0,z,3.6,.26,P);TW_SOLID.push([x,z,.55])}

  const ZONES=[
    {n:'duoGate',r:[[10.2,28,-18.2,-5.6]],d:[42,-6]},
    {n:'diaGate',r:[[-28.5,-15.5,-18.2,-4.5]],d:[-42,-6]},
    {n:'lien',r:[[-39.5,-28.5,-15,13.5]],d:[-37,7]},
    {n:'dia',r:[[-38.5,-6.3,-63,-18.2]],d:[-42,-6]},
    {n:'duo',r:[[6,39.6,-63,-18.2]],d:[42,-6]},
    {n:'lake',r:[[-23.5,23.5,-14.5,15],[-21.8,23.5,15,25.3]],d:[-34,6]},
    {n:'quan',r:[[24.5,39.6,-6.5,23.5]],d:[40.5,6]},
    {n:'nam',r:[[-39.6,-23.6,15,49.5]],d:[-42.5,11]},
    {n:'tudu',r:[[-21.8,-7.2,29,50.6]],d:[-4,9]},
    {n:'mem',r:[[20.5,33.6,25.5,38.6]],d:[13,11]},
    {n:'west',r:[[-40,-26,64,79.4],[-84,-41,48,98]],d:[-47,-81]},
    {n:'east',r:[[26,40,64,79.4],[41,84,48,98]],d:[53,-87]},
    {n:'temple',r:[[-37.5,37.5,79.5,127.6]],d:[0,-146]},
    {n:'pagoda',r:[[-16.2,16.2,132.5,149.5]],d:[36,-139]},
    {n:'gate',r:[[-12.5,12.5,154.5,163.5]],d:[0,-93.5]}
  ];
  const zoneAt=(x,z)=>{for(const q of ZONES)for(const r of q.r)if(x>=r[0]&&x<=r[1]&&z>=r[2]&&z<=r[3])return q;return null};
  const movePoint=(x,z)=>{const q=zoneAt(x,z);return q?[x+q.d[0],z+q.d[1]]:null};
  const moveRect=q=>{const z=zoneAt((q[0]+q[1])/2,(q[2]+q[3])/2);return z?[q[0]+z.d[0],q[1]+z.d[0],q[2]+z.d[1],q[3]+z.d[1]]:null};

  for(const o of [...P.children]){o.updateMatrixWorld(true);const b=new THREE.Box3().setFromObject(o),s=b.getSize(new THREE.Vector3()),c=b.getCenter(new THREE.Vector3()),q=zoneAt(c.x,c.z);if(!q||s.x>50&&s.z>20){P.remove(o);continue}o.position.x+=q.d[0];o.position.z+=q.d[1]}
  const remapList=(a,fn)=>{const out=[];for(const x of a){const y=fn(x);if(y)out.push(y)}a.splice(0,a.length,...out)};
  remapList(TW_SOLID,q=>{const p=movePoint(q[0],q[1]);return p?[p[0],p[1],q[2]]:null});
  remapList(TALL,q=>{const p=movePoint(q[0],q[1]);return p?[p[0],p[1],q[2],q[3]]:null});
  remapList(TW_RECT,moveRect);remapList(HALLR,moveRect);
  remapList(TOWN_PL,q=>{const p=movePoint(q.dx,q.dz),a=movePoint(q.ax,q.az);return p&&a?{...q,dx:p[0],dz:p[1],ax:a[0],az:a[1]}:null});
  remapList(pathPts,q=>movePoint(q[0],q[1]));remapList(PATHBAD,q=>{const p=movePoint(q[0],q[1]);return p?[p[0],p[1],q[2]]:null});
  // v40 carry-over clearance: move the single tall pine at the Quanam approach out of the 72,16.8 sightline.
  for(const o of [...P.children]){if(!o.isMesh)continue;const bb=new THREE.Box3().setFromObject(o),cc=bb.getCenter(new THREE.Vector3());if(Math.hypot(cc.x-72,cc.z-16.8)<2.2&&bb.max.y-bb.min.y>2.5)o.position.x+=4}
  STREAM.splice(0,STREAM.length);
  LAKE.splice(0,LAKE.length,...[[-44,14,12],[-24,10,12],[-34,2,9],[-34,21,8.5]]);
  ISLE[0]=-34;ISLE[1]=12;BRIDGE.splice(0,BRIDGE.length,...[[-35.4,-32.6,18.5,30.4],[-27.5,-20.8,10.9,13.1],[-23.1,-20.8,6.9,13.1],[-23.1,-15.8,6.9,9.1],[-18.1,-15.8,10.9,16.1],[-18.1,-10.8,13.9,19.1]]);
  pathPts.splice(0,pathPts.length);PATHBAD.splice(0,PATHBAD.length);

  const road=(pts,w)=>{const q=pts.length>=3?pts:[pts[0],[(pts[0][0]+pts[1][0])/2,(pts[0][1]+pts[1][1])/2],pts[1]],p0=PATHBAD.length,pp0=pathPts.length,c0=P.children.length;ribbon(q,w,pathMat,.06,false);const bad=PATHBAD.slice(p0).some(p=>!walkTown(p[0],p[1]));if(bad){for(let i=P.children.length-1;i>=c0;i--)P.remove(P.children[i]);PATHBAD.splice(p0,PATHBAD.length-p0);pathPts.splice(pp0,pathPts.length-pp0)}};

  for(const [pts,w] of [
    [[[0,62],[0,34],[16,20],[16,8],[16,-2],[0,-12]],5],[[[-64,-9.5],[0,-12],[64,-9.5],[86,-11]],3.6],
    [[[-60.5,24],[-60.5,-12],[-80,-12],[-80,-5]],2.4],[[[0,34],[-34,33],[-52,30],[-60.5,24]],2.6],
    [[[0,34],[58,30],[58,-10]],2.6],[[[58,-10],[62,-2],[66,2],[67,5]],2.2],[[[58,30],[40,42],[0,52],[0,62]],2.6],
    [[[16,8],[22,4],[36,-8]],2.4],[[[16,8],[10,13],[0,14],[-10.8,11]],2.0],[[[-34,33],[-26,36],[-19,36]],1.6],
    [[[-34,33],[-42.5,38],[-42.5,42]],1.5],[[[0,34],[12,30],[30,30],[40,34]],1.6],[[[30,30],[44,28],[56,30]],1.5],
    [[[-60.5,24],[-66,15],[-70,8]],1.5],[[[30,-4],[36,-8],[36,-10]],1.5],
    [[[-52,30],[-46,42],[-46,50],[-34,33]],1.4],[[[40,30],[56,30],[72,34],[78,40]],1.4],
    [[[0,45],[8,52],[16,54]],1.3],[[[16,54],[24,56],[32,52]],1.3],
    [[[32,52],[34,46],[30,40]],1.3],[[[30,40],[22,42],[16,44]],1.3],[[[16,44],[12,44],[8,40]],1.3],[[[8,40],[2,42],[0,45]],1.3]
  ])road(pts,w);

  const plaza=(x,z,r)=>{const c=new THREE.Mesh(new THREE.CircleGeometry(r,40),pathMat);c.rotation.x=-Math.PI/2;c.position.set(x,.045,z);P.add(c);const rim=new THREE.Mesh(new THREE.RingGeometry(r,r+.28,40),lam({color:0xb9ae98}));rim.rotation.x=-Math.PI/2;rim.position.set(x,.05,z);P.add(rim);for(let a=0;a<Math.PI*2;a+=.35){const px=x+Math.cos(a)*r*.82,pz=z+Math.sin(a)*r*.82;if(walkTown(px,pz))pathPts.push([px,pz]),PATHBAD.push([px,pz,.25])}};
  const bench=(x,z,ry)=>{const g=new THREE.Group();g.position.set(x,0,z);g.rotation.y=ry;P.add(g);box(1.7,.12,.5,mBase,0,.46,0,g);for(const s of [-1,1])box(.2,.4,.42,mBase,s*.6,.2,0,g);TW_SOLID.push([x,z,.6])};
  const bed=(x,z,w,d)=>{box(w+.3,.22,d+.3,lam({color:0xb9ae98}),x,.11,z,P);box(w,.26,d,lam({color:0x6f5a40}),x,.14,z,P);for(let i=0;i<w*d*1.5;i++){const f=new THREE.Mesh(new THREE.IcosahedronGeometry(.17,0),lam({color:[0xf2a65a,0xf6d04a,0xe8647a,0xfaf4e2][i%4]}));f.position.set(x-w/2+.25+rnd()*(w-.5),.38,z-d/2+.25+rnd()*(d-.5));P.add(f)}TW_RECT.push([x-w/2-.15,x+w/2+.15,z-d/2-.15,z+d/2+.15]);TW_SOLID.push([x,z,1])};
  const pavR=(x,z,k)=>{const G=new THREE.Group();G.position.set(x,0,z);P.add(G);box(4.6*k,.1,4.6*k,mBase,0,.05,0,G);for(const sx of [-1,1])for(const sz of [-1,1]){cyl(.15,.17,2.7,mWood,sx*1.75*k,1.4,sz*1.75*k,8,G);box(.42,.14,.42,mBase,sx*1.75*k,.17,sz*1.75*k,G);TW_SOLID.push([x+sx*1.75*k,z+sz*1.75*k,.02]);TW_FORCE.push([x+sx*1.75*k,z+sz*1.75*k,.02])}for(const sx of [-1,1]){box(.12,.16,3.5*k,mWood,sx*1.75*k,2.62,0,G);box(3.5*k,.16,.12,mWood,0,2.62,sx*1.75*k,G)}hipRoof(G,2.75,2.4*k,2.4*k,.6,1.3,.5,0x7a4030,{style:'bac',tile:'scale',ov:.7});TALL.push([x,z,3.4*k,5])};
  plaza(0,8,6);plaza(-34,32,4);plaza(36,2,10);pavR(-46,50,1.15);pavR(20,36,1);for(const a of [0,Math.PI])bench(-46+Math.cos(a)*4.1,50+Math.sin(a)*4.1,Math.PI/2);for(const a of [.5,2.6,3.7,5.8])bench(20+Math.cos(a)*5,36+Math.sin(a)*5,-a+Math.PI/2);for(const [x,z] of [[60,38],[64,38],[60,42],[64,42]])bed(x,z,2.4,2.2);

  {const x=0,z=8;cyl(2,2.15,.5,stone,x,.25,z,24,P);const w=new THREE.Mesh(new THREE.CircleGeometry(1.82,24),seaMat);w.rotation.x=-Math.PI/2;w.position.set(x,.47,z);P.add(w);cyl(.34,.46,.9,stone,x,.7,z,12,P);for(let i=0;i<8;i++){const a=i*.785,p=new THREE.Mesh(new THREE.SphereGeometry(.3,8,6),lam({color:0xf4a3bd}));p.scale.set(1,.5,.55);p.position.set(x+Math.cos(a)*.42,1.28,z+Math.sin(a)*.42);P.add(p)}TW_SOLID.push([x,z,2.3])}

  const outer=new THREE.Mesh(new THREE.PlaneGeometry(240,190),lam({color:0x6f8060}));outer.rotation.x=-Math.PI/2;outer.position.set(0,-.04,0);P.add(outer);
  const shape=new THREE.Shape();const bp=[[-91,-4],[-90,-36],[-87,-60],[-78,-72],[-56,-74],[-30,-71],[0,-72],[30,-71],[56,-74],[78,-72],[88,-60],[91,-36],[93,-14],[89,2],[86,20],[85,36],[78,52],[62,64],[38,69],[12,72],[-14,72],[-40,70],[-66,69],[-84,60],[-90,38],[-91,16]];shape.moveTo(bp[0][0],bp[0][1]);for(const p of bp.slice(1))shape.lineTo(p[0],p[1]);shape.closePath();const grass2=new THREE.Mesh(new THREE.ShapeGeometry(shape),lam({color:0xa9c88d}));grass2.rotation.x=-Math.PI/2;grass2.position.y=.005;P.add(grass2);
  const sea=new THREE.Mesh(new THREE.PlaneGeometry(90,190),seaMat);sea.rotation.x=-Math.PI/2;sea.position.set(126,.02,0);P.add(sea);

  for(let i=0;i<bp.length;i++){const a=bp[i],b=bp[(i+1)%bp.length],dx=b[0]-a[0],dz=b[1]-a[1],L=Math.hypot(dx,dz),n=Math.max(1,Math.floor(L/5));for(let j=0;j<n;j++){const t=(j+.5)/n,x=a[0]+dx*t,z=a[1]+dz*t;if((z>55&&Math.abs(x)<14)||(x<-70&&z<8)||(x>70&&z<8))continue;const r=1.3+(i+j)%3*.45,m=new THREE.Mesh(new THREE.IcosahedronGeometry(r,1),lam({color:(i+j)%2?0x4f7f52:0x6c965e}));m.scale.y=1.5;m.position.set(x,.8,z);P.add(m);TW_SOLID.push([x,z,r*.75]);v39TreeCount++}}

  const nearNew=(x,z,d)=>pathPts.some(p=>Math.hypot(p[0]-x,p[1]-z)<d);
  const clusters=[[-72,28],[-54,58],[-20,62],[18,60],[54,58],[76,30],[-70,-28],[-35,-48],[28,-48],[66,-30],[-12,48],[45,20]],treeForbidden=(x,z)=>Math.hypot(x,z-62)<12||Math.hypot(x-36,z-2)<12||Math.hypot(x-72,z-10)<12||Math.hypot(x,z-8)<12||Math.hypot(x+80,z+8)<10||Math.hypot(x-86,z+14)<10;
  const broadleaf=(x,z,h)=>{cyl(.16,.25,h*.45,lam({color:0x6a4a34}),x,h*.22,z,6,P);const b=new THREE.Mesh(new THREE.IcosahedronGeometry(1.6,1),lam({color:0x5f9f58}));b.scale.set(1.25,1,1.25);b.position.set(x,h*.58,z);P.add(b)};
  for(const [cx,cz] of clusters)for(let j=0;j<10;j++){const x=cx+((j*17)%13-6),z=cz+((j*11)%13-6);if(treeForbidden(x,z)||Math.hypot(x-48,z-52)<5||!walkTown(x,z,0)||nearNew(x,z,4)||inWater(x,z,1.6)||TW_SOLID.some(c=>Math.hypot(c[0]-x,c[1]-z)<c[2]+2))continue;const h=4.5+(j%3);if(z<25)umbPine(P,x,z,h+1);else if(j%4===0)frangi(P,x,z);else if(j%4===1)bamboo(P,x,z);else if(j%4===2)areca(P,x,z,h);else broadleaf(x,z,h);TW_SOLID.push([x,z,1.0]);v39TreeCount++}
})();
var V40_GATE_CORRIDORS=[[-17,31,-19,31],[-52,48,-46,50],[28,24,30,30],[34,58,32,52],[72,44,72,34],[-50,-21,-60,-12]];
V40_GATE_CORRIDORS[2]=[27,25.6,30,30];
function v40GateClear(x,z,R){for(const [ax,az,bx,bz] of (V40_GATE_CORRIDORS||[[-17,31,-19,31],[-52,48,-46,50],[28,24,30,30],[34,58,32,52],[72,44,72,34],[-50,-21,-60,-12]])){const dx=bx-ax,dz=bz-az,l2=dx*dx+dz*dz||1,t=Math.max(0,Math.min(1,((x-ax)*dx+(z-az)*dz)/l2));if(Math.hypot(x-(ax+t*dx),z-(az+t*dz))<1.15+R)return true}return false}
function townBoundary(x,z){const p=[[-91,-4],[-90,-36],[-87,-60],[-78,-72],[-56,-74],[-30,-71],[0,-72],[30,-71],[56,-74],[78,-72],[88,-60],[91,-36],[93,-14],[89,2],[86,20],[85,36],[78,52],[62,64],[38,69],[12,72],[-14,72],[-40,70],[-66,69],[-84,60],[-90,38],[-91,16]];let hit=false;for(let i=0,j=p.length-1;i<p.length;j=i++){const a=p[i],b=p[j];if((a[1]>z)!==(b[1]>z)&&x<(b[0]-a[0])*(z-a[1])/(b[1]-a[1])+a[0])hit=!hit}return hit}
function walkTown(x,z,pad=0){const R=RAD+pad;if(!townBoundary(x,z))return false;if(inWater(x,z,R))return false;for(const c of TW_FORCE){const dx=x-c[0],dz=z-c[1],r=c[2]+R;if(dx*dx+dz*dz<r*r)return false}if(v40GateClear(x,z,R))return true;
  for(const q of TW_RECT)if(x>q[0]-R&&x<q[1]+R&&z>q[2]-R&&z<q[3]+R)return false;for(const c of TW_SOLID){const dx=x-c[0],dz=z-c[1],r=c[2]+R;if(dx*dx+dz*dz<r*r)return false}return true}

const hemi=new THREE.HemisphereLight(0xffffff,0x6a5a48,1);scene.add(hemi);
const sun=new THREE.DirectionalLight(0xffffff,2);scene.add(sun);
scene.fog=new THREE.Fog(0xcfd8d4,40,210);
const T={
 dawn:{top:'#9fb7d6',mid:'#f3d9c2',bot:'#f7ead6',sun:0xffd9b0,si:1.9,sd:[-8,6,6],hs:0xdfe6f2,hg:0x7a6a58,hi:1.25,fog:0xeadfd2,fn:26,ff:170,mist:.75,lamp:7,lan:.25,star:0,low:.42,orb:[70,22,-200,60,0xfff0d0,.75],bud:0xfff0dc,hill:[0x93a8b0,0x7d959a,0x6c8480],line:'Sương sớm chưa tan, sân rất yên.'},
 day:{top:'#6fa3d8',mid:'#bcd9ee',bot:'#eef4f2',sun:0xfff3dc,si:2.8,sd:[5,12,7],hs:0xffffff,hg:0x8a7a62,hi:1.5,fog:0xd7e3e2,fn:60,ff:260,mist:.42,lamp:6,lan:0,star:0,low:.07,orb:[40,150,-160,90,0xfffbe8,.5],bud:0xffffff,hill:[0x86a39a,0x6f9080,0x5c7d68],line:'Mây đã tan, núi hiện rõ.'},
 dusk:{top:'#5a5f96',mid:'#f0a070',bot:'#ffd9a8',sun:0xff9a55,si:2.1,sd:[10,4,5],hs:0xffc9a0,hg:0x6a4a3a,hi:1.05,fog:0xe8b08a,fn:34,ff:200,mist:.5,lamp:11,lan:.9,star:.1,low:.16,orb:[-85,16,-200,70,0xffb060,.95],bud:0xffe6c4,hill:[0x8a6f86,0x735a70,0x5e475a],line:'Nắng chiều nghiêng trên mái, đèn dần sáng.'},
 night:{top:'#0c1330',mid:'#1c2a52',bot:'#34406a',sun:0x8ea6ff,si:.55,sd:[-6,10,8],hs:0x6a7ab8,hg:0x22222e,hi:.8,fog:0x1e2a4c,fn:26,ff:180,mist:.22,lamp:15,lan:1.6,star:.95,low:.2,orb:[-60,95,-200,26,0xe8efff,1],bud:0xffdcae,hill:[0x1c2644,0x18203a,0x141b30],line:'Đêm đã khuya, đèn vẫn sáng.'}
};
let tod='day',lampBase=8;
function skyTex(t){return canvasTex(8,256,(g,w,h)=>{const r=g.createLinearGradient(0,0,0,h);r.addColorStop(0,t.top);r.addColorStop(.55,t.mid);r.addColorStop(1,t.bot);g.fillStyle=r;g.fillRect(0,0,w,h)})}
function setTime(k,quiet){tod=k;const t=T[k];if(scene.background&&scene.background.dispose)scene.background.dispose();scene.background=skyTex(t);
  sun.color.set(t.sun);sun.intensity=t.si;sun.position.set(...t.sd);hemi.color.set(t.hs);hemi.groundColor.set(t.hg);hemi.intensity=t.hi;
scene.fog.color.set(t.fog);scene.fog.near=t.fn;scene.fog.far=t.ff;stars.material.opacity=t.star;
lanterns.forEach(l=>l.material.emissiveIntensity=t.lan);hills.forEach((h,i)=>h.material.color.set(t.hill[i%3]));mists.forEach(m=>m.material.opacity=t.mist);
orb.position.set(...t.orb.slice(0,3));orb.scale.set(t.orb[3],t.orb[3],1);orb.material.color.set(t.orb[4]);orb.material.opacity=t.orb[5];seaMat.color.set(t.top);
document.body.dataset.period=k;if(!quiet)say(t.line);}
seed=1801022614;

const me=new THREE.Group();scene.add(me);

const skin=new THREE.MeshLambertMaterial({color:0xf6d8bc,emissive:0x6a4630,emissiveIntensity:.75}), shirt=lam({color:0xe9dcc2}), trim=lam({color:0xb9a686}), trou=lam({color:0x5a3520}), hairM=lam({color:0x1d1613}), inkM=new THREE.MeshBasicMaterial({color:0x3a2a22}), lipM=new THREE.MeshBasicMaterial({color:0xb5695a});
const HIP=.62, hip=new THREE.Group();hip.position.y=HIP;me.add(hip);
cyl(.2,.215,.15,trou,0,-.04,0,16,hip);
function mkLeg(sx){const th=new THREE.Group();th.position.set(sx*.1,-.02,0);hip.add(th);cyl(.108,.1,.31,trou,0,-.155,0,12,th);
  const kn=new THREE.Group();kn.position.y=-.31;th.add(kn);cyl(.1,.108,.27,trou,0,-.135,0,12,kn);cyl(.04,.038,.05,skin,0,-.285,0,8,kn);
  const ft=new THREE.Mesh(new THREE.SphereGeometry(.05,12,8),skin);ft.scale.set(1,.5,1.9);ft.position.set(0,-.3,.05);kn.add(ft);return {th,kn}}
const LL=mkLeg(-1),LR=mkLeg(1);
const torso=new THREE.Group();hip.add(torso);
cyl(.165,.225,.56,shirt,0,.25,0,20,torso);
for(const sx of [-1,1]){const sh=new THREE.Mesh(new THREE.SphereGeometry(.088,12,10),shirt);sh.scale.y=.8;sh.position.set(sx*.175,.47,0);torso.add(sh)}
const collar=new THREE.Mesh(new THREE.TorusGeometry(.078,.013,8,20),trim);collar.rotation.x=Math.PI/2;collar.position.y=.535;torso.add(collar);
const plk=box(.014,.5,.008,trim,0,.25,.2,torso);plk.rotation.x=-.1;
for(let b=0;b<5;b++){const y=.47-b*.105,bt=new THREE.Mesh(new THREE.SphereGeometry(.013,8,6),lam({color:0x8f8270}));bt.position.set(0,y,.172+(.47-y)*.108+.008);torso.add(bt)}
cyl(.055,.06,.09,skin,0,.56,0,10,torso);
const headG=new THREE.Group();headG.position.y=.77;torso.add(headG);
const head=new THREE.Mesh(new THREE.SphereGeometry(.2,36,26),skin);head.scale.set(1,.98,.97);headG.add(head);
const browM=new THREE.MeshBasicMaterial({color:0x4a352b}),lashM=new THREE.MeshBasicMaterial({color:0x2e211b});
for(const sx of [-1,1]){const ear=new THREE.Mesh(new THREE.SphereGeometry(.036,12,10),skin);ear.scale.set(.5,1,.75);ear.position.set(sx*.197,-.03,.0);headG.add(ear);

  const eg=new THREE.Group();eg.position.set(sx*.076,-.006,.184);eg.rotation.y=sx*.4;headG.add(eg);const arc=Math.PI*.78,eye=new THREE.Mesh(new THREE.TorusGeometry(.036,.0052,8,20,arc),lashM);eye.rotation.z=Math.PI/2-arc/2;eye.position.y=-.024;eye.scale.y=.6;eg.add(eye);
  {const l=box(.014,.004,.004,lashM,sx*.036,-.014,.001,eg);l.rotation.z=sx*.55}
  const bg=new THREE.Group();bg.position.set(sx*.078,.056,.181);bg.rotation.y=sx*.4;headG.add(bg);const ba=.9,brow=new THREE.Mesh(new THREE.TorusGeometry(.05,.0042,6,14,ba),browM);brow.rotation.z=Math.PI/2-ba/2+sx*.1;brow.position.y=-.046;bg.add(brow);
  const ck=new THREE.Mesh(new THREE.CircleGeometry(.03,18),new THREE.MeshBasicMaterial({color:0xf29a8a,transparent:true,opacity:.24,depthWrite:false}));ck.position.set(sx*.114,-.06,.163);ck.rotation.y=sx*.62;headG.add(ck);
  const lock=new THREE.Mesh(new THREE.SphereGeometry(.05,12,10),hairM);lock.scale.set(.42,1.5,.7);lock.position.set(sx*.186,-.012,.052);headG.add(lock)}
const nose=new THREE.Mesh(new THREE.SphereGeometry(.0115,10,8),lam({color:0xe4b896}));nose.scale.set(1,.8,.8);nose.position.set(0,-.03,.2);headG.add(nose);
const ma=Math.PI*.56,mouth=new THREE.Mesh(new THREE.TorusGeometry(.024,.0046,8,14,ma),lipM);mouth.rotation.z=-Math.PI/2-ma/2;mouth.position.set(0,-.058,.187);mouth.scale.y=.7;headG.add(mouth);
const hair=new THREE.Mesh(new THREE.SphereGeometry(.214,36,22,0,Math.PI*2,0,Math.PI*.5),hairM);hair.rotation.x=-.52;hair.position.y=.004;headG.add(hair);
const nape=new THREE.Mesh(new THREE.SphereGeometry(.2,24,18),hairM);nape.scale.set(1.045,1.0,.8);nape.position.set(0,-.012,-.058);headG.add(nape);
for(let k=0;k<7;k++){const a=-.78+k*.26,f=new THREE.Mesh(new THREE.SphereGeometry(.062,12,10),hairM);f.scale.set(1,.5,.5);f.position.set(Math.sin(a)*.168,.128-Math.abs(a)*.034,Math.cos(a)*.168);f.rotation.y=a;f.rotation.z=-a*.35;headG.add(f)}
const bun=new THREE.Mesh(new THREE.SphereGeometry(.074,16,12),hairM);bun.scale.set(1.1,1,.95);bun.position.set(0,-.1,-.205);headG.add(bun);
{const tie=new THREE.Mesh(new THREE.TorusGeometry(.04,.009,6,16),lam({color:0xb9a686}));tie.position.set(0,-.085,-.165);tie.rotation.x=.45;headG.add(tie)}
function mkArm(sx){const up=new THREE.Group();up.position.set(sx*.215,.45,0);torso.add(up);cyl(.07,.076,.24,shirt,0,-.12,0,12,up);
  const el=new THREE.Group();el.position.y=-.23;up.add(el);cyl(.076,.092,.2,shirt,0,-.1,0,12,el);
  const hd=new THREE.Mesh(new THREE.SphereGeometry(.043,10,8),skin);hd.scale.set(.9,1.3,.6);hd.position.y=-.245;el.add(hd);
  const th=new THREE.Mesh(new THREE.SphereGeometry(.016,6,5),skin);th.position.set(-sx*.03,-.225,.02);el.add(th);return {up,el}}
const AL=mkArm(-1),AR=mkArm(1);
const mergeMe=()=>{for(const g of [hip,torso,headG,LL.th,LL.kn,LR.th,LR.kn,AL.up,AL.el,AR.up,AR.el])mergeStatic(g,new Set(),true)};
{const wb=new THREE.Mesh(new THREE.TorusGeometry(.05,.011,6,16),lam({color:0x5a3018}));wb.rotation.x=Math.PI/2;wb.position.y=-.2;AL.el.add(wb)}
const blob=new THREE.Mesh(new THREE.PlaneGeometry(1.1,1.1),new THREE.MeshBasicMaterial({map:softTex,color:0x000000,transparent:true,opacity:.42,depthWrite:false}));blob.rotation.x=-Math.PI/2;scene.add(blob);
const pos=new THREE.Vector3(0,0,10.5), dest=new THREE.Vector3(0,0,10.5);let faceY=Math.PI, wantY=Math.PI, path=[];
let W=null,SPOT=null;
const floorY=(z,x)=>W.floorY(z,x);
function walkable(x,z,pad=0){return W.walk(x,z,pad)}
let GS=.25,GX0=-13,GZ0=-10,GW=105,GH=105;
let grid=new Uint8Array(GW*GH),comp=new Int32Array(GW*GH);function buildGrid(){if(grid.length!==GW*GH)grid=new Uint8Array(GW*GH);for(let k=0;k<GH;k++)for(let i=0;i<GW;i++)grid[k*GW+i]=walkable(GX0+i*GS,GZ0+k*GS)?1:0;if(comp.length!==GW*GH)comp=new Int32Array(GW*GH);comp.fill(0);let id=0;const st=[];for(let n=0;n<GW*GH;n++){if(!grid[n]||comp[n])continue;id++;comp[n]=id;st.push(n);while(st.length){const c=st.pop(),ci=c%GW;for(const m of [c-1,c+1,c-GW,c+GW]){if(m<0||m>=GW*GH||!grid[m]||comp[m])continue;if((m===c-1&&ci===0)||(m===c+1&&ci===GW-1))continue;comp[m]=id;st.push(m)}}}}
const cellOf=(x,z)=>[Math.round((x-GX0)/GS),Math.round((z-GZ0)/GS)];
const okCell=(i,k)=>i>=0&&k>=0&&i<GW&&k<GH&&grid[k*GW+i]===1;
function nearestCell(x,z){let [i,k]=cellOf(x,z);i=Math.max(0,Math.min(GW-1,i));k=Math.max(0,Math.min(GH-1,k));if(okCell(i,k))return [i,k];
  let best=null,bd=1e9;for(let r=1;r<40&&!best;r++){for(let a=-r;a<=r;a++)for(let b=-r;b<=r;b++){if(Math.max(Math.abs(a),Math.abs(b))!==r)continue;const ii=i+a,kk=k+b;if(okCell(ii,kk)){const d=(GX0+ii*GS-x)**2+(GZ0+kk*GS-z)**2;if(d<bd){bd=d;best=[ii,kk]}}}}
  return best||[i,k]}
function clearLine(ax,az,bx,bz,st=.04){const d=Math.hypot(bx-ax,bz-az),n=Math.max(1,Math.ceil(d/st));for(let s=0;s<=n;s++){const t=s/n;if(!walkable(ax+(bx-ax)*t,az+(bz-az)*t))return false}return true}
function plan(sx,sz,tx,tz){
  const [si,sk]=nearestCell(sx,sz),[ti,tk]=nearestCell(tx,tz);
  const goal=walkable(tx,tz)?[tx,tz]:[GX0+ti*GS,GZ0+tk*GS];
  if(walkable(sx,sz)&&clearLine(sx,sz,goal[0],goal[1]))return [goal];
  if(comp[sk*GW+si]!==comp[tk*GW+ti])return [];
  const N=GW*GH,g=new Float32Array(N).fill(1e9),from=new Int32Array(N).fill(-1),closed=new Uint8Array(N),open=[];
  const S=sk*GW+si,T=tk*GW+ti,h=n=>{const dx=Math.abs(n%GW-ti),dz=Math.abs((n/GW|0)-tk);return (dx+dz)+(Math.SQRT2-2)*Math.min(dx,dz)};
  const hpush=(e)=>{let i=open.push(e)-1;while(i>0){const q=(i-1)>>1;if(open[q][0]<=open[i][0])break;[open[q],open[i]]=[open[i],open[q]];i=q}},hpop=()=>{const top=open[0],last=open.pop();if(open.length){open[0]=last;let i=0;for(;;){let l=i*2+1,r=l+1,m=i;if(l<open.length&&open[l][0]<open[m][0])m=l;if(r<open.length&&open[r][0]<open[m][0])m=r;if(m===i)break;[open[m],open[i]]=[open[i],open[m]];i=m}}return top};
  g[S]=0;hpush([h(S),S]);let found=false;
  while(open.length){const cur=hpop()[1];if(closed[cur])continue;closed[cur]=1;if(cur===T){found=true;break}
    const ci=cur%GW,ck=cur/GW|0;
    for(let a=-1;a<=1;a++)for(let b=-1;b<=1;b++){if(!a&&!b)continue;const ni=ci+a,nk=ck+b;if(!okCell(ni,nk))continue;if(a&&b&&(!okCell(ci+a,ck)||!okCell(ci,ck+b)))continue;
      const n=nk*GW+ni,c=g[cur]+(a&&b?Math.SQRT2:1);if(c<g[n]){if(GS>.3&&!walkable(GX0+(ci+a*.5)*GS,GZ0+(ck+b*.5)*GS))continue;g[n]=c;from[n]=cur;hpush([c+h(n)*1.15,n])}}}
  if(!found)return [];
  const pts=[];for(let n=T;n!==-1;n=from[n])pts.push([GX0+(n%GW)*GS,GZ0+(n/GW|0)*GS]);pts.reverse();pts.unshift([sx,sz]);if(walkable(tx,tz))pts.push([tx,tz]);
  const out=[];let a=0;while(a<pts.length-1){let lo=a+1,hi=Math.min(pts.length-1,a+90);while(lo<hi){const m=(lo+hi+1)>>1;if(clearLine(pts[a][0],pts[a][1],pts[m][0],pts[m][1]))lo=m;else hi=m-1}out.push(pts[lo]);a=lo}
  return out}
function clampWalk(v){if(!walkable(v.x,v.z)){const [i,k]=nearestCell(v.x,v.z);v.x=GX0+i*GS;v.z=GZ0+k*GS}return v}
function walkTo(x,z){blockedOnce=false;const pts=plan(pos.x,pos.z,x,z);path=pts.map(p=>new THREE.Vector3(p[0],0,p[1]));if(path.length)dest.copy(path.shift());return pts.length>0}
let state='free',pending=null,blockedOnce=false;
let sayT=0;function say(t,hold){msgEl.style.opacity=1;msgEl.textContent=t;clearTimeout(sayT);if(!hold)sayT=setTimeout(()=>{if(msgEl.textContent===t)msgEl.style.opacity=0},6500)}
function mkSpot(k,label){const b=document.createElement('button');b.className='spot';b.dataset.s=k;b.textContent=label;b.hidden=true;stage.append(b);return b;}
function terraceY(x,z){const TY=1.2,z0=z+146,ax=Math.abs(x);if(ax<18.1&&z0>81.8&&z0<106.5)return TY;if(ax<8.1&&z0>=106.5&&z0<110.9)return TY;if(ax<3.1&&z0>=110.9&&z0<113.46)return TY*(1-(z0-110.9)/2.56);if(Math.abs(ax-13)<1.8&&z0>=106.5&&z0<109.06)return TY*(1-(z0-106.5)/2.56);return 0}
const SPOT_W={};TOWN_PL.filter(pl=>pl.id==='chuamay').forEach(pl=>{SPOT_W['go_'+pl.id]={x:pl.dx,z:pl.dz,face:Math.PI,el:mkSpot('go_'+pl.id,'Vào '+pl.name),anchor:new THREE.Vector3(pl.dx,2.4+terraceY(pl.dx,pl.dz),pl.dz-1.6)}});

function mergeStatic(root,skip,shallow){root.updateMatrixWorld(true);const B=new Map(),v=new THREE.Vector3(),nm=new THREE.Matrix3(),inv=new THREE.Matrix4().copy(root.matrixWorld).invert(),REL=new Map(),each=f=>shallow?root.children.slice().forEach(f):root.traverse(f);each(o=>{if(!o.isMesh||skip.has(o))return;REL.set(o,new THREE.Matrix4().multiplyMatrices(inv,o.matrixWorld));const m=o.material;if(Array.isArray(m)||(m.transparent&&m.depthWrite&&!(m.alphaTest>0))||!o.visible)return;for(let a=o.parent;a&&a!==root;a=a.parent)if(!a.visible)return;const e=REL.get(o).elements,vc=m.type==='MeshLambertMaterial'&&!m.map&&!m.emissiveMap&&!m.transparent&&(!m.emissive||m.emissive.getHex()===0),sig=[vc?'VC':m.type,vc?0:m.color?m.color.getHex():0,m.map?m.map.uuid:0,m.emissive?m.emissive.getHex():0,m.emissiveIntensity||0,m.emissiveMap?m.emissiveMap.uuid:0,m.side,m.flatShading?1:0,m.fog?1:0,m.alphaTest||0,m.depthFunc,m.transparent?1:0,m.opacity,m.depthWrite?1:0,o.renderOrder,shallow?0:Math.floor((e[12]+60)/60),shallow?0:Math.floor((e[14]+80)/60)].join('|');(B.get(sig)||B.set(sig,[]).get(sig)).push(o)});
  let made=0,gone=0;for(const list of B.values()){if(list.length<2)continue;let n=0;const gs=list.map(o=>{let g=o.geometry.index?o.geometry.toNonIndexed():o.geometry;if(!g.attributes.normal){g=g.clone();g.computeVertexNormals()}n+=g.attributes.position.count;return g});const P=new Float32Array(n*3),N=new Float32Array(n*3),U=new Float32Array(n*2),m0=list[0].material,VC=m0.type==='MeshLambertMaterial'&&!m0.map&&!m0.emissiveMap&&!m0.transparent&&(!m0.emissive||m0.emissive.getHex()===0),C=VC?new Float32Array(n*3):null;let k=0;list.forEach((o,i)=>{const g=gs[i],p=g.attributes.position,nr=g.attributes.normal,uv=g.attributes.uv;const MW=REL.get(o);nm.getNormalMatrix(MW);for(let j=0;j<p.count;j++){v.fromBufferAttribute(p,j).applyMatrix4(MW);P[k*3]=v.x;P[k*3+1]=v.y;P[k*3+2]=v.z;v.fromBufferAttribute(nr,j).applyMatrix3(nm).normalize();N[k*3]=v.x;N[k*3+1]=v.y;N[k*3+2]=v.z;if(uv){U[k*2]=uv.getX(j);U[k*2+1]=uv.getY(j)}if(C){const c=o.material.color;C[k*3]=c.r;C[k*3+1]=c.g;C[k*3+2]=c.b}k++}});
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(P,3));g.setAttribute('normal',new THREE.BufferAttribute(N,3));g.setAttribute('uv',new THREE.BufferAttribute(U,2));if(C)g.setAttribute('color',new THREE.BufferAttribute(C,3));const mm=new THREE.Mesh(g,C?new THREE.MeshLambertMaterial({vertexColors:true,side:m0.side,flatShading:m0.flatShading,fog:m0.fog}):m0);mm.renderOrder=list[0].renderOrder;for(const o of list){o.parent.remove(o);gone++}root.add(mm);made++}
  return [gone,made]}

const CT_LIGHTS=[];
const OUTSKIRTS=(()=>{
  function canvasTexOS(draw){const c=document.createElement('canvas');c.width=c.height=128;const g=c.getContext('2d');draw(g,128);const t=sRGB(new THREE.CanvasTexture(c));t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(3,3);return t}
  const concreteWindowsOS=Array.from({length:35},(_,i)=>({x:6+(i%7)*17,y:7+Math.floor(i/7)*24,w:12*2/3,h:11*2/3}));
  const brickWindowsOS=Array.from({length:20},(_,i)=>({x:7+(i%5)*24,y:8+Math.floor(i/5)*30,w:13,h:20}));
  const brickTOS=canvasTexOS((g,w)=>{g.fillStyle='#b5765f';g.fillRect(0,0,w,w);g.strokeStyle='rgba(92,61,52,.38)';for(let y=0;y<w;y+=12){g.beginPath();g.moveTo(0,y);g.lineTo(w,y);g.stroke()}for(const p of brickWindowsOS){g.fillStyle='#65706d';g.fillRect(p.x,p.y+6,p.w,p.h-6);g.beginPath();g.arc(p.x+p.w/2,p.y+6,p.w/2,Math.PI,0);g.fill();g.fillStyle='#5f7a6e';g.fillRect(p.x-3,p.y+6,3,14);g.fillRect(p.x+p.w+1,p.y+6,3,14)}});
  const plasterTOS=canvasTexOS((g,w)=>{g.fillStyle='#fff';g.fillRect(0,0,w,w);g.fillStyle='rgba(0,0,0,.12)';for(let i=0;i<120;i++)g.fillRect((i*31)%w,(i*17)%w,2,2);for(const p of concreteWindowsOS){g.fillStyle='#707070';g.fillRect(p.x,p.y,p.w,p.h)}});
  const ashlarTOS=canvasTexOS((g,w)=>{g.fillStyle='#fff';g.fillRect(0,0,w,w);g.strokeStyle='rgba(0,0,0,.18)';for(let y=0;y<w;y+=26)for(let x=(y/26%2)*24;x<w;x+=48)g.strokeRect(x+1,y+1,46,24)}),groundTOS=canvasTexOS((g,w)=>{g.fillStyle='#a9bd8a';g.fillRect(0,0,w,w);for(const [x,y,a,b,c] of [[8,11,43,25,'#b7c088'],[58,4,57,30,'#c9bf7e'],[18,47,53,22,'#93ad7c'],[83,42,40,33,'#b7c088'],[4,86,48,30,'#c9bf7e'],[65,87,61,27,'#93ad7c']]){g.fillStyle=c;g.fillRect(x,y,a,b)}g.strokeStyle='rgba(104,128,90,.45)';for(let i=0;i<9;i++){g.beginPath();g.moveTo(0,i*16+3);g.lineTo(w,i*16+3);g.stroke()}});
  const brickMOS=lam({map:brickTOS,color:0xffffff,emissive:0xffffff,emissiveMap:brickTOS,emissiveIntensity:.34}),plasterMOS=lam({map:plasterTOS,color:0xffffff,vertexColors:true,emissive:0xffffff,emissiveMap:plasterTOS,emissiveIntensity:.28}),ashlarMOS=lam({map:ashlarTOS,color:0xffffff,vertexColors:true,emissive:0xffffff,emissiveMap:ashlarTOS,emissiveIntensity:.22}),metalMOS=lam({color:0x8c8f88,emissive:0x8c8f88,emissiveIntensity:.18}),leafMOS=lam({color:0x718b69,emissive:0x718b69,emissiveIntensity:.12}),dirtMOS=lam({color:0x93ad7c,emissive:0x93ad7c,emissiveIntensity:.16});
  plasterTOS.repeat.set(1,1);
  const rootOS=townG,dummyOS=new THREE.Object3D(),batchesOS=[],extrasOS=[],roadInstancesOS=[],roadVerticesOS=[],groupsOS=[];
  function solidOS(geometry,x,y,z,color,rx=0,ry=0,rz=0){geometry.rotateX(rx);geometry.rotateY(ry);geometry.rotateZ(rz);geometry.translate(x,y,z);extrasOS.push({geometry,color})}
  function gableOS(x,y,z,width,rise,color){const shape=new THREE.Shape();shape.moveTo(-width/2,0);shape.lineTo(width/2,0);shape.lineTo(0,rise);shape.closePath();solidOS(new THREE.ExtrudeGeometry(shape,{depth:.16,bevelEnabled:false}),x,y,z,color)}
  function batchOS(geo,mat,count){const m=new THREE.InstancedMesh(geo,mat,count);m.count=0;m.instanceMatrix.setUsage(THREE.StaticDrawUsage);rootOS.add(m);batchesOS.push(m);return m}
  const BOS={brick:batchOS(new THREE.BoxGeometry(1,1,1),brickMOS,420),plaster:batchOS(new THREE.BoxGeometry(1,1,1),plasterMOS,420),ashlar:batchOS(new THREE.BoxGeometry(1,1,1),ashlarMOS,480),metal:batchOS(new THREE.CylinderGeometry(1,1,1,8),metalMOS,1400),leaf:batchOS(new THREE.IcosahedronGeometry(1,0),leafMOS,760),dirt:batchOS(new THREE.BoxGeometry(1,1,1),dirtMOS,180)};
  function putOS(m,x,y,z,sx,sy,sz,ry=0,col){dummyOS.position.set(x,y,z);dummyOS.scale.set(sx,sy,sz);dummyOS.rotation.set(0,ry,0);dummyOS.updateMatrix();m.setMatrixAt(m.count,dummyOS.matrix);m.setColorAt(m.count,new THREE.Color(col||(m===BOS.plaster?0xb9b7ad:m===BOS.ashlar?0x8c8f88:0xffffff)));m.count++}
  function pieceOS(m,x,y,z,sx,sy,sz,rx=0,ry=0,rz=0,col){dummyOS.position.set(x,y,z);dummyOS.scale.set(sx,sy,sz);dummyOS.rotation.set(rx,ry,rz);dummyOS.updateMatrix();m.setMatrixAt(m.count,dummyOS.matrix);m.setColorAt(m.count,new THREE.Color(col||0xffffff));m.count++}
  function boxOS(w,h,d,mat,x,y,z,P=rootOS,ry=0,col){const m=mat===brickMOS?BOS.brick:mat===plasterMOS?BOS.plaster:mat===dirtMOS?BOS.dirt:BOS.ashlar;putOS(m,x,y,z,w,h,d,ry,col);return P}
  function cylOS(rt,rb,h,mat,x,y,z,seg=8,P=rootOS,col){putOS(BOS.metal,x,y,z,rt*2,h,rt*2,0,col);return P}
  function beamOS(x,y,z,w,h,d,rx=0,ry=0,rz=0,col){pieceOS(BOS.metal,x,y,z,w,h,d,rx,ry,rz,col)}
  function treeOS(x,z,s=1,col=0x6f8b69){if(x>87.5-1.5*s&&z>-50-1.5*s&&z<190+1.5*s)z=194+1.5*s;putOS(BOS.metal,x,.9*s,z,.22*s,1.8*s,.22*s,0,0x71807a);putOS(BOS.leaf,x,2.6*s,z,1.25*s,1.5*s,1.25*s,0,col)}
  function roofOS(x,y,z,w,d,mat=brickMOS,col){boxOS(w,.32,d,mat,x,y,z,rootOS,.10,col);boxOS(w,.32,d,mat,x,y,z,rootOS,-.10,col)}
  function roadOS(x,z,w,d,ry=0){roadInstancesOS.push(BOS.ashlar.count);boxOS(w,.08,Math.max(d,4),ashlarMOS,x,.04,z,rootOS,ry,0xb4b1a6)}
  const groupOS=(name,center,bounds,build)=>{const g=new THREE.Group(),l=Math.hypot(center[0],center[1])||1,front=[-center[0]/l,-center[1]/l],yaw=Math.atan2(front[0],front[1]);g.name=name;g.userData={center,bounds,front,yaw};townG.add(g);groupsOS.push({name,group:g,center,bounds,front,yaw});build(g);return g};
  const fieldOS=(x,z,w,d,c,ry=0)=>boxOS(w,.025,d,dirtMOS,x,-.065,z,rootOS,ry,c); const railOS=(x,z,len)=>{for(const dx of [-3,-1,1,3])beamOS(x+dx,.14,z,.12,.12,len,0,0,0,0x596664)};
  function outskirtsOS(P){
    function mill(){return groupOS('mill',[-178,60],[46,33],g=>{boxOS(38,15,17,brickMOS,-181,7.5,60,g);roofOS(-181,15.4,60,42,20,ashlarMOS);boxOS(13,22,12,brickMOS,-156,11,61,g);roofOS(-156,22.4,61,15,14,ashlarMOS);boxOS(2.5,30,2.5,brickMOS,-208,15,66,g);boxOS(2.1,.25,2.1,brickMOS,-208,30.1,66,g);roadOS(-141,75,74,4,.25);for(let i=0;i<16;i++)treeOS(-211+i*4.7,84,.68)})}
    function railworks(){return groupOS('railworks',[-225,10],[64,108],g=>{boxOS(45,12,24,brickMOS,-224,6,10,g);const pitch=9,rise=3;for(let i=0;i<5;i++){const x=-246.5+i*pitch;pieceOS(BOS.ashlar,x+pitch/2,12+rise/2,10,Math.hypot(pitch,rise),.22,24,0,0,Math.atan2(rise,pitch),0x8c8f88);boxOS(.22,rise,24,plasterMOS,x+pitch,13.5,10,g,0,0xb9b7ad)}railOS(-231,-25,59);for(let i=0;i<3;i++){const z=-12-i*12;boxOS(3,3,10,ashlarMOS,-231,2,z,g,0,i%2?0x5f7a6e:0x7a6a58);for(const dz of [-3,3])for(const dx of [-1.6,1.6])pieceOS(BOS.metal,-231+dx,.5,z+dz,.5,.25,.5,0,0,Math.PI/2,0x596664)}roadOS(-185,2,53,4,-.03);for(let i=0;i<20;i++)treeOS(-257+i*5.4,37,.66)})}
    function shipyard(){return groupOS('shipyard',[190,187],[90,74],g=>{boxOS(43,11,18,brickMOS,179,5.5,207,g);const angle=Math.PI/12,rise=21.5*Math.tan(angle);for(const z of [198,215.84])gableOS(179,11,z,43,rise,0xb5765f);for(const side of [-1,1])pieceOS(BOS.ashlar,179+side*10.75,11+rise/2,207,21.5/Math.cos(angle),.25,20,0,0,-side*angle,0x8c8f88);boxOS(35,.5,14,ashlarMOS,207,.25,177,g,0,0xabb0a5);for(const z of [169,185])boxOS(38,.7,2,ashlarMOS,207,.35,z,g,0,0xb9b7ad);for(const x of [190,223]){for(const z of [166,188])boxOS(.8,18,.8,ashlarMOS,x,9,z,g,0,0x768482);boxOS(.8,.8,24,ashlarMOS,x,18,177,g,0,0x768482);pieceOS(BOS.ashlar,x,19,176,.65,.65,Math.hypot(12,2),-Math.atan2(2,12),0,0,0x768482);boxOS(.15,9,.15,ashlarMOS,x,14.5,176,g,0,0x596664)}const hull=new THREE.Shape();hull.moveTo(-15,-3);hull.lineTo(9,-4);hull.lineTo(15,0);hull.lineTo(9,4);hull.lineTo(-15,3);hull.closePath();solidOS(new THREE.ExtrudeGeometry(hull,{depth:3,bevelEnabled:false}),207,3.8,177,0x596f74,Math.PI/2);boxOS(9,1.5,5,ashlarMOS,199,4.55,177,g,0,0xb9b7ad);boxOS(3,.5,25,ashlarMOS,235,.5,177.5,g,0,0xb6aa8b);for(const z of [167,178,189])boxOS(.6,2,.6,ashlarMOS,235,0,z,g,0,0x8c8f88);roadOS(179,222,72,4);for(let i=0;i<24;i++)treeOS(149+i*3.7,230+(i%2)*4,.64)})}
    function mine(){return groupOS('mine',[-205,-64],[82,60],g=>{boxOS(30,13,17,brickMOS,-207,6.5,-76,g);roofOS(-207,13.2,-76,34,20,ashlarMOS);const top=20;for(const z of [-60,-54]){for(const side of [-1,1])pieceOS(BOS.ashlar,-231+side*3,top/2,z,.65,Math.hypot(top,6),.65,0,0,side*Math.atan2(6,top),0x6e7a75);boxOS(9,.55,.55,ashlarMOS,-231,8,z,g,0,0x6e7a75)}boxOS(.7,.7,8,ashlarMOS,-231,20,-57,g,0,0x6e7a75);solidOS(new THREE.TorusGeometry(1.7,.3,6,16),-231,20,-57,0x6e7a75);for(let i=0;i<4;i++)pieceOS(BOS.ashlar,-231,20,-57,3.4,.16,.18,0,0,i*Math.PI/4,0x6e7a75);pieceOS(BOS.ashlar,-231+35*Math.cos(Math.PI/6)/2,1+35*.5/2,-57,35,2,2.4,0,0,-Math.PI/6,0x8c8f88);for(let i=0;i<30;i++){const a=i/30*Math.PI*2,r=8+(i%5)*1.2;boxOS(3.2,.65,3.2,dirtMOS,-183+Math.cos(a)*r,.33,-67+Math.sin(a)*r,g,0,0x58605b)}railOS(-184,-88,39);roadOS(-183,-48,48,3,-.55);for(let i=0;i<20;i++)treeOS(-249+i*4.5,-95,.8)})}
    function tunnelSite(){return groupOS('tunnelSite',[-230,120],[66,68],g=>{boxOS(31,.025,23,brickMOS,-230,-.065,120,g,.1);for(const [x,z,s] of [[-241,123,1.5],[-233,113,1.15],[-222,125,1.3]]){boxOS(s*1.8,s*.5,s*1.5,brickMOS,x,s*.25,z,g,0);boxOS(s*1.1,s*.45,s,brickMOS,x,s*.7,z,g,0)}for(const x of [-239,-232,-225])cylOS(.12,.12,3.2,metalMOS,x,1.6,121,8,g,0x79644d);roofOS(-232,3.3,121,12,7,brickMOS,0xa88956);boxOS(2.2,.45,.35,plasterMOS,-232,1.5,117.5,g,0,0xb9a978);boxOS(2.8,2.2,.55,ashlarMOS,-219,1.1,122,g,0,0xa9a598);boxOS(3.2,.25,.8,ashlarMOS,-219,2.3,122,g,0,0xbab19c);for(let i=0;i<140;i++){const a=i/140*Math.PI*2,r=18+(i%6)*2;treeOS(-230+Math.cos(a)*r,120+Math.sin(a)*r,.58+(i%4)*.18,i%5?0x56735e:0x698565)}roadOS(-178,103,51,3,.45)})}
    function socialistBlock(){return groupOS('socialistBlock',[-60,174],[84,60],g=>{boxOS(42,15,16,plasterMOS,-60,7.5,193,g,0,0xbdbdb4);roofOS(-60,15.2,193,45,19,ashlarMOS,0x929a96);for(const x of [-92,-60,-28]){boxOS(16,15,10,plasterMOS,x,7.5,172,g,0,0xb6b6ae);boxOS(17,.28,12,ashlarMOS,x,15.14,172,g,0,0x909994)}roadOS(-60,154,84,4);for(const z of [148,160])for(let i=0;i<15;i++)treeOS(-99+i*5.6,z,.68,0x718363)})}
    function modernPark(){return groupOS('modernPark',[70,190],[82,52],g=>{boxOS(56,11,22,plasterMOS,42,5.5,190,g,0,0xe4e2d8);boxOS(56,1.1,3,plasterMOS,42,12.5,181,g,0,0xe4e2d8);boxOS(56,1.1,3,plasterMOS,42,12.5,199,g,0,0xe4e2d8);roofOS(42,11.3,190,60,25,ashlarMOS,0x8c8f88);boxOS(35,14,25,plasterMOS,91,7,197,g,0,0xe4e2d8);roofOS(91,14.3,197,39,28,ashlarMOS,0x8c8f88);for(let i=0;i<8;i++)solidOS(new THREE.CylinderGeometry(.9,.9,38/8,12),113,(i+.5)*38/8,178,i%2?0xe4e2d8:0xb5765f);boxOS(26,8,18,plasterMOS,122,4,197,g,0,0xe4e2d8);roofOS(122,8.3,197,29,21,ashlarMOS,0x8c8f88);roadOS(70,174,137,4,.12);for(let i=0;i<28;i++)treeOS(8+i*5.3,215+(i%3)*3,.67)})}
    mill();railworks();shipyard();mine();tunnelSite();socialistBlock();modernPark();fieldOS(-136,90,65,35,0x8c965b,.16);fieldOS(-121,117,78,30,0x67855c,.12);fieldOS(-32,111,81,29,0xa69b5b,-.1);fieldOS(37,145,75,34,0x758b5e,.12);fieldOS(91,158,61,30,0x9f9858,.05);fieldOS(-150,-101,85,32,0x73855c,-.08);roadOS(-190,85,70,3,.22);roadOS(-195,-15,70,3,-.7);roadOS(-24,138,64,3,.08);roadOS(26,171,128,3,.15);railOS(-189,57,54);for(let x=-255;x<192;x+=8){if(x<-112||x>112)treeOS(x,103+(x%24?0:9),.58,0x627a61)}for(let x=-255;x<125;x+=10)treeOS(x,-107,.52,0x60765d);
    return {groups:groupsOS,batches:batchesOS};
  }
  const result=outskirtsOS(townG);
  for(const b of batchesOS){b.instanceMatrix.needsUpdate=true;if(b.instanceColor)b.instanceColor.needsUpdate=true}
  const windowMatOS=lam({color:0xffc878,emissive:0xffc878,emissiveIntensity:0}),windowOS=new THREE.InstancedMesh(new THREE.BoxGeometry(1.1,1.1,.08),windowMatOS,64),windowDummyOS=new THREE.Object3D();let wiOS=0;for(const [cx,cz,rows,cols] of [[-181,52,3,3],[-224,-2,3,3],[179,198,2,3],[-207,-84,1,3],[-232,117,1,3],[-60,166,3,3],[42,181,2,3],[91,181,2,3]])for(let r=0;r<rows;r++)for(let c=0;c<cols;c++){windowDummyOS.position.set(cx+(c-(cols-1)/2)*5,4.4+r*2.5,cz);windowDummyOS.updateMatrix();windowOS.setMatrixAt(wiOS++,windowDummyOS.matrix)}windowOS.count=wiOS;windowOS.instanceMatrix.needsUpdate=true;townG.add(windowOS);CT_LIGHTS.push(windowOS);lanterns.push(windowOS)
  return {groups:result.groups,sourceBatches:batchesOS};
})();
mergeMe();
TW_FORCE.push([-48.0125,47.9875,.3]);
const MERGED=mergeStatic(townG,new Set(CT_LIGHTS));townG.traverse(o=>{o.updateMatrix();o.matrixAutoUpdate=false});townG.updateMatrixWorld(true);
const TOWN={g:townG,walk:walkTown,floorY:(z,x)=>Math.abs(x+34)<1.7&&z>18.5&&z<30.4?.22+.62*Math.sin((z-18.5)/11.9*Math.PI):z<-20?terraceY(x,z):0,gs:.4,gx:-94,gz:-76,gw:470,gh:370,start:[0,66.5],spots:SPOT_W,title:['Thị trấn Mây',''],hello:'Chạm nền để đi, kéo để xoay. Muốn tìm suối, vách núi hay một ngôi chùa: bấm «Bản đồ» ở bên phải.',vis:k=>Math.hypot(pos.x-SPOT_W[k].x,pos.z-SPOT_W[k].z)<28};
W=TOWN;SPOT=SPOT_W;townG.visible=true;
GS=TOWN.gs;GX0=TOWN.gx;GZ0=TOWN.gz;GW=TOWN.gw;GH=TOWN.gh;buildGrid();
pos.set(...[TOWN.start[0],0,TOWN.start[1]]);dest.copy(pos);
function go(k){if(!SPOT[k])return;if(Math.hypot(pos.x-SPOT[k].x,pos.z-SPOT[k].z)<.35){begin(k);return;}pending=k;state='going';if(!walkTo(SPOT[k].x,SPOT[k].z)){state='free';pending=null;say('Không qua được lối này, thử đi lối khác.');}}
function begin(k){if(k!=='go_chuamay')return;pending=null;state='free';path=[];dest.copy(pos);onEnterHall({x:pos.x,z:pos.z,yaw:yawT,pitch:tPitchT,distance:tDistT});}
Object.entries(SPOT).forEach(([k,s])=>s.el.addEventListener('click',()=>go(k)));

const ray=new THREE.Raycaster(),ndc=new THREE.Vector2(),gp=new THREE.Plane(new THREE.Vector3(0,1,0),0),hit=new THREE.Vector3();
let down=null,yaw=0,yawT=0,tPitch=.42,tPitchT=.42,tDist=13.5,tDistT=13.5,lastW=null;const ptrs=new Map();let pinch=null;
const marker=new THREE.Mesh(new THREE.RingGeometry(.22,.3,28),new THREE.MeshBasicMaterial({color:0xfff2cc,transparent:true,opacity:0,depthWrite:false}));marker.rotation.x=-Math.PI/2;scene.add(marker);
renderer.domElement.addEventListener('pointerdown',e=>{ptrs.set(e.pointerId,[e.clientX,e.clientY]);if(ptrs.size===2){const a=[...ptrs.values()];pinch={d:Math.hypot(a[0][0]-a[1][0],a[0][1]-a[1][1])||1,z:tDistT};if(down)down.moved=true;return}down={x:e.clientX,y:e.clientY,yaw:yawT,pitch:tPitchT,moved:false}});
renderer.domElement.addEventListener('wheel',e=>{if(W!==TOWN)return;e.preventDefault();tDistT=THREE.MathUtils.clamp(tDistT*(1+Math.sign(e.deltaY)*.1),8,30)},{passive:false});
const pEnd=e=>{ptrs.delete(e.pointerId);if(ptrs.size<2)pinch=null};addEventListener('pointercancel',e=>{pEnd(e);down=null});
addEventListener('pointermove',e=>{if(ptrs.has(e.pointerId))ptrs.set(e.pointerId,[e.clientX,e.clientY]);if(pinch&&ptrs.size>=2){const a=[...ptrs.values()],d=Math.hypot(a[0][0]-a[1][0],a[0][1]-a[1][1])||1;if(W===TOWN)tDistT=THREE.MathUtils.clamp(pinch.z*pinch.d/d,8,30);return}if(!down)return;const dx=e.clientX-down.x,dy=e.clientY-down.y;if(Math.hypot(dx,dy)>9)down.moved=true;if(down.moved){if(W===TOWN){yawT=down.yaw-dx*.009;tPitchT=THREE.MathUtils.clamp(down.pitch+dy*.005,.16,1.3)}else yawT=THREE.MathUtils.clamp(down.yaw-dx*.006,-.7,.7)}});
addEventListener('pointerup',e=>{pEnd(e);if(!down)return;const d=down;down=null;if(d.moved||ptrs.size)return;
  const r=renderer.domElement.getBoundingClientRect();ndc.set((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);ray.setFromCamera(ndc,camera);
  let best=null;for(const y of [1.2,0]){gp.constant=-y;if(ray.ray.intersectPlane(gp,hit)){const ok=W===TOWN?(y===0||terraceY(hit.x,hit.z)>.9):y===PLAT?hit.z<-1.8&&hit.z>-11&&Math.abs(hit.x)<8.6:true;if(ok){best=hit.clone();break}}}
  if(!best)return;state='free';pending=null;if(!walkTo(best.x,best.z)){say('Không qua được lối này, thử đi lối khác.');return}const m=clampWalk(best.clone());marker.position.set(m.x,floorY(m.z,m.x)+.03,m.z);marker.material.opacity=.9; });
const camPos=new THREE.Vector3(),camLook=new THREE.Vector3(),tmp=new THREE.Vector3(),v3=new THREE.Vector3(),lookNow=new THREE.Vector3();let wide=0;
function resize(){const w=stage.clientWidth,h=stage.clientHeight;renderer.setSize(w,h,false);camera.aspect=w/h;camera.fov=w/h<.8?58:w/h<1.3?48:40;camera.updateProjectionMatrix()}
const observer=new ResizeObserver(resize);observer.observe(stage);resize();
const mini=document.createElement('canvas');mini.id='mini';mini.hidden=true;mini.width=696;mini.height=252;mini.setAttribute('aria-label','Bản đồ thu nhỏ');stage.appendChild(mini);const mctx=mini.getContext('2d'),miniBase=document.createElement('canvas');miniBase.width=696;miniBase.height=252;
const MK=696/188,mX=x=>(x+94)*MK,mZ=z=>(z+76)*(252/152);
{const c=miniBase.getContext('2d'),sz=252/152;c.fillStyle='#b9cfa0';c.fillRect(0,0,696,252);c.fillStyle='#8fb6c8';c.fillRect(mX(84),mZ(-76),696-mX(84),mZ(76)-mZ(-76));
  c.fillStyle='#e6d9bb';for(const [w,d,x,z] of [[62,29,0,141.5],[40,27,0,112.5],[31,17,0,92]])c.fillRect(mX(x-w/2),mZ(z-d/2),w*MK,d*sz);
  for(const q of PATHBAD){c.beginPath();c.arc(mX(q[0]),mZ(q[1]),q[2]*MK,0,7);c.fill()}
  c.fillStyle='#7fb0c6';for(const l of LAKE){c.beginPath();c.arc(mX(l[0]),mZ(l[1]),l[2]*MK,0,7);c.fill()}c.fillStyle='#b9cfa0';c.beginPath();c.arc(mX(ISLE[0]),mZ(ISLE[1]),ISLE[2]*MK,0,7);c.fill();c.fillStyle='#b5392e';c.fillRect(mX(-1.4),mZ(12.5),2.8*MK,11.9*sz);
  c.fillStyle='#c9a892';for(const r of HALLR)c.fillRect(mX(r[0]),mZ(r[2]),(r[1]-r[0])*MK,(r[3]-r[2])*sz);
  c.fillStyle='#a8705c';c.beginPath();c.arc(mX(0),mZ(141),3.2*MK,0,7);c.fill();
  c.strokeStyle='#6a5a48';c.lineWidth=2.5;c.strokeRect(mX(-91),mZ(-72),182*MK,144*sz);c.strokeStyle='#7fb0c6';c.lineWidth=6;c.beginPath();STREAM.forEach((q,i)=>i?c.lineTo(mX(q[0]),mZ(q[1])):c.moveTo(mX(q[0]),mZ(q[1])));c.stroke();
  const MROOF={chuamay:'#a8431f',dilac:'#7a4030',quanam:'#3f6272',lientri:'#b05a2c',diatang:'#5e4236',duocsu:'#2f4c6a',namtong:'#b8891f',tuduong:'#7a4030'};
  const ic=(k,x,z,col)=>{const S=k==='main'?21:k==='cot'?10:14;c.save();c.translate(mX(x),mZ(z));c.lineJoin='round';c.lineCap='round';
    const P=f=>{c.beginPath();f();c.closePath()},out=()=>{c.strokeStyle='#fffaf0';c.lineWidth=5;c.stroke()},fill=col2=>{c.fillStyle=col2;c.fill()};
    if(k==='temple'||k==='main'){P(()=>c.rect(-S*.62,-S*.05,S*1.24,S*.75));out();fill('#f6eedc');P(()=>{c.moveTo(-S*1.2,S*.05);c.quadraticCurveTo(-S*.7,-S*.1,-S*.5,-S*.8);c.lineTo(S*.5,-S*.8);c.quadraticCurveTo(S*.7,-S*.1,S*1.2,S*.05);c.quadraticCurveTo(0,S*.22,-S*1.2,S*.05)});out();fill(col);c.fillStyle='#5a3a28';c.fillRect(-S*.16,S*.2,S*.32,S*.5)}
    else if(k==='cot'){P(()=>{c.moveTo(-S,-S*.1);c.lineTo(0,-S);c.lineTo(S,-S*.1);c.lineTo(S*.72,-S*.1);c.lineTo(S*.72,S*.8);c.lineTo(-S*.72,S*.8);c.lineTo(-S*.72,-S*.1)});out();fill('#8a6248')}
    else if(k==='tower'){P(()=>{c.moveTo(0,-S*1.5);c.lineTo(S*.45,-S*.8);c.lineTo(S*.3,-S*.8);c.lineTo(S*.6,-S*.1);c.lineTo(S*.42,-S*.1);c.lineTo(S*.75,S*.7);c.lineTo(-S*.75,S*.7);c.lineTo(-S*.42,-S*.1);c.lineTo(-S*.6,-S*.1);c.lineTo(-S*.3,-S*.8);c.lineTo(-S*.45,-S*.8)});out();fill('#9a4a30')}
    else if(k==='water'){P(()=>{c.moveTo(0,-S*1.1);c.bezierCurveTo(S*1.1,S*.1,S*.8,S*.95,0,S*.95);c.bezierCurveTo(-S*.8,S*.95,-S*1.1,S*.1,0,-S*1.1)});out();fill('#2f86b4')}
    else if(k==='cliff'){P(()=>{c.moveTo(-S*1.15,S*.8);c.lineTo(-S*.25,-S*.95);c.lineTo(S*.2,-S*.2);c.lineTo(S*.5,-S*.6);c.lineTo(S*1.15,S*.8)});out();fill('#5f7468');c.fillStyle='#fffaf0';P(()=>{c.moveTo(-S*.25,-S*.95);c.lineTo(-S*.5,-S*.45);c.lineTo(-S*.22,-S*.6);c.lineTo(0,-S*.5)});c.fill()}
    else if(k==='lotus'){for(const r of [-.75,.75,0]){c.save();c.rotate(r);P(()=>{c.moveTo(0,S*.7);c.quadraticCurveTo(-S*.6,-S*.2,0,-S);c.quadraticCurveTo(S*.6,-S*.2,0,S*.7)});out();fill(r?'#e58aa6':'#f2a9be');c.restore()}}
    else if(k==='paw'){for(const [px,pz,r] of [[0,S*.35,S*.55],[-S*.7,-S*.3,S*.27],[0,-S*.7,S*.29],[S*.7,-S*.3,S*.27]]){c.beginPath();c.arc(px,pz,r,0,7);out()}for(const [px,pz,r] of [[0,S*.35,S*.55],[-S*.7,-S*.3,S*.27],[0,-S*.7,S*.29],[S*.7,-S*.3,S*.27]]){c.beginPath();c.arc(px,pz,r,0,7);fill('#b0596a')}}
    else if(k==='fount'){c.beginPath();c.arc(0,0,S*.95,0,7);out();fill('#e9dcae');c.beginPath();c.arc(0,0,S*.62,0,7);fill('#58a6c8');c.beginPath();c.arc(0,0,S*.22,0,7);fill('#f2a9be')}
    else if(k==='pav'){P(()=>{c.moveTo(-S*1.05,-S*.05);c.lineTo(0,-S*.95);c.lineTo(S*1.05,-S*.05)});out();fill('#7a4030');c.strokeStyle='#fffaf0';c.lineWidth=6;for(const q of [-.6,.6]){c.beginPath();c.moveTo(S*q,0);c.lineTo(S*q,S*.8);c.stroke()}c.strokeStyle='#5a3a28';c.lineWidth=3;for(const q of [-.6,.6]){c.beginPath();c.moveTo(S*q,0);c.lineTo(S*q,S*.8);c.stroke()}}
    else if(k==='flower'){for(let i=0;i<5;i++){const a=i/5*6.283;c.beginPath();c.arc(Math.cos(a)*S*.55,Math.sin(a)*S*.55,S*.42,0,7);out()}for(let i=0;i<5;i++){const a=i/5*6.283;c.beginPath();c.arc(Math.cos(a)*S*.55,Math.sin(a)*S*.55,S*.42,0,7);fill('#e9a13a')}c.beginPath();c.arc(0,0,S*.3,0,7);fill('#fff3c4')}
    c.restore()};
  const MKIND={suoi:'water',cliff:'cliff',pet:'paw',chuamay:'main'};
  ic('fount',0,8);ic('pav',-46,50);ic('pav',20,36);ic('flower',64,42);ic('lotus',-26,25);ic('tower',36,2);
  for(const t of TOWN_PL)if(t.id!=='chuamay')ic(MKIND[t.id]||'temple',t.ax,t.az,MROOF[t.id]||'#7a4030');
  {const t=TOWN_PL.find(q=>q.id==='chuamay');if(t)ic('main',t.ax,t.az,MROOF.chuamay)}}
let miniT=0;function drawMini(){mctx.drawImage(miniBase,0,0);const x=mX(pos.x),z=mZ(pos.z);mctx.save();mctx.translate(x,z);mctx.rotate(-faceY);mctx.fillStyle='#fff';mctx.beginPath();mctx.moveTo(0,16);mctx.lineTo(-8,-2);mctx.lineTo(8,-2);mctx.fill();mctx.restore();mctx.fillStyle='#d2342a';mctx.strokeStyle='#fff';mctx.lineWidth=4;mctx.beginPath();mctx.arc(x,z,8,0,7);mctx.stroke();mctx.fill()}
mini.addEventListener('pointerdown',e=>e.stopPropagation());mini.addEventListener('pointerup',e=>{e.stopPropagation();if(W!==TOWN||state==='ritual')return;const r=mini.getBoundingClientRect(),x=(e.clientX-r.left)/r.width*188-94,z=(e.clientY-r.top)/r.height*152-76;let best=null;for(let a=0;a<40&&!best;a++){const rr=a*.6;for(let k=0;k<12;k++){const px=x+Math.cos(k*.524)*rr,pz=z+Math.sin(k*.524)*rr;if(walkable(px,pz)){best=[px,pz];break}}}if(!best)return;state='free';pending=null;if(!walkTo(best[0],best[1])){say('Không qua được lối này, thử đi lối khác.');return}marker.position.set(best[0],floorY(best[1],best[0])+.05,best[1]);marker.material.opacity=.9;});
const footRing=new THREE.Mesh(new THREE.RingGeometry(.42,.58,28),new THREE.MeshBasicMaterial({color:0xf2c860,transparent:true,opacity:.75,depthWrite:false}));footRing.rotation.x=-Math.PI/2;footRing.visible=false;scene.add(footRing);
const PL_DESC={chuamay:'Vào chánh điện',suoi:'Cảnh quan suối',cliff:'Cảnh quan núi',pet:'Cảnh quan bên ngoài'};
const placesBtn=document.createElement('button');placesBtn.id='placesbtn';placesBtn.textContent='Bản đồ';placesBtn.hidden=true;stage.appendChild(placesBtn);const placesEl=document.createElement('div');placesEl.id='places';placesEl.hidden=true;stage.appendChild(placesEl);
const ZONES=[['Quần thể Chùa Mây','#a04424'],['Núi và suối','#24666c'],['Vườn hồ','#3f7030'],['Thung lũng phía sau','#4a5a9a'],['Khu công cộng','#5f5040']],ROOFC={chuamay:'#b5532e',dilac:'#7a4030',quanam:'#4f6b78',lientri:'#b8683c',diatang:'#5e4236',duocsu:'#35506c',namtong:'#c9a24a',tuduong:'#7a4030',pet:'#c98f86'};
function guideList(){const d=(id,zn)=>{const p=TOWN_PL.find(q=>q.id===id);return {id,zn,name:p.name,desc:PL_DESC[id]||'',mx:p.ax,mz:p.az,x:p.dx,z:p.dz+1.2,door:id==='chuamay'}};
  return [{zn:0,name:'Bảo tháp',desc:'Tháp bảy tầng ở sân trước',mx:36,mz:2,x:36,z:8,tw:1},d('chuamay',0),d('suoi',1),d('cliff',1),{zn:2,name:'Hồ sen và cầu đỏ',desc:'Qua cầu ra đảo giữa hồ',mx:-34,mz:21,x:-34,z:29},d('dilac',2),d('quanam',2),d('lientri',2),d('namtong',2),d('tuduong',2),d('pet',2),d('diatang',3),d('duocsu',3)].map((o,i)=>({...o,n:i+1})).concat([{n:'A',zn:4,name:'Đài sen',desc:'Sân tròn có bồn sen, ghế đá',mx:0,mz:8,x:.6,z:17},{n:'B',zn:4,name:'Chòi nghỉ rừng thông',desc:'Chòi nghỉ rừng phía tây',mx:-46,mz:50,x:-46,z:44},{n:'C',zn:4,name:'Sân nghỉ',desc:'Chòi, ghế đá, chậu cảnh',mx:20,mz:36,x:13.6,z:35},{n:'D',zn:4,name:'Vườn hoa',desc:'Bốn luống hoa phía đông',mx:64,mz:42,x:58,z:36}])}
let guidePins=[];
function drawGuide(cv,list){const Wc=cv.width,k=Wc/188,kz=cv.height/152,X=x=>(x+94)*k,Z=z=>(z+76)*kz,c=cv.getContext('2d');if(!c.roundRect)c.roundRect=(x,y,w,h)=>c.rect(x,y,w,h);const el=(x,z,rx,rz)=>{c.beginPath();c.ellipse(X(x),Z(z),rx*k,rz*kz,0,0,7);c.fill()};
  c.fillStyle='#f3ead6';c.fillRect(0,0,Wc,cv.height);
  c.fillStyle='#a9d0dc';c.fillRect(X(38),Z(-34),Wc,Z(46)-Z(-34));c.strokeStyle='#fff';c.lineWidth=2;for(let i=0;i<5;i++){c.beginPath();c.moveTo(X(42.5),Z(-24+i*14));c.quadraticCurveTo(X(43.7),Z(-26+i*14),X(45),Z(-24+i*14));c.stroke()}
  for(const s of [-1,1])[[0,10,'#9fb59a'],[-9,7.5,'#8aa58c'],[8,7,'#7d9a84'],[2,5.5,'#6f8f7c']].forEach(([dz,h,col])=>{c.fillStyle=col;c.beginPath();c.moveTo(X(s*46),Z(73+dz+12));c.lineTo(X(s*(46-h*.55)),Z(73+dz));c.lineTo(X(s*46),Z(73+dz-12));c.fill()});
  c.fillStyle='#cfe0b0';c.strokeStyle='#8a7a5a';c.lineWidth=3;c.beginPath();c.roundRect(X(-91),Z(-72),182*k,144*kz,14);c.fill();
  c.fillStyle='#bfd6a6';c.fillRect(X(-40)+2,Z(-65)+10,80*k-4,Z(-29)-Z(-65)-10);
  c.fillStyle='#ecdcb8';for(const [w,d,x,z] of [[62,29,0,141.5],[40,27,0,112.5],[31,17,0,92]]){c.beginPath();c.roundRect(X(x-w/2),Z(z-d/2),w*k,d*kz,8);c.fill()}
  let sd=5;const rr=()=>(sd=sd*16807%2147483647)/2147483647;for(let i=0;i<150;i++){const x=-38+rr()*76,z=-62+rr()*186;if(LAKE.some(l=>Math.hypot(x-l[0],z-l[1])<l[2]+2)||(Math.abs(x)<32&&z>80)||PATHBAD.some(q=>Math.hypot(x-q[0],z-q[1])<q[2]+1.5))continue;c.fillStyle=z<-6?'#7fa77a':i%3?'#a3c487':'#8fb878';el(x,z,1.5,2.1)}
  c.fillStyle='#f4e7c6';for(const q of PATHBAD)el(q[0],q[1],q[2],q[2]);
  c.strokeStyle='#8ec3d6';c.lineWidth=7;c.lineCap='round';c.beginPath();STREAM.forEach((q,i)=>i?c.lineTo(X(q[0]),Z(q[1])):c.moveTo(X(q[0]),Z(q[1])));c.stroke();
  c.fillStyle='#e9dcae';for(const l of LAKE)el(l[0],l[1],l[2]+1,l[2]+1);c.fillStyle='#8ec3d6';for(const l of LAKE)el(l[0],l[1],l[2],l[2]);c.fillStyle='#cfe0b0';el(ISLE[0],ISLE[1],ISLE[2],ISLE[2]);
  c.fillStyle='#f6b7c8';for(let i=0;i<9;i++)el(-17+rr()*12,2+rr()*12,.7,.9);
  c.fillStyle='#c9c2b2';for(const b of BRIDGE.slice(1))c.fillRect(X(b[0]),Z(b[2]),(b[1]-b[0])*k,(b[3]-b[2])*kz);c.fillStyle='#b5392e';c.fillRect(X(-1.5),Z(12.5),3*k,11.9*kz);
  c.strokeStyle='#8a7a5a';c.lineWidth=3;c.beginPath();c.roundRect(X(-91),Z(-72),182*k,144*kz,14);c.stroke();
  const house=(x,z,s,col)=>{const px=X(x),pz=Z(z);c.fillStyle='#f6eedc';c.fillRect(px-s*.72,pz-s*.1,s*1.44,s*.62);c.fillStyle='#5a3a28';c.fillRect(px-s*.16,pz+s*.14,s*.32,s*.38);c.fillStyle=col;c.beginPath();c.moveTo(px-s*1.15,pz-s*.02);c.quadraticCurveTo(px-s*.7,pz-s*.12,px-s*.5,pz-s*.72);c.lineTo(px+s*.5,pz-s*.72);c.quadraticCurveTo(px+s*.7,pz-s*.12,px+s*1.15,pz-s*.02);c.quadraticCurveTo(px,pz+s*.12,px-s*1.15,pz-s*.02);c.fill()};
  guidePins=[];for(const o of list){const s=o.id==='chuamay'?34:22;let py=Z(o.mz)-30;if(o.tw){const px=X(o.mx),pz=Z(o.mz);for(let i=0;i<5;i++){const w=20-i*3;c.fillStyle='#b98670';c.fillRect(px-w/2,pz+14-i*11,w,9);c.fillStyle='#5a3a28';c.fillRect(px-w/2-3,pz+12-i*11,w+6,3)}py=Z(o.mz)-50}else if(o.id==='chuamay'){house(o.mx,o.mz,s,ROOFC[o.id]);py=Z(o.mz)-46}else if(ROOFC[o.id])house(o.mx,o.mz,s,ROOFC[o.id]);else if(o.door)py=Z(o.mz)-6;else py=Z(o.mz);if(o.zn===4)py=Z(o.mz);
    const px=X(o.mx)+(o.id==='suoi'?26:o.id==='cliff'?-26:o.id==='tuduong'?26:o.tw||ROOFC[o.id]||o.zn===4?0:30);guidePins.push({o,x:px,y:py});c.fillStyle=ZONES[o.zn][1];c.strokeStyle='#fff';c.lineWidth=4;c.beginPath();c.arc(px,py,o.zn===4?24:28,0,7);c.fill();c.stroke();c.fillStyle='#fff';c.font='bold 32px system-ui,sans-serif';c.textAlign='center';c.textBaseline='middle';c.fillText(o.n,px,py+2)}
  c.fillStyle='#5a4632';c.font='bold 20px system-ui,sans-serif';c.textAlign='center';c.fillText('Cổng vào',X(0),Z(62.5)+24);{const nx=X(0),nz=Z(62.5);c.fillStyle='#b5532e';c.beginPath();c.moveTo(nx,nz-22);c.lineTo(nx-9,nz+8);c.lineTo(nx,nz+2);c.lineTo(nx+9,nz+8);c.fill()}
  if(W===TOWN){const px=X(Math.max(-40,Math.min(40,pos.x))),pz=Z(Math.max(-65,Math.min(160,pos.z)));c.fillStyle='#fff';c.beginPath();c.arc(px,pz,13,0,7);c.fill();c.fillStyle='#d8262c';c.beginPath();c.arc(px,pz,8.5,0,7);c.fill()}}
function goPlace(o){placesEl.hidden=true;state='free';pending=null;path=[];pos.set(o.x,0,o.z);dest.copy(pos);faceY=wantY=Math.PI;yaw=yawT=0;for(const an of [0,.8,-.8,1.4,-1.4,2.4,-2.4,Math.PI]){const cx=pos.x+Math.sin(an)*11,cz=pos.z+Math.cos(an)*11;if(walkable(cx,cz)&&!TALL.some(c=>Math.hypot(cx-c[0],cz-c[1])<c[2]+1)){yaw=yawT=an;break}}camera.position.set(pos.x+Math.sin(yaw)*12,7,pos.z+Math.cos(yaw)*12);say(o.door?'Đã đến trước '+o.name+'. Chạm nút phía trên cửa để vào.':'Đã đến '+o.name+'.')}
let guideL=[];
function openPlaces(){const list=guideL=guideList();placesEl.innerHTML='<div class="places-head"><h2>Bản đồ Thị trấn Mây</h2><button class="x">Đóng</button></div><div class="places-scroll"><p>Chạm vào một số trên bản đồ, hoặc một dòng bên dưới, để đến nơi đó.</p><canvas class="gmap" width="1196" height="736" aria-label="Bản đồ thị trấn"></canvas><p class="key"><span class="here"></span>Bạn đang ở đây</p></div>';const scroll=placesEl.querySelector('.places-scroll');drawGuide(scroll.querySelector('.gmap'),list);
  ZONES.forEach((zn,zi)=>{const h=document.createElement('h3');h.textContent=zn[0];h.style.color=zn[1];scroll.appendChild(h);for(const o of list){if(o.zn!==zi)continue;const b=document.createElement('button');b.className='row';b.dataset.n=o.n;b.innerHTML='<em></em><div><b></b><span></span></div>'+'';b.querySelector('em').textContent=o.n;b.querySelector('em').style.background=zn[1];b.querySelector('b').textContent=o.name;b.querySelector('span').textContent=(o.id&&o.id!=='chuamay'?'Chỉ tham quan bên ngoài.':o.desc);scroll.appendChild(b)}});
  const fb=document.createElement('button');fb.className='row';fb.dataset.fps='1';fb.innerHTML='<div><b>Đo tốc độ khung hình</b><span>Hiện số khung hình mỗi giây ở góc dưới bên trái (để kiểm tra máy)</span></div>';scroll.appendChild(fb);placesEl.hidden=false;placesEl.scrollTop=0}
placesBtn.addEventListener('pointerdown',e=>e.stopPropagation());placesBtn.addEventListener('click',e=>{e.stopPropagation();openPlaces()});
placesEl.addEventListener('pointerdown',e=>e.stopPropagation());placesEl.addEventListener('pointerup',e=>e.stopPropagation());placesEl.addEventListener('click',e=>{e.stopPropagation();const x=e.target.closest('.x'),r=e.target.closest('.row'),cv=e.target.closest('.gmap');if(x){placesEl.hidden=true;return}if(cv){const b=cv.getBoundingClientRect(),f=cv.width/b.width,px=(e.clientX-b.left)*f,py=(e.clientY-b.top)*f;let best=null,bd=46;for(const p of guidePins){const d=Math.hypot(p.x-px,p.y-py);if(d<bd){bd=d;best=p}}if(best)goPlace(best.o);return}if(!r)return;if(r.dataset.fps){fpsBox.hidden=!fpsBox.hidden;placesEl.hidden=true;return}const o=guideL.find(q=>q.n==r.dataset.n);if(o)goPlace(o)});
const fpsBox=document.createElement('div');fpsBox.id='fpsbox';fpsBox.hidden=location.hash!=='#fps';stage.appendChild(fpsBox);let fpsN=0,fpsT=0,fpsWorst=0,fpsHist=[];
const monitor=createFrameMonitor(onLowPerformance);
let last=performance.now(),walkPh=0,raf=0;
function visibility(){monitor.reset();last=performance.now();}
document.addEventListener('visibilitychange',visibility);
function frame(now){try{frameInner(now)}catch(e){cancelAnimationFrame(raf);onFailure();return}raf=requestAnimationFrame(frame)}
function frameInner(now){const elapsed=now-last,dt=Math.min(.1,elapsed/1000);last=now;
if(document.hidden)monitor.reset();else monitor.frame(now);
const period=periodNow();if(period!==tod)setTime(period,true);
  tmp.copy(dest).sub(pos);tmp.y=0;const dist=tmp.length();let moving=false;
  if(dist>.04&&state!=='ritual'){moving=true;const step=Math.min(dist,(W===TOWN?6.2:3.1)*dt);tmp.normalize();const nx=pos.x+tmp.x*step,nz=pos.z+tmp.z*step;if(walkable(nx,nz,-.06)){pos.x=nx;pos.z=nz;wantY=Math.atan2(tmp.x,tmp.z)}else{const again=plan(pos.x,pos.z,path.length?path[path.length-1].x:dest.x,path.length?path[path.length-1].z:dest.z);if(again.length&&!blockedOnce){blockedOnce=true;path=again.map(q=>new THREE.Vector3(q[0],0,q[1]));dest.copy(path.shift())}else{path=[];dest.copy(pos);moving=false}}}
  else if(path.length&&state!=='ritual'){dest.copy(path.shift())}
  else if(state==='going'&&pending){const sp=SPOT[pending];if(Math.hypot(pos.x-sp.x,pos.z-sp.z)<.35){begin(pending)}else{state='free';pending=null;say('Không qua được lối này, thử đi lối khác.')}}
  pos.y=floorY(pos.z,pos.x);
  let dy=wantY-faceY;dy=Math.atan2(Math.sin(dy),Math.cos(dy));faceY+=dy*Math.min(1,dt*9);
  me.position.copy(pos);me.rotation.y=faceY;blob.position.set(pos.x,pos.y+.02,pos.z);
  marker.material.opacity=Math.max(0,marker.material.opacity-dt*(moving?.5:3));
const kneel=0,bow=0,pray=0,sit=0,moSwing=0,ritual=null;walkPh+=moving?dt*8.5:0;
const wk=moving?1:0,sL=Math.sin(walkPh)*wk,sR=-sL;
  const bN=Math.min(1,bow/1.15),moA=state==='ritual'&&ritual==='mo'?1:0;
  hip.position.y=HIP-kneel*.27-sit*.38+wk*Math.abs(Math.cos(walkPh))*.022;
  LL.th.rotation.x=sL*.6-sit*1.5;LR.th.rotation.x=sR*.6-sit*1.5;LL.th.rotation.z=-sit*.5;LR.th.rotation.z=sit*.5;
  LL.kn.rotation.x=wk*Math.max(0,Math.sin(walkPh+1.3))*.75+kneel*1.55+sit*2.0;LR.kn.rotation.x=wk*Math.max(0,Math.sin(walkPh+1.3+Math.PI))*.75+kneel*1.55+sit*2.0;
  torso.rotation.x=bow+wk*.05;headG.rotation.x=-bN*.25+sit*.12+pray*(1-bN)*.1;
  const uX=-sit*.5-pray*.95,fX=-.12-wk*.12-sit*.75-pray*1.3,uZ=pray*.42+sit*.28;
  AL.up.rotation.x=-sL*.5+uX*(1-bN)-2.35*bN;AR.up.rotation.x=-sR*.5+(uX*(1-bN)-2.35*bN)*(1-moA)-moA*.8;
  AL.el.rotation.x=fX*(1-bN)-.15*bN;AR.el.rotation.x=(fX*(1-bN)-.15*bN)*(1-moA)-moA*(.75+moSwing*.6);
  AL.up.rotation.z=uZ*(1-bN);AR.up.rotation.z=-uZ*(1-bN)*(1-moA);
for(const m of mists){m.position.x+=m.userData.v*dt;if(m.position.x>110)m.position.x=-110}fallT2.offset.y+=dt*1.2;
yaw+=(yawT-yaw)*Math.min(1,dt*14);tPitch+=(tPitchT-tPitch)*Math.min(1,dt*14);tDist+=(tDistT-tDist)*Math.min(1,dt*10);wide=camera.aspect>1.2?1:0;
  if(W===TOWN){const cp=Math.cos(tPitch),hy=pos.y+1.2;let d=tDist*(1+wide*.15);const ux=Math.sin(yaw)*cp,uy=Math.sin(tPitch),uz=Math.cos(yaw)*cp;
    for(const c of TALL){const rr=c[2]+.8,ox=pos.x-c[0],oz=pos.z-c[1],A=ux*ux+uz*uz,B=2*(ox*ux+oz*uz),C=ox*ox+oz*oz-rr*rr,D=B*B-4*A*C;if(D<=0||A<1e-6)continue;const q=Math.sqrt(D),t0=(-B-q)/(2*A),t1=(-B+q)/(2*A);if(t1<0||t0>d)continue;if(d>t0&&d<t1&&hy+uy*d<c[3]+.6)d=Math.max(3.2,t0-.3)}
    camPos.set(pos.x+ux*d,hy+uy*d,pos.z+uz*d);camLook.set(pos.x,hy,pos.z)}
camera.position.lerp(camPos,Math.min(1,dt*9));lookNow.lerp(camLook,Math.min(1,dt*12));camera.lookAt(lookNow);
  const w=stage.clientWidth,h=stage.clientHeight;
  for(const k in SPOT){const s=SPOT[k];v3.copy(s.anchor).project(camera);const d=Math.hypot(pos.x-s.x,pos.z-s.z);
    if(W===TOWN&&v3.z<1){v3.x=THREE.MathUtils.clamp(v3.x,-.45,.45);v3.y=THREE.MathUtils.clamp(v3.y,-.5,.62)}
    const vis=state!=='ritual'&&v3.z<1&&Math.abs(v3.x)<.92&&v3.y<.8&&v3.y>-.62&&d<(W===TOWN?20:15)&&W.vis(k);
    s.el.hidden=!vis;if(vis)s.el.style.transform=`translate(-50%,-100%) translate(${(v3.x*.5+.5)*w}px,${(-v3.y*.5+.5)*h}px)`}
mini.hidden=false;placesBtn.hidden=false;footRing.visible=true;footRing.position.set(pos.x,pos.y+.04,pos.z);if((miniT+=dt)>.08){miniT=0;drawMini()}
renderer.render(scene,camera);
if(!fpsBox.hidden){fpsN++;fpsT+=elapsed/1000;if(fpsT>=1){fpsBox.textContent='FPS '+Math.round(fpsN/fpsT);fpsN=0;fpsT=0;}}
}
setTime(periodNow(),true);
if(restore&&walkable(restore.x,restore.z)){pos.set(restore.x,0,restore.z);dest.copy(pos);yaw=yawT=restore.yaw;tPitch=tPitchT=restore.pitch;tDist=tDistT=restore.distance;}
pos.y=floorY(pos.z,pos.x);camera.position.set(pos.x+Math.sin(yaw)*tDist,pos.y+7,pos.z+Math.cos(yaw)*tDist);lookNow.set(pos.x,pos.y+1.2,pos.z);camera.lookAt(lookNow);
say(TOWN.hello);frameInner(performance.now());raf=requestAnimationFrame(frame);
// Diagnostic seam for deterministic author and independent acceptance tests; no globals or fake users.
return {position:()=>({x:pos.x,z:pos.z}),walkTo,walkable,plan,gate:{x:SPOT.go_chuamay.x,z:SPOT.go_chuamay.z},project:(x,z)=>{const p=new THREE.Vector3(x,floorY(z,x),z).project(camera);return {x:(p.x+1)*stage.clientWidth/2,y:(1-p.y)*stage.clientHeight/2}},dispose:()=>{cancelAnimationFrame(raf);observer.disconnect();clearTimeout(sayT);document.removeEventListener('visibilitychange',visibility);renderer.dispose();}};
}
