// Staging-only entry point. No telemetry, storage, credentials or remote logging.
import {audio} from './app.js';
import {soundFile} from './audio.js';
import {inTelegram} from './telegram.js';
import {release,imageStatus} from './resources.js';
if(['staging.chuamay.org','127.0.0.1','localhost'].includes(location.hostname)&&new URLSearchParams(location.search).get('debug')==='audio'){
 const panel=document.createElement('details');panel.id='audio-debug';panel.open=false;
 panel.style.cssText='position:fixed;z-index:1000;top:84px;left:4px;right:4px;max-height:48dvh;overflow:auto;padding:8px;background:#201c18;color:#fff;border:1px solid #baa98d;font:12px/1.4 monospace;border-radius:8px';
 panel.innerHTML='<summary>Audio diagnostics · staging</summary><div style="display:flex;gap:4px;flex-wrap:wrap"><button type="button" id="audio-test">测试声音：440Hz → 木鱼</button><button type="button" id="audio-native-test">单独测试 HTML 音频</button><button type="button" id="audio-copy">复制诊断</button></div><textarea readonly aria-label="Audio diagnostic text" rows="10" style="width:100%;box-sizing:border-box;font:11px/1.4 monospace;color:#fff;background:#201c18"></textarea><p id="audio-debug-note">只在本机显示；测试会开启声音。请分别记录哪一种能听到。</p>';
 document.body.append(panel);
 const fit=()=>{panel.style.maxHeight=Math.max(44,document.querySelector('#controls').getBoundingClientRect().top-92)+'px';panel.style.right=panel.open?'4px':'auto';};
 panel.querySelector('summary').style.cssText='min-height:44px;display:flex;align-items:center;cursor:pointer';
 panel.addEventListener('toggle',fit);const resize=new ResizeObserver(fit);resize.observe(document.querySelector('#app'));resize.observe(document.querySelector('#controls'));fit();const out=panel.querySelector('textarea'),files=new Map();let last={},native={},previousTime=null,advanced='not sampled',resumeError='none';
 audio.observe=e=>{if(e.event==='file'){const key=e.name+'.'+e.ext;files.set(key,{...files.get(key),...e});}else if(e.event==='play')last=e;else if(e.event==='native')native=e;else if(e.event==='resume')resumeError=e.error;};
 const samples=[['bell','钟'],['keisu','磬'],['mo','木鱼'],['bead-v1','木珠'],['forest','山林'],['rain','雨']];
 const auditions=document.createElement('div');auditions.style.cssText='display:flex;flex-wrap:wrap;gap:4px';
 auditions.innerHTML=samples.map(([name,label])=>`<button type="button" data-audition="${name}">${label} <small>gain=0</small></button>`).join('')+'<button type="button" id="audio-stop">停止试听</button>';
 panel.querySelector('textarea').before(auditions);
 let audition=0,stopTimer=0;
 const stop=()=>{audition++;clearTimeout(stopTimer);audio.stopBackground();for(const source of audio.voices){try{source.stop();}catch{}}for(const el of audio.native.values())el.pause();};
 auditions.onclick=async e=>{
  const name=e.target.closest('[data-audition]')?.dataset.audition;if(!name)return;
  stop();const version=audition,pending=audio.enable(),epoch=audio.epoch;
  try{await pending;if(!audio.enabled||version!==audition||epoch!==audio.epoch)return;
   if(['forest','rain'].includes(name)){await audio.ambient(name);if(version===audition)stopTimer=setTimeout(stop,5000);}
   else {await audio.load(name);if(version===audition&&epoch===audio.epoch&&audio.enabled)audio.strike(name);}
  }catch(e){panel.querySelector('#audio-debug-note').textContent='试听未能加载：'+e.name;}
 };
 panel.querySelector('#audio-stop').onclick=stop;
 const render=()=>{
  const c=audio.context,time=c?.currentTime;
  if(time!=null&&previousTime!=null)advanced=time>previousTime?'yes':'no';previousTime=time;
  const lines=['audio-debug v2',`enabled=${audio.enabled} loading=${audio.loading} Telegram=${inTelegram()}`,`state=${c?.state??'not created'} sampleRate=${c?.sampleRate??'-'} currentTime=${time?.toFixed(3)??'-'} advancing=${advanced}`,`audioSession=${!!navigator.audioSession} type=${navigator.audioSession?.type??'-'}`,`master=${audio.master?.gain.value??'-'} lastPlay=${audio.lastPlayed?new Date(audio.lastPlayed).toISOString():'none'}`,`schedule=${JSON.stringify(last)} native=${JSON.stringify(native)}`,`resumeError=${resumeError}`];
  for(const name of ['bell','keisu','mo','bead-v1','ambient-courtyard','ambient-rain']){const attempts=[...files.values()].filter(f=>f.name===name);lines.push(attempts.length?attempts.map(f=>`${soundFile(name)}.${f.ext}: HTTP=${f.status??'-'} mime=${f.mime??'-'} request=${f.request??'ok'} decode=${f.decode??'-'} ${f.error??''}`).join('\n'):`${soundFile(name)}: not requested`);}
  auditions.querySelectorAll('small').forEach(e=>e.textContent=`gain=${audio.enabled?(audio.master?.gain.value??0).toFixed(2):'0.00'} (1 × master)`);
  lines.push('release: '+release);for(const [name,result] of imageStatus)lines.push('image '+name+': '+JSON.stringify(result));lines.push('UA: '+navigator.userAgent);out.value=lines.join('\n');
 };
 render();setInterval(render,500);
 panel.querySelector('#audio-test').onclick=async()=>{
  stop();const version=audition,pending=audio.enable(),c=audio.context,epoch=audio.epoch;
  if(c){const oscillator=c.createOscillator(),gain=c.createGain();oscillator.frequency.value=440;gain.gain.value=.5;oscillator.connect(gain);gain.connect(audio.master);audio.voices.add(oscillator);oscillator.onended=()=>{audio.voices.delete(oscillator);oscillator.disconnect();gain.disconnect();};oscillator.start();oscillator.stop(c.currentTime+.3);last={name:'440Hz test',when:c.currentTime,gain:.5,master:audio.master.gain.value};}
  if(await pending)setTimeout(()=>{if(epoch===audio.epoch&&version===audition)audio.strike('mo');},400);
 };
 panel.querySelector('#audio-native-test').onclick=()=>{stop();void audio.enable();audio.playNative('mo');};
 panel.querySelector('#audio-copy').onclick=async()=>{render();try{await navigator.clipboard.writeText(out.value);panel.querySelector('#audio-debug-note').textContent='已复制。';}catch{out.focus();out.select();panel.querySelector('#audio-debug-note').textContent='请长按选中的文字复制。';}};
}
