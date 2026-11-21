/* Input: THREE. Output: valley world with moss, drifting mist, tree cover and private fern clearings. */
import {createShell} from './common.js';
export function buildForestScene(T){
 const w=createShell(T,{id:'forest',title:'Vườn rừng sương',hello:'Chạm đất để đi · Kéo để xoay',groundColor:0x91a17d,particleColor:0xc9ead0,particleKind:'firefly'}),{box,tree,bush,flower,rock,fern,plaque,path,materials:m}=w;
 w.terrain((x,z)=>-.65*Math.exp(-(x*x+z*z)/100)+.24*Math.sin(x*.23)*Math.cos(z*.19));w.start.set(-18,w.floorY(-18,18),18);
 for(const x of [-20,-15])box(.25,2.7,.25,m.woodM,x,1.35,17);box(5.6,.3,.3,m.woodM,-17.5,2.6,17);
 const trail=[[-18,18],[-12,14],[-9,8],[-13,1],[-8,-8],[0,-12],[10,-8],[14,0],[9,8],[1,12],[-12,14]];path(trail,1.7);
 [[-10,-8],[-12,3],[-6,10],[5,8],[12,-3]].forEach(([x,z],ci)=>{for(const dx of [-4,0,4]){plaque(x+dx,z+(dx===0?.9:0),Math.PI,'forest-'+ci);fern(x+dx+.7,z+.6);flower(x+dx-.7,z-.6,.13)}});
 [[-15,12],[-5,-15],[14,12],[14,-13]].forEach(([x,z],i)=>{plaque(x,z,0,'forest-private-'+i,true);for(let j=0;j<9;j++){const a=Math.PI*.15+j*Math.PI*1.7/8;bush(x+Math.sin(a)*2.6,z-Math.cos(a)*2.6,.6);fern(x+Math.sin(a)*2.2,z-Math.cos(a)*2.2,.75)}});
 w.blockers.push({x:-13.819624700677178,z:9.683383037110243,r:.9});
 w.blockers.push({x:-3.819624700677178,z:-17.316616962889757,r:.75});
 const distance=(x,z,a,b)=>{const dx=b[0]-a[0],dz=b[1]-a[1],t=Math.max(0,Math.min(1,((x-a[0])*dx+(z-a[1])*dz)/(dx*dx+dz*dz)));return Math.hypot(x-a[0]-t*dx,z-a[1]-t*dz)};
 for(let i=0;i<700&&w.trees.length<58;i++){const x=Math.sin(i*2.399)*19,z=Math.cos(i*1.733)*19;if(Math.hypot(x+16,z-17)<16||Math.hypot(x+18,z-18)<3||w.memorialSlots.some(s=>Math.hypot(s.x-x,s.z-z)<2.1)||w.trees.some(t=>Math.hypot(t.x-x,z-t.z)<2.4)||trail.slice(1).some((b,j)=>distance(x,z,trail[j],b)<1.3)||Math.hypot(x,z)<3)continue;tree(x,z,.85+(i%7)*.16);if(i%2)fern(x+.7,z+.5,.7)}
 for(let i=0;i<90;i++){fern(Math.sin(i*2.1)*19,Math.cos(i*1.8)*19,.3);flower(Math.sin(i*2.3)*18,Math.cos(i*1.7)*18,.08)}
 box(3,.2,.7,m.woodM,0,.55,2);box(3,.5,.15,m.woodM,0,.9,2.3);for(let i=0;i<9;i++)rock(Math.cos(i)*2,Math.sin(i)*2,.25);
 const light=new T.MeshBasicMaterial({color:0xe6e7b2,transparent:true,opacity:.18,depthWrite:false});for(let i=0;i<18;i++){const x=Math.sin(i*4.1)*15,z=Math.cos(i*2.9)*15;w.add(new T.CircleGeometry(.4+(i%3)*.3,12),light,x,w.floorY(x,z)+.018,z,-Math.PI/2)}
 const n=128,d=new Uint8Array(n*n*4);for(let y=0;y<n;y++)for(let x=0;x<n;x++){const r=Math.hypot(x-63.5,y-63.5)/64,a=.25*Math.max(0,1-r);const i=(y*n+x)*4;d[i]=211;d[i+1]=222;d[i+2]=211;d[i+3]=Math.round(a*255)}const fogT=new T.DataTexture(d,n,n,T.RGBAFormat);fogT.colorSpace=T.SRGBColorSpace;fogT.needsUpdate=true;const fogM=new T.MeshBasicMaterial({map:fogT,transparent:true,depthWrite:false,side:T.DoubleSide}),mist=[];for(let i=0;i<3;i++){const q=w.add(new T.PlaneGeometry(22,3),fogM,-7+i*7,.8,-6+i*7);q.userData.keep=true;mist.push(q)}
 w.particles(126);w.finalize();const tick=w.tick;let t=0;w.tick=dt=>{tick(dt);t+=dt;mist.forEach((q,i)=>q.position.x=-7+i*7+Math.sin(t*.13+i)*1.2)};
 w.spots={entry:[-18,18,0,0,5],cluster:[-7,14,0,0,5],private:[-4,-14.2,4.3197,.85,10],overview:[0,0,0,.9,35],overviewEye:[2,0,Math.PI,0,10],top:[0,0,0,Math.PI/2,37]};return w;
}
