import * as THREE from './vendor/three.module.min.js';
import { VRMLoaderPlugin } from './vendor/three-vrm.module.js?v=2';
import { GLTFLoader } from './vendor/GLTFLoader.js?v=2';
import { POSES, walkPose, applyPose } from './visitor-poses.js';
const canvas=document.querySelector('#view');const renderer=new THREE.WebGLRenderer({canvas,antialias:true,preserveDrawingBuffer:true});renderer.outputColorSpace=THREE.SRGBColorSpace;
const scene=new THREE.Scene();scene.background=new THREE.Color(0xd7d0c2);scene.add(new THREE.HemisphereLight(0xfff2d8,0x596357,2.2));const l=new THREE.DirectionalLight(0xffead4,2);l.position.set(2,6,4);scene.add(l);
const floor=new THREE.Mesh(new THREE.PlaneGeometry(6,6),new THREE.MeshBasicMaterial({color:0xb9ae9b}));floor.rotation.x=-Math.PI/2;scene.add(floor);
const camera=new THREE.PerspectiveCamera(30,1,.1,30);
const incense=new THREE.Group();for(let i=-1;i<=1;i++){const s=new THREE.Mesh(new THREE.CylinderGeometry(.006,.006,.34,6),new THREE.MeshBasicMaterial({color:0x8a4a2c}));s.position.set(i*.018,.17,0);incense.add(s);const tip=new THREE.Mesh(new THREE.SphereGeometry(.009,6,6),new THREE.MeshBasicMaterial({color:0xd9622b}));tip.position.set(i*.018,.345,0);incense.add(tip);}incense.visible=false;scene.add(incense);
function size(){renderer.setSize(innerWidth,innerHeight,false);camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();}size();
let vrm;window.setView=(name)=>{const a={front:0,q:Math.PI/4,side:Math.PI/2,rear:Math.PI}[name]??0;const d=4.6;camera.position.set(Math.sin(a)*d,1.0,Math.cos(a)*d);camera.lookAt(0,.8,0);};
window.setPose=(name,t=0)=>{const p=name==='walk'?walkPose(t):POSES[name];applyPose(THREE,vrm,p);incense.visible=!!p.incense;if(p.incense){const a=new THREE.Vector3(),b=new THREE.Vector3();vrm.humanoid.getNormalizedBoneNode('leftHand').getWorldPosition(a);vrm.humanoid.getNormalizedBoneNode('rightHand').getWorldPosition(b);incense.position.copy(a.add(b).multiplyScalar(.5));incense.position.y+=.02;}
  const P=n=>vrm.humanoid.getNormalizedBoneNode(n).getWorldPosition(new THREE.Vector3());const L=P('leftHand'),R=P('rightHand'),H=P('hips'),HD=P('head');
  renderer.render(scene,camera);return {hands:+L.distanceTo(R).toFixed(3),handY:+((L.y+R.y)/2).toFixed(3),handZ:+((L.z+R.z)/2).toFixed(3),hipsY:+H.y.toFixed(3),headY:+HD.y.toFixed(3),headZ:+HD.z.toFixed(3)};};
const loader=new GLTFLoader();loader.register(p=>new VRMLoaderPlugin(p));
loader.load('./assets/visitor-ponytail-medium.vrm',g=>{vrm=g.userData.vrm;scene.add(vrm.scene);vrm.scene.traverse(o=>o.frustumCulled=false);setView('front');window.ready=true;window.info={meta:vrm.meta?.metaVersion};setPose('stand');},undefined,e=>{window.err=String(e)});

const poseMap={idle:'stand',walk:'walk',palms:'palms',incense:'incense',kneel:'kneel',sit:'sit'}; const rawSetPose=window.setPose; window.setPose=(name,t=0)=>rawSetPose(poseMap[name]||name,t); for (const b of document.querySelectorAll('[data-pose]')) b.onclick=()=>window.ready&&window.setPose(b.dataset.pose); document.querySelector('#front').onclick=()=>window.setView('front'); document.querySelector('#side').onclick=()=>window.setView('side'); document.querySelector('#rear').onclick=()=>window.setView('rear');
