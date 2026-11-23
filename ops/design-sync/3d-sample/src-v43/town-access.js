import {createTownClient} from './town-client.js';

// The later scene integration reads /api/pet-garden/town/config and passes both flags.
// No flag means no entry and no requests; the scene remains the owner of rendering.
export function createTownAccess(options={}){
  const entry=options.entryEnabled===true,realtime=options.realtimeEnabled===true;
  let mode=entry?'single':'hidden';
  const client=createTownClient({...options,enabled:entry&&realtime,
    onSnapshot(message){mode='shared';return options.onSnapshot?.(message);},
    onDisconnect(message){mode='single';return options.onDisconnect?.(message);},
    onOffline(code){mode='single';return options.onOffline?.(code);},
  });
  return {...client,get mode(){return mode;},enter(scene){return entry&&(realtime?client.enter(scene):true);}};
}
