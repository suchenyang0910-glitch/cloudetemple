import assert from 'node:assert/strict';
import {createTempleAudio} from '../audio.js';

globalThis.document={hidden:false};
const started=[];
const param=(value=0)=>({value,setValueAtTime(v){this.value=v;},linearRampToValueAtTime(v){this.value=v;},exponentialRampToValueAtTime(v){this.value=v;},cancelScheduledValues(){}});
const node=()=>({connect(){},disconnect(){}});
const context={state:'running',currentTime:1,sampleRate:8000,
 createGain(){return {...node(),gain:param(1)};},createChannelMerger(){return node();},createDelay(){return {...node(),delayTime:param()};},createBiquadFilter(){return {...node(),frequency:param(),Q:param()};},
 createBuffer(channels,length,rate){const rows=Array.from({length:channels},()=>new Float32Array(length));return {duration:length/rate,getChannelData:i=>rows[i]};},
 createBufferSource(){const source={...node(),playbackRate:param(1),start(){started.push(source);},stop(){source.onended?.();}};return source;}
};
const audio=createTempleAudio();audio.context=context;audio.master=context.createGain();audio.enabled=true;audio.buffers.set('ambient-rain',{duration:60});
await audio.ambient('rain-strings',.32);audio.pluckString();
assert.equal(audio.ambientKind,'rain-strings');assert(audio.background);assert(audio.stringBuffers.size===1);assert(started.length>=2);
audio.stopBackground();assert.equal(audio.background,null);assert.equal(audio.stringTimer,0);assert.equal(audio.stringSources.size,0);
console.log('Rain + generated strings starts and stops without leaving active voices');
