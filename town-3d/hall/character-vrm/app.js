import * as THREE from './vendor/three.module.min.js';
import { VRMLoaderPlugin, VRMUtils } from './vendor/three-vrm.module.js?v=2';
import { GLTFLoader } from './vendor/GLTFLoader.js?v=2';
const canvas=document.querySelector('#view');
const readout=document.querySelector('#readout');
const renderer=new THREE.WebGLRenderer({canvas,antialias:true});
renderer.outputColorSpace=THREE.SRGBColorSpace;
const scene=new THREE.Scene(); scene.background=new THREE.Color(0xd7d0c2);
scene.add(new THREE.HemisphereLight(0xfff2d8,0x596357,2.2));
const light=new THREE.DirectionalLight(0xffead4,2); light.position.set(-3,6,4); scene.add(light);
const camera=new THREE.PerspectiveCamera(35,1,.1,30); camera.position.set(0,1.4,5); camera.lookAt(0,1.2,0);
let current=null, pose='idle', clock=0;
const loader=new GLTFLoader();
loader.register(parser=>new VRMLoaderPlugin(parser));
function setPose(next){ pose=next; document.querySelectorAll('[data-pose]').forEach(b=>b.classList.toggle('active',b.dataset.pose===pose)); readout.textContent=`等待模型文件\n动作数据：poses.json\n当前姿势：${pose}\n模型来源：不内置示例角色；仅加载 ?model= 指定的本地/同源 .vrm`; }
function loadModel(url){ if(!url){setPose('idle');return;} loader.load(url,gltf=>{ if(current){VRMUtils.deepDispose(current.scene);scene.remove(current.scene);} current=gltf.userData.vrm; scene.add(current.scene); current.scene.rotation.y=Math.PI; setPose('idle'); readout.textContent=`已加载 VRM：${url}\nMToon：由 VRM 模型材质提供\n动作：代码姿势准备就绪（未捏人、未内置示例角色）`; },undefined,e=>{readout.textContent=`模型加载失败：${e.message}\n等待模型文件；请用 ?model=路径 指定 .vrm`;}); }
document.querySelector('#load').onclick=()=>loadModel(document.querySelector('#model').value.trim());
document.querySelectorAll('[data-pose]').forEach(b=>b.onclick=()=>setPose(b.dataset.pose));
const q=new URLSearchParams(location.search).get('model'); if(q){document.querySelector('#model').value=q;loadModel(q);}else setPose('idle');
function resize(){renderer.setSize(canvas.clientWidth,canvas.clientHeight,false);camera.aspect=canvas.clientWidth/canvas.clientHeight;camera.updateProjectionMatrix();} addEventListener('resize',resize); resize();
function frame(now){clock=now/1000;if(current){current.scene.position.y=-.9;const hips=current.humanoid?.getNormalizedBoneNode('hips');if(hips&&pose==='idle')hips.rotation.z=Math.sin(clock*2)*.02;if(hips&&pose==='walk')hips.rotation.y=Math.sin(clock*8)*.04;}renderer.render(scene,camera);requestAnimationFrame(frame);} requestAnimationFrame(frame);
