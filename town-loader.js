import {canEnterTown,readTownReturn,enterHall,failTown} from './town-navigation.js';
import {createTempleAudio} from './audio.js';
export let world;
const soundButton=document.getElementById('town-sound');
export const audio=createTempleAudio({
  volume:()=>{try{const v=JSON.parse(localStorage.getItem('ct-volume'));return typeof v==='number'&&Number.isFinite(v)&&v>=0&&v<=100?v/100:.8;}catch{return .8;}},
  onChange:()=>{soundButton.setAttribute('aria-pressed',String(audio.enabled));soundButton.setAttribute('aria-busy',String(audio.loading));soundButton.textContent=audio.enabled?'Tắt âm thanh':'Bật âm thanh';},
  onError:()=>{const msg=document.getElementById('msg');msg.style.opacity=1;msg.textContent='Chưa mở được âm thanh. Bạn vẫn có thể tiếp tục tham quan.';}
});
let failed=false;
const timer=setTimeout(fail,20000);
function fail(){if(failed)return;failed=true;clearTimeout(timer);world?.dispose();audio.mute();failTown();}
soundButton.addEventListener('click',async()=>{
  if(audio.enabled){audio.mute();return;}
  if(await audio.enable())void audio.ambient('forest',.32,1.5);
});
document.addEventListener('visibilitychange',async()=>{
  if(document.hidden)audio.stopBackground();
  else if(audio.enabled){await audio.wake();void audio.ambient('forest',.32,1.5);}
});
document.getElementById('town-fallback').addEventListener('click',fail);
document.getElementById('town-stay').addEventListener('click',()=>{
  document.getElementById('town-slow').hidden=true;
  document.getElementById('back-2d').focus();
});
if(!canEnterTown()){
  clearTimeout(timer);location.replace('/?town=home');
}else{
  try{
    const {startTown}=await import('./town-scene.js');
    if(!failed){
      world=startTown({onEnterHall:enterHall,onFailure:fail,onLowPerformance:()=>{document.getElementById('town-slow').hidden=false;},restore:readTownReturn()});
      clearTimeout(timer);document.getElementById('town-status').hidden=true;
      document.body.dataset.ready='true';performance.mark('town-first-frame');
    }
  }catch{fail();}
}
addEventListener('pagehide',()=>{world?.dispose();audio.mute();});
addEventListener('pageshow',e=>{if(e.persisted)location.reload();});
