// Decoded recordings only. No context, request or source exists until an explicit enable gesture.
export function createTempleAudio({onChange=()=>{},onError=()=>{},volume=()=>.25}={}){
 const a={enabled:false,loading:false,context:null,master:null,ambientKind:'none',background:null,buffers:new Map(),requests:new Map(),voices:new Set(),slots:Array(6).fill(0),lastPlayed:0,epoch:0,controller:null,
  async enable(){
   if(this.enabled)return !this.loading;
   const epoch=++this.epoch;this.enabled=true;this.loading=true;this.controller=new AbortController();onChange();
   try{
    try{if(navigator.audioSession)navigator.audioSession.type='playback';}catch{}
    const Context=window.AudioContext||window.webkitAudioContext;if(!Context)throw Error('audio');
    this.context??=new Context();if(!this.master){this.master=this.context.createGain();this.master.connect(this.context.destination);}
    this.volume();await this.context.resume();
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
     try{const response=await fetch(`assets/audio/${name}.${ext}`,{signal});if(!response.ok)throw Error('audio request');const buffer=await this.context.decodeAudioData(await response.arrayBuffer());if(signal.aborted)throw new DOMException('Muted','AbortError');this.buffers.set(name,buffer);return buffer;}catch(e){error=e;if(signal.aborted)throw e;}
    }throw error;
   })().finally(()=>{if(this.requests.get(name)===request)this.requests.delete(name);});
   this.requests.set(name,request);return request;
  },
  volume(){if(this.master)this.master.gain.value=this.enabled?Math.max(0,Math.min(1,volume())):0;},
  mute(){this.epoch++;this.enabled=false;this.loading=false;this.controller?.abort();this.requests.clear();this.volume();this.stopBackground();for(const source of this.voices){try{source.stop();}catch{}}this.voices.clear();this.slots.fill(0);onChange();},
  strike(kind,gain=1){
   if(!this.enabled||this.context?.state!=='running'||document.hidden)return false;
   const name=kind==='wood'?'mo':kind,buffer=this.buffers.get(name);if(!buffer)return false;
   const source=this.context.createBufferSource(),level=this.context.createGain();source.buffer=buffer;level.gain.value=gain;source.connect(level);level.connect(this.master);
   const now=this.context.currentTime;let when=now;
   if(name==='mo'){const i=this.slots.indexOf(Math.min(...this.slots));when=Math.max(now,this.slots[i]);this.slots[i]=when+buffer.duration;}
   this.voices.add(source);source.onended=()=>{this.voices.delete(source);source.disconnect();level.disconnect();};source.start(when);this.lastPlayed=Date.now();return true;
  },
  stopBackground(){if(this.background){this.background.stop();this.background.disconnect();this.background=null;}},
  async ambient(kind){
   this.ambientKind=kind;this.stopBackground();const epoch=this.epoch;
   if(!this.enabled||kind==='none'||document.hidden)return;
   try{const buffer=await this.load(kind==='forest'?'ambient-courtyard':'ambient-rain');if(!this.enabled||this.epoch!==epoch||this.ambientKind!==kind||document.hidden)return;
    this.stopBackground();const source=this.context.createBufferSource();source.buffer=buffer;source.loop=true;source.loopEnd=Math.min(60,buffer.duration);source.connect(this.master);source.start();this.background=source;this.lastPlayed=Date.now();
   }catch(e){if(e.name!=='AbortError'&&this.enabled)onError();}
  },
  async wake(){if(this.enabled&&this.context){try{await this.context.resume();}catch{onError();}}}
 };return a;
}
