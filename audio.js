// Decoded recordings only. No context, request or source exists until an explicit enable gesture.
import {assetURL} from './resources.js';
export function createTempleAudio({onChange=()=>{},onError=()=>{},volume=()=>.25}={}){
 const a={enabled:false,loading:false,context:null,master:null,ambientKind:'none',background:null,buffers:new Map(),requests:new Map(),voices:new Set(),slots:Array(6).fill(0),lastPlayed:0,epoch:0,controller:null,observe:()=>{},native:new Map(),
  async enable(){
   if(this.enabled)return !this.loading;
   const epoch=++this.epoch;this.enabled=true;this.loading=true;this.controller=new AbortController();onChange();
   try{
    try{if(navigator.audioSession)navigator.audioSession.type='playback';}catch{}
    const Context=window.AudioContext||window.webkitAudioContext;if(!Context)throw Error('audio');
    this.context??=new Context();this.context.onstatechange=()=>{this.observe({event:'state',state:this.context.state});onChange();};if(!this.master){this.master=this.context.createGain();this.master.connect(this.context.destination);}
    for(const name of ['bell','keisu','mo'])if(!this.native.has(name)){const el=new Audio();el.preload='none';el.src=assetURL(`audio/${name}.mp3`);this.native.set(name,el);}
    this.volume();const resumed=this.context.resume();
    // Start a silent frame inside the original click stack, before any network await.
    const unlock=this.context.createBufferSource();unlock.buffer=this.context.createBuffer(1,1,this.context.sampleRate);unlock.connect(this.master);unlock.onended=()=>unlock.disconnect();unlock.start();
    void resumed.catch(e=>this.observe({event:'resume',error:e.name+': '+e.message}));
    await Promise.all(['bell','keisu','mo'].map(n=>this.load(n)));
    if(epoch!==this.epoch)return false;this.loading=false;onChange();return true;
   }catch(e){if(epoch===this.epoch){this.mute();if(e.name!=='AbortError')onError();}return false;}
  },
  load(name){
   if(this.buffers.has(name))return Promise.resolve(this.buffers.get(name));
   if(!this.enabled)return Promise.reject(new DOMException('Muted','AbortError'));
   if(this.requests.has(name))return this.requests.get(name);
   const signal=this.controller.signal;
   const request=(async()=>{
    let error;for(const ext of ['m4a','mp3']){
     if(signal.aborted)throw new DOMException('Muted','AbortError');
     let phase='request';try{const response=await fetch(assetURL(`audio/${name}.${ext}`),{signal,credentials:'omit'});this.observe({event:'file',name,ext,status:response.status,mime:response.headers.get('content-type'),decode:'pending'});if(!response.ok)throw Error(`HTTP ${response.status}`);phase='decode';const buffer=await this.context.decodeAudioData(await response.arrayBuffer());if(signal.aborted)throw new DOMException('Muted','AbortError');this.buffers.set(name,buffer);this.observe({event:'file',name,ext,decode:'ok',duration:buffer.duration});return buffer;}catch(e){error=e;this.observe({event:'file',name,ext,[phase]:'failed',error:`${e.name}: ${e.message}`});if(signal.aborted)throw e;}
    }throw error;
   })().finally(()=>{if(this.requests.get(name)===request)this.requests.delete(name);});
   this.requests.set(name,request);return request;
  },
  volume(){if(this.master)this.master.gain.value=this.enabled?Math.max(0,Math.min(1,volume())):0;},
  mute(){this.epoch++;this.enabled=false;this.loading=false;this.controller?.abort();this.requests.clear();this.volume();this.stopBackground();for(const el of this.native.values())el.pause();for(const source of this.voices){try{source.stop();}catch{}}this.voices.clear();this.slots.fill(0);onChange();},
  playNative(name,gain=1){
   if(!this.enabled||document.hidden)return false;const el=this.native.get(name);if(!el)return false;
   // Emergency fallback reuses one element per sound; rapid overlaps still use Web Audio.
   el.volume=Math.max(0,Math.min(1,volume()*gain));el.currentTime=0;
   const epoch=this.epoch;el.play().then(()=>{if(!this.enabled||epoch!==this.epoch){el.pause();return;}this.lastPlayed=Date.now();this.observe({event:'native',name,result:'playing',gain:el.volume});}).catch(e=>{this.observe({event:'native',name,result:e.name+': '+e.message});onError();});return true;
  },
  strike(kind,gain=1){
   if(!this.enabled||document.hidden)return false;
   const name=kind==='wood'?'mo':kind;
   if(this.context?.state!=='running'){void this.wake();if(navigator.userActivation?.isActive)return this.playNative(name,gain);return false;}
   const buffer=this.buffers.get(name);if(!buffer)return false;
   const source=this.context.createBufferSource(),level=this.context.createGain();source.buffer=buffer;level.gain.value=gain;source.connect(level);level.connect(this.master);
   const now=this.context.currentTime;let when=now;
   if(name==='mo'){const i=this.slots.indexOf(Math.min(...this.slots));when=Math.max(now,this.slots[i]);this.slots[i]=when+buffer.duration;}
   this.voices.add(source);source.onended=()=>{this.voices.delete(source);source.disconnect();level.disconnect();};source.start(when);this.lastPlayed=Date.now();this.observe({event:'play',name,when,gain,master:this.master.gain.value});return true;
  },
  stopBackground(){if(this.background){this.background.stop();this.background.disconnect();this.background=null;}},
  async ambient(kind){
   this.ambientKind=kind;this.stopBackground();const epoch=this.epoch;
   if(!this.enabled||kind==='none'||document.hidden)return;
   try{const buffer=await this.load(kind==='forest'?'ambient-courtyard':'ambient-rain');if(!this.enabled||this.epoch!==epoch||this.ambientKind!==kind||document.hidden)return;
    this.stopBackground();const source=this.context.createBufferSource();source.buffer=buffer;source.loop=true;source.loopEnd=Math.min(60,buffer.duration);source.connect(this.master);source.start();this.background=source;this.lastPlayed=Date.now();
   }catch(e){if(e.name!=='AbortError'&&this.enabled)onError();}
  },
  async wake(){if(this.enabled&&this.context&&this.context.state!=='running'){try{await this.context.resume();}catch(e){this.observe({event:'resume',error:e.name+': '+e.message});onError();}}}
 };return a;
}
