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
let current=null, pose='idle', clock=0, incense=new THREE.Group();
for(let i=-1;i<=1;i++){const stick=new THREE.Mesh(new THREE.CylinderGeometry(.018,.018,.45,8),new THREE.MeshStandardMaterial({color:0x7b4b2a}));stick.position.x=i*.045;stick.position.y=.18;incense.add(stick);} incense.visible=false; scene.add(incense);
const loader=new GLTFLoader();
loader.register(parser=>new VRMLoaderPlugin(parser));
function bone(name){return current?.humanoid?.getNormalizedBoneNode(name)}
function setPose(next){ pose=next; incense.visible=next==='incense'; document.querySelectorAll('[data-pose]').forEach(b=>b.classList.toggle('active',b.dataset.pose===pose)); readout.textContent=current?`已加载 VRM：${document.querySelector('#model').value}\nMToon：由 VRM 模型材质提供\n当前动作：${pose}`:`等待模型文件\n动作数据：poses.json\n当前姿势：${pose}\n模型来源：不内置示例角色；仅加载 ?model= 指定的本地/同源 .vrm`; }
function loadModel(url){ if(!url){setPose('idle');return;} loader.load(url,gltf=>{ if(current){VRMUtils.deepDispose(current.scene);scene.remove(current.scene);} current=gltf.userData.vrm; scene.add(current.scene); current.scene.rotation.y=Math.PI; setPose('idle'); },undefined,e=>{readout.textContent=`模型加载失败：${e.message}\n等待模型文件；请用 ?model=路径 指定 .vrm`;}); }
document.querySelector('#load').onclick=()=>loadModel(document.querySelector('#model').value.trim());
document.querySelectorAll('[data-pose]').forEach(b=>b.onclick=()=>setPose(b.dataset.pose));
const q=new URLSearchParams(location.search).get('model')||'assets/visitor-01.vrm'; document.querySelector('#model').value=q; loadModel(q);
function resize(){renderer.setSize(canvas.clientWidth,canvas.clientHeight,false);camera.aspect=canvas.clientWidth/canvas.clientHeight;camera.updateProjectionMatrix();} addEventListener('resize',resize); resize();
function frame(now){clock=now/1000;if(current){current.scene.position.y=-.9;const hips=bone('hips'), chest=bone('chest'), lUpper=bone('leftUpperArm'), rUpper=bone('rightUpperArm'), lLower=bone('leftLowerArm'), rLower=bone('rightLowerArm'), lThigh=bone('leftUpperLeg'), rThigh=bone('rightUpperLeg'), lShin=bone('leftLowerLeg'), rShin=bone('rightLowerLeg'); if(hips)hips.rotation.set(0,0,0); [chest,lUpper,rUpper,lLower,rLower,lThigh,rThigh,lShin,rShin].forEach(b=>b&&b.rotation.set(0,0,0)); if(pose==='idle'&&chest)chest.rotation.z=Math.sin(clock*2)*.02; if(pose==='walk'&&hips)hips.rotation.y=Math.sin(clock*8)*.04; if(pose==='palms'||pose==='incense'){if(lUpper)lUpper.rotation.z=-.75;if(rUpper)rUpper.rotation.z=.75;if(lLower)lLower.rotation.z=-1.0;if(rLower)rLower.rotation.z=1.0;} if(pose==='kneel'){if(lThigh)lThigh.rotation.x=1.1;if(rThigh)rThigh.rotation.x=1.1;if(lShin)lShin.rotation.x=-1.3;if(rShin)rShin.rotation.x=-1.3;} if(pose==='sit'){if(lThigh)lThigh.rotation.x=1.35;if(rThigh)rThigh.rotation.x=1.35;if(lShin)lShin.rotation.x=-1.45;if(rShin)rShin.rotation.x=-1.45;} current.update(clock*0.016); }renderer.render(scene,camera);requestAnimationFrame(frame);} requestAnimationFrame(frame);
