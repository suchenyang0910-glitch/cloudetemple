import * as THREE from '../../prototype-3d/vendor/three.module.min.js';
import { mountPetGarden } from './index.js';

const canvas = document.querySelector('#scene');
const detail = document.querySelector('#detail');
const actions = document.querySelector('.actions');
const fpsEl = document.querySelector('#fps');
const claimEntry = document.querySelector('#claim-entry');
const claimOpen = document.querySelector('#claim-open');
const claimDetail = document.querySelector('#claim-detail');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
const scene = new THREE.Scene(); scene.background = new THREE.Color(0x7d9475); scene.fog = new THREE.Fog(0x7d9475, 16, 48);
const camera = new THREE.PerspectiveCamera(55, 1, .1, 100); camera.position.set(10, 8, 13);
const visitor = new THREE.Object3D(); visitor.position.set(0, 0, 11); scene.add(visitor);
scene.add(new THREE.HemisphereLight(0xf4f0db, 0x405444, 2.4)); const sun = new THREE.DirectionalLight(0xffe1b8, 1.8); sun.position.set(-8, 15, 8); scene.add(sun);
const raycaster = new THREE.Raycaster(), pointer = new THREE.Vector2(), ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), hit = new THREE.Vector3();
let garden, target, nearby, dragX, previousFrame, frameCount = 0, fpsSince = performance.now(), dragging = false;
let emptyGarden = false;
const sampleMode = new URLSearchParams(location.search).get('sample') === '1';
document.querySelector('#sample-label').hidden = !sampleMode;

if (new URLSearchParams(location.search).get('fps') === '1') fpsEl.hidden = false;

function resize() { renderer.setSize(innerWidth, innerHeight, false); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); }
const speciesLabels = { cat: 'Mèo', dog: 'Chó', rabbit: 'Thỏ', bird: 'Chim', hamster: 'Chuột hamster' };
function showDetail(memorial) { nearby = memorial; if (emptyGarden && !memorial) { detail.hidden = false; actions.hidden = true; detail.textContent = 'Chưa có bia tưởng niệm.'; return; } detail.hidden = !memorial; actions.hidden = !memorial; if (memorial) { const title=document.createElement('strong'), meta=document.createElement('small'); title.textContent=`${memorial.petName} · ${speciesLabels[memorial.speciesCode] || 'Thú cưng'}`; meta.textContent=`${memorial.bornYear}–${memorial.diedYear} · ${memorial.districtId} / Hàng ${memorial.rowNo}, Cột ${memorial.columnNo}`; detail.replaceChildren(title,document.createElement('br'),meta,document.createElement('br'),document.createTextNode(memorial.epitaph)); } }
function showClaim(claim) { claimEntry.hidden = !claim; if (!claim) return; claimOpen.addEventListener('click', () => { claimDetail.hidden = !claimDetail.hidden; }); claimDetail.replaceChildren(document.createTextNode('Trước khi đổi trình duyệt hoặc xóa dữ liệu trình duyệt, hãy lưu mã này hoặc liên kết bia trong Telegram.'), document.createElement('br'), document.createTextNode(`Bia: ${claim.memorialId}`), document.createElement('br'), document.createTextNode(`Mã: ${claim.claimCode}`), document.createElement('br')); const copy = document.createElement('button'); copy.textContent = 'Sao chép mã'; copy.addEventListener('click', async () => { try { await navigator.clipboard.writeText(claim.claimCode); copy.textContent = 'Đã sao chép'; } catch { copy.textContent = 'Không thể sao chép'; } }); claimDetail.append(copy); }
async function loadClaim() { if (sampleMode) return { memorialId: 'sample-cat', claimCode: 'SAMPLE-MIMI-2025' }; try { const response = await fetch('/api/pet-garden/me/claim', { headers: { accept: 'application/json' } }); if (!response.ok) return null; const data = await response.json(); const claim = data.claim || data; return typeof claim.memorialId === 'string' && typeof claim.claimCode === 'string' ? claim : null; } catch { return null; } }
function point(event) { const r = canvas.getBoundingClientRect(); pointer.set((event.clientX-r.left)/r.width*2-1,-(event.clientY-r.top)/r.height*2+1); raycaster.setFromCamera(pointer,camera); return raycaster.ray.intersectPlane(ground,hit) ? hit.clone() : null; }
function frame(now) { const dx = target?.x - visitor.position.x, dz = target?.z - visitor.position.z, dist = Math.hypot(dx || 0,dz || 0); if (target && dist > .15) { const nx = visitor.position.x + dx/dist*.06, nz = visitor.position.z + dz/dist*.06; if (garden.canOccupy(nx,nz)) visitor.position.set(nx,0,nz); else target = null; } else target = null; camera.position.lerp(new THREE.Vector3(visitor.position.x+10,8,visitor.position.z+13),.08); camera.lookAt(visitor.position.x,1,visitor.position.z-2); showDetail(garden.update({visitor})); renderer.render(scene,camera); if (!fpsEl.hidden) { frameCount++; if (now - fpsSince >= 1000) { fpsEl.textContent = `FPS ${Math.round(frameCount * 1000 / (now - fpsSince))}`; frameCount = 0; fpsSince = now; } } previousFrame = now; requestAnimationFrame(frame); }
canvas.addEventListener('pointerdown', event => { dragging=false; dragX=event.clientX; canvas.setPointerCapture(event.pointerId); });
canvas.addEventListener('pointermove', event => { if (!canvas.hasPointerCapture(event.pointerId)) return; const dx=event.clientX-dragX; dragging ||= Math.abs(dx)>2; dragX=event.clientX; if(dragging) visitor.rotation.y-=dx/120; });
canvas.addEventListener('pointerup', event => { if (!dragging) { const next=point(event); if(next && garden.canOccupy(next.x,next.z)) target=next; } canvas.releasePointerCapture(event.pointerId); });
document.querySelector('#mine').addEventListener('click', () => { const mine=garden.memorials[0]; if (mine) { visitor.position.set(mine.worldX,0,mine.worldZ+4); target=null; } });
for (const id of ['flower','lamp']) document.querySelector(`#${id}`).addEventListener('click', () => { if (nearby) detail.dataset.offer = id; });
resize(); addEventListener('resize',resize); garden=await mountPetGarden(scene,{dataUrl: sampleMode ? new URL('./sample-data.json', import.meta.url) : undefined,onNearby:showDetail});
if (!garden.memorials.length) { emptyGarden = true; showDetail(null); document.querySelector('#mine').hidden = true; }
showClaim(await loadClaim());
frame();
