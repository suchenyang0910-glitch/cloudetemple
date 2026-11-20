/* Input: THREE. Output: lawn world, six tree islands, four southeast courts and blank slots. North is +z. */
import {createShell} from './common.js';
export function buildLawnScene(T){
 const w=createShell(T,{id:'lawn',title:'Vườn cỏ nắng',hello:'Chạm đất để đi · Kéo để xoay · WASD',groundColor:0xa6be87,particleColor:0xf7c9d5,particleKind:'petal'}),{box,cyl,tree,bush,flower,rock,plaque,fence,path,materials:m}=w;
 w.terrain((x,z)=>.012*x+.09*Math.sin(z*.22));w.start.set(-18,w.floorY(-18,18),18);
 for(const x of [-20,-14])box(.3,3.2,.3,m.woodM,x,1.6,17);box(6.5,.45,.36,m.woodM,-17,3.1,17);
 const paw=new T.MeshLambertMaterial({color:0xf1d8af});w.add(new T.CircleGeometry(.3,12),paw,-17,3.1+w.floorY(-17,17),17.2);for(let i=0;i<4;i++)w.add(new T.CircleGeometry(.12,8),paw,-17.4+i*.27,3.42+w.floorY(-17,17),17.21);
 const water=w.add(new T.CircleGeometry(3.5,48),m.waterM,0,.2,0,-Math.PI/2);w.blockers.push({x:0,z:0,r:3.85});
 for(let i=0;i<24;i++){const a=i*Math.PI/12;rock(Math.cos(a)*3.8,Math.sin(a)*3.8,.28)}
 const sparkle=new T.MeshBasicMaterial({color:0xffeed0,transparent:true,opacity:.7});for(let i=0;i<18;i++)w.add(new T.CircleGeometry(.035+(i%3)*.02,4),sparkle,Math.sin(i*4.2)*3,.215,Math.cos(i*2.7)*2.8,-Math.PI/2);
 const clusters=[[-13,10],[-13,-3],[-12,-15],[0,13],[13,11],[13,-2]],courts=[[9,-10.5],[16,-10.5],[9,-17],[16,-17]];
 const islandM=new T.MeshLambertMaterial({color:0x809e63}),blooms=[0xef91ad,0xf5d46d,0xfff4de].map(color=>new T.MeshLambertMaterial({color,side:T.DoubleSide}));
 const blossom=(x,z,size,i)=>{const q=flower(x,z,size);q.material=blooms[i%blooms.length];q.rotation.x=-1.15;return q};
 // A terrain-following grass patch and a denser border make each island readable without fences.
 clusters.forEach(([x,z],ci)=>{
   const bed=new T.CircleGeometry(4.6,48);bed.rotateX(-Math.PI/2);const p=bed.attributes.position;
   for(let i=0;i<p.count;i++)p.setY(i,w.floorY(x+p.getX(i),z+p.getZ(i))+.025);
   bed.computeVertexNormals();w.add(bed,islandM,x,0,z);tree(x,z,1.05+ci%2*.1);
   for(let i=0;i<5;i++){const a=i/5*Math.PI*2+.22,px=x+Math.cos(a)*3.4,pz=z+Math.sin(a)*3.4;plaque(px,pz,Math.atan2(-px,-pz),'lawn-'+ci)}
   for(let i=0;i<24;i++){const a=i*Math.PI/12;bush(x+Math.cos(a)*4.3,z+Math.sin(a)*4.3,.38)}
   for(let i=0;i<48;i++){const a=i*Math.PI/24;blossom(x+Math.cos(a)*4.65,z+Math.sin(a)*4.65,.18,i+ci)}
 });
 // Keep the promenade out of the islands and the southeast courts.
 const ring=[];for(let i=0;i<=32;i++){const a=i/32*Math.PI*2;ring.push([7.1*Math.cos(a),7.1*Math.sin(a)])}path(ring,1.8);
 path([[-18,18],[-18,16],[-8,17],[-6,10],[-5,5]],1.4);
 path([[5,-5],[5,-8],[5,-13.7],[12.5,-13.7],[12.5,-18]],1.2);
 courts.forEach(([x,z],i)=>{
   // Five-metre courts, two low rails, and one 1.8-metre opening on the north side.
   const sides=[[x-2.5,z,.12,5],[x+2.5,z,.12,5],[x,z-2.5,5,.12],[x-1.7,z+2.5,1.6,.12],[x+1.7,z+2.5,1.6,.12]];
   for(const [cx,cz,bw,bd] of sides){for(const h of [.28,.62])box(bw,.1,bd,m.woodM,cx,h,cz);w.blockers.push({x:cx,z:cz,w:bw/2+.3,d:bd/2+.3})}
   const posts=[[-2.5,-2.5],[2.5,-2.5],[-2.5,2.5],[2.5,2.5],[-.9,2.5],[.9,2.5],[-2.5,0],[2.5,0],[0,-2.5]];
   for(const [dx,dz] of posts)box(.14,.78,.14,m.woodM,x+dx,.39,z+dz);
   plaque(x,z,Math.atan2(-x,-z),'lawn-private-'+i,true);bush(x+1.3,z-1.3,.5);
   for(let j=0;j<6;j++)blossom(x-1.25+Math.cos(j)*.35,z-1.3+Math.sin(j)*.35,.2,j);
 });
 box(3,.2,.7,m.woodM,-17,.55,-8);box(3,.6,.15,m.woodM,-17,.95,-8.3);for(const x of [-18.1,-15.9])box(.15,.6,.5,m.woodM,x,.3,-8);
 for(let i=0;i<220;i++){const x=Math.sin(i*3.7)*19,z=Math.cos(i*4.1)*19;
   if(clusters.some(([cx,cz])=>Math.hypot(x-cx,z-cz)<5.5)||courts.some(([cx,cz])=>Math.abs(x-cx)<3.2&&Math.abs(z-cz)<3.2)||Math.hypot(x,z)<8.2)continue;
   blossom(x,z,.2+(i%3)*.025,i);
 }
 const wingShape=new T.Shape();wingShape.moveTo(0,.02);wingShape.bezierCurveTo(.12,.38,.48,.24,.24,-.02);wingShape.bezierCurveTo(.4,-.3,.08,-.32,0,-.08);wingShape.closePath();
 const wingGeo=new T.ShapeGeometry(wingShape,6),wingM=new T.MeshBasicMaterial({color:0xf7c06a,side:T.DoubleSide}),bodyM=new T.MeshBasicMaterial({color:0x685038}),butterflies=[];
 for(let i=0;i<4;i++){const b=new T.Group();b.name='lawn-butterfly-'+i;b.userData.keep=true;b.scale.setScalar(.5);
   for(const side of [-1,1]){const wing=new T.Mesh(wingGeo,wingM);wing.scale.x=side;wing.rotation.y=side*.5;b.add(wing)}
   b.add(new T.Mesh(new T.BoxGeometry(.035,.3,.035),bodyM));b.position.set(-4.8+i*3.2,1.5,5.8);w.g.add(b);butterflies.push(b);
 }
 w.particles(112);const petals=w.g.children.find(o=>o.isPoints);petals.name='lawn-petals';
 const sprite=document.createElement('canvas');sprite.width=sprite.height=32;const pc=sprite.getContext('2d');pc.fillStyle='#fff';pc.beginPath();pc.ellipse(16,16,7,13,-.5,0,Math.PI*2);pc.fill();
 petals.material.map.dispose();petals.material.map=new T.CanvasTexture(sprite);petals.material.size=.24;petals.material.opacity=.9;
 const pp=petals.geometry.attributes.position,colors=petals.geometry.attributes.color,pink=new T.Color(0xf3b1cb);
 for(let i=0;i<32;i++){pp.setXYZ(i,Math.sin(i*2.4)*5,1.2+(i%9)*.3,4+Math.cos(i*1.7)*3);colors.setXYZ(i,pink.r,pink.g,pink.b)}
 pp.needsUpdate=true;colors.needsUpdate=true;w.finalize();const tick=w.tick;let t=0;
 w.tick=dt=>{tick(dt);t+=dt;butterflies.forEach((b,i)=>{b.position.y=1.5+Math.sin(t*.6+i)*.2;b.position.z=5.8+Math.sin(t*.3+i)*.6;b.children.slice(0,2).forEach((wing,j)=>wing.rotation.y=(j?1:-1)*(.5+.35*Math.sin(t*5+i)))})};
 w.spots={entry:[-18,18,0,0,5],cluster:[-2,13,0,0,10],private:[12,-6,0,0,7],overview:[0,0,0,.9,35],overviewEye:[0,19,0,0,8],top:[0,0,0,Math.PI/2,37]};return w;
}
