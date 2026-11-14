// Decoded recordings only. No context, request or source exists until an explicit enable gesture.
import {assetURL} from './resources.js';
export const soundFile=name=>({bell:'bell-v2',keisu:'keisu-v2'}[name]??name);
export function createTempleAudio({onChange=()=>{},onError=()=>{},volume=()=>.8}={}){
 const a={enabled:false,loading:false,context:null,master:null,limiter:null,ambientKind:'none',background:null,backgroundNodes:[],buffers:new Map(),requests:new Map(),voices:new Set(),slots:Array(6).fill(0),lastPlayed:0,epoch:0,controller:null,observe:()=>{},native:new Map(),ambientVersion:0,breathVersion:0,fading:new Set(),backgroundLevel:null,breathSource:null,breathLevel:null,stringTimer:0,stringSources:new Set(),stringBuffers:new Map(),stringNote:3,
  async enable(){
   if(this.enabled)return !this.loading;
   const epoch=++this.epoch;this.enabled=true;this.loading=true;this.controller=new AbortController();onChange();
   try{
    try{if(navigator.audioSession)navigator.audioSession.type='playback';}catch{}
    const Context=window.AudioContext||window.webkitAudioContext;if(!Context)throw Error('audio');
    this.context??=new Context();this.context.onstatechange=()=>{this.observe({event:'state',state:this.context.state});onChange();};if(!this.master){this.master=this.context.createGain();this.limiter=this.context.createDynamicsCompressor();this.limiter.threshold.value=-6;this.limiter.knee.value=0;this.limiter.ratio.value=20;this.limiter.attack.value=.003;this.limiter.release.value=.25;this.master.connect(this.limiter);this.limiter.connect(this.context.destination);}
    for(const name of ['bell','keisu','mo','bead-v1','ignite-v1'])if(!this.native.has(name)){const el=new Audio();el.preload='none';el.src=assetURL(`audio/${soundFile(name)}.mp3`);this.native.set(name,el);}
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
    // MP3 is eligible for Cloudflare's default extension cache; AAC remains a decode fallback.
    let error;for(const ext of ['mp3','m4a']){
     if(signal.aborted)throw new DOMException('Muted','AbortError');
     let phase='request';try{const response=await fetch(assetURL(`audio/${soundFile(name)}.${ext}`),{signal,credentials:'omit'});this.observe({event:'file',name,ext,status:response.status,mime:response.headers.get('content-type'),decode:'pending'});if(!response.ok)throw Error(`HTTP ${response.status}`);phase='decode';const buffer=await this.context.decodeAudioData(await response.arrayBuffer());if(signal.aborted)throw new DOMException('Muted','AbortError');this.buffers.set(name,buffer);this.observe({event:'file',name,ext,decode:'ok',duration:buffer.duration});return buffer;}catch(e){error=e;this.observe({event:'file',name,ext,[phase]:'failed',error:`${e.name}: ${e.message}`});if(signal.aborted)throw e;}
    }throw error;
   })().finally(()=>{if(this.requests.get(name)===request)this.requests.delete(name);});
   this.requests.set(name,request);return request;
  },
  volume(){const value=this.enabled?Math.max(0,Math.min(1,volume())):0;if(this.master)this.master.gain.value=value;for(const el of this.native.values())el.volume=Math.min(1,value*(el.soundGain??1));},
  mute(){this.epoch++;this.enabled=false;this.loading=false;this.controller?.abort();this.requests.clear();this.volume();this.stopBackground();this.stopBreathing();for(const source of this.fading){try{source.stop();}catch{}}this.fading.clear();for(const el of this.native.values())el.pause();for(const source of this.voices){try{source.stop();}catch{}}this.voices.clear();this.slots.fill(0);onChange();},
  playNative(name,gain=1){
   if(!this.enabled||document.hidden)return false;const el=this.native.get(name);if(!el)return false;
   // Emergency fallback reuses one element per sound; rapid overlaps still use Web Audio.
   el.soundGain=gain;el.volume=Math.max(0,Math.min(1,volume()*gain));el.currentTime=0;
   const epoch=this.epoch;el.play().then(()=>{if(!this.enabled||epoch!==this.epoch){el.pause();return;}this.lastPlayed=Date.now();this.observe({event:'native',name,result:'playing',gain:el.volume});}).catch(e=>{this.observe({event:'native',name,result:e.name+': '+e.message});onError();});return true;
  },
  strike(kind,gain=1,rate=1){
   if(!this.enabled||document.hidden)return false;
   const name=kind==='wood'?'mo':kind;
   if(this.context?.state!=='running'){void this.wake();if(navigator.userActivation?.isActive)return this.playNative(name,gain);return false;}
   const buffer=this.buffers.get(name);if(!buffer)return false;
   const source=this.context.createBufferSource(),level=this.context.createGain();source.buffer=buffer;source.playbackRate.value=rate;level.gain.value=gain;source.connect(level);level.connect(this.master);
   const now=this.context.currentTime;let when=now;
   if(name==='mo'){const i=this.slots.indexOf(Math.min(...this.slots));when=Math.max(now,this.slots[i]);this.slots[i]=when+buffer.duration/rate;}
   this.voices.add(source);source.onended=()=>{this.voices.delete(source);source.disconnect();level.disconnect();};source.start(when);this.lastPlayed=Date.now();this.observe({event:'play',name,when,gain,master:this.master.gain.value});return true;
  },
  stopBackground(fade=0){
   this.ambientVersion++;
   clearTimeout(this.stringTimer);this.stringTimer=0;const source=this.background,level=this.backgroundLevel,nodes=this.backgroundNodes;this.background=null;this.backgroundLevel=null;this.backgroundNodes=[];
   const stopStrings=when=>{for(const voice of this.stringSources)try{when===undefined?voice.stop():voice.stop(when);}catch{}};
   if(this.context)stopStrings(fade&&this.enabled?this.context.currentTime+fade:undefined);
   if(!source)return;
   if(fade&&this.enabled&&level){const now=this.context.currentTime;level.gain.cancelScheduledValues(now);level.gain.setValueAtTime(level.gain.value,now);level.gain.linearRampToValueAtTime(0,now+fade);this.fading.add(source);source.stop(now+fade);}
   else {try{source.stop();}catch{}source.disconnect();level?.disconnect();for(const node of nodes)try{node.disconnect();}catch{}}
  },
  stringBuffer(frequency){if(this.stringBuffers.has(frequency))return this.stringBuffers.get(frequency);const rate=this.context.sampleRate,length=Math.round(rate*3),period=Math.max(2,Math.round(rate/frequency)),buffer=this.context.createBuffer(1,length,rate),data=buffer.getChannelData(0);for(let i=0;i<period;i++)data[i]=(Math.random()*2-1)*.28;for(let i=period;i<length;i++)data[i]=.996*.5*(data[i-period]+data[i-period+1]);this.stringBuffers.set(frequency,buffer);return buffer;},
  pluckString(){if(!this.enabled||this.ambientKind!=='rain-strings'||document.hidden||!this.backgroundLevel)return;const notes=[146.83,164.81,185,220,246.94,293.66,329.63],step=Math.floor(Math.random()*3)-1;this.stringNote=Math.max(0,Math.min(notes.length-1,this.stringNote+step));const source=this.context.createBufferSource(),filter=this.context.createBiquadFilter(),level=this.context.createGain(),now=this.context.currentTime;source.buffer=this.stringBuffer(notes[this.stringNote]);filter.type='lowpass';filter.frequency.value=2400;filter.Q.value=.7;level.gain.setValueAtTime(1.15,now);level.gain.exponentialRampToValueAtTime(.001,now+2.8);source.connect(filter);filter.connect(level);level.connect(this.backgroundLevel);this.stringSources.add(source);source.onended=()=>{this.stringSources.delete(source);source.disconnect();filter.disconnect();level.disconnect();};source.start();const r=Math.random(),delay=r<.12?400:r<.25?6000+Math.random()*1000:1500+Math.random()*2500;this.stringTimer=setTimeout(()=>this.pluckString(),delay);},
  startStrings(){clearTimeout(this.stringTimer);this.stringTimer=setTimeout(()=>this.pluckString(),700+Math.random()*800);},
  async ambient(kind,gain=1,fade=0){
   this.ambientKind=kind;this.stopBackground(fade);const epoch=this.epoch,version=this.ambientVersion;
   if(!this.enabled||kind==='none'||document.hidden)return;
   try{const buffer=await this.load(kind==='forest'?'ambient-courtyard':'ambient-rain');if(!this.enabled||this.epoch!==epoch||this.ambientVersion!==version||this.ambientKind!==kind||document.hidden)return;
     const source=this.context.createBufferSource(),level=this.context.createGain(),nodes=[];source.buffer=buffer;source.loop=true;source.loopEnd=Math.min(60,buffer.duration);if(kind==='forest')source.connect(level);else{const merger=this.context.createChannelMerger(2),left=this.context.createGain(),right=this.context.createDelay(.05),rain=kind==='rain-strings'?this.context.createBiquadFilter():source;right.delayTime.value=.021;if(kind==='rain-strings'){rain.type='highpass';rain.frequency.value=280;rain.Q.value=.7;source.connect(rain);nodes.push(rain);}rain.connect(left);left.connect(merger,0,0);rain.connect(right);right.connect(merger,0,1);merger.connect(level);nodes.push(left,right,merger);this.backgroundNodes=nodes;}level.connect(this.master);
    level.gain.setValueAtTime(fade?0:gain,this.context.currentTime);if(fade)level.gain.linearRampToValueAtTime(gain,this.context.currentTime+fade);
    source.onended=()=>{source.disconnect();level.disconnect();for(const node of nodes)try{node.disconnect();}catch{}this.fading.delete(source);};source.start();this.background=source;this.backgroundLevel=level;if(kind==='rain-strings')this.startStrings();this.lastPlayed=Date.now();
   }catch(e){if(e.name!=='AbortError'&&this.enabled)onError();}
  },
  stopBreathing(fade=0){
   this.breathVersion++;const source=this.breathSource,level=this.breathLevel;this.breathSource=null;this.breathLevel=null;if(!source)return;
   if(fade&&this.enabled&&level){const now=this.context.currentTime;level.gain.cancelScheduledValues(now);level.gain.setValueAtTime(level.gain.value,now);level.gain.linearRampToValueAtTime(0,now+fade);this.fading.add(source);source.stop(now+fade);}
   else {try{source.stop();}catch{}source.disconnect();level?.disconnect();}
  },
  async breathing(pattern='4-6',gain=.5,fade=0){
   this.stopBreathing(fade);const epoch=this.epoch,version=this.breathVersion;if(!this.enabled||document.hidden)return;
   try{const buffer=await this.load(`breath-${pattern}`);if(!this.enabled||this.epoch!==epoch||this.breathVersion!==version||document.hidden)return;
    const source=this.context.createBufferSource(),level=this.context.createGain();source.buffer=buffer;source.loop=true;source.loopEnd=buffer.duration;source.connect(level);level.connect(this.master);
    level.gain.setValueAtTime(fade?0:gain,this.context.currentTime);if(fade)level.gain.linearRampToValueAtTime(gain,this.context.currentTime+fade);
    source.onended=()=>{source.disconnect();level.disconnect();this.fading.delete(source);};source.start();this.breathSource=source;this.breathLevel=level;this.lastPlayed=Date.now();
   }catch(e){if(e.name!=='AbortError'&&this.enabled)onError();}
  },
  async wake(){if(this.enabled&&this.context&&this.context.state!=='running'){try{await this.context.resume();}catch(e){this.observe({event:'resume',error:e.name+': '+e.message});onError();}}}
 };return a;
}
