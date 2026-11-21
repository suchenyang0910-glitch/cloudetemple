import {canEnterTown,readTownReturn,enterHall,failTown} from './town-navigation.js';
export let world;
let failed=false;
const timer=setTimeout(fail,20000);
function fail(){if(failed)return;failed=true;clearTimeout(timer);world?.dispose();failTown();}
if(!canEnterTown()){
  clearTimeout(timer);location.replace('/?town=home');
}else{
  try{
    const {startTown}=await import('./town-scene.js');
    if(!failed){
      world=startTown({onEnterHall:enterHall,onFailure:fail,restore:readTownReturn()});
      clearTimeout(timer);document.getElementById('town-status').hidden=true;
      document.body.dataset.ready='true';performance.mark('town-first-frame');
    }
  }catch{fail();}
}
addEventListener('pagehide',()=>world?.dispose());
addEventListener('pageshow',e=>{if(e.persisted)location.reload();});
