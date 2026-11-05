import {createTempleAudio} from './audio.js';
import {copy,reflections} from './i18n.js';
import {apiURL,initTelegram,inTelegram,initData,telegramBack,telegramAppearance,haptic,telegramShare} from './telegram.js';

const $=s=>document.querySelector(s);
const imageRoot='assets/processed-v1/img/';
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
const state={view:'entry',lang:'vi',visitor:null,period:'day',layout:null,busy:false,activity:null,result:null,bowTarget:3,sitMinutes:3,wood:0,bead:0};
const images=new Map(),tinted=new Map();
let transitionId=0,drawFrame=0,lastFocus=null,shareBlob=null,shareURL=null;
const canvas=$('#scene'),ctx=canvas.getContext('2d');
const t=(key,params={})=>Object.entries(params).reduce((s,[k,v])=>s.replaceAll('{'+k+'}',String(v)),copy[key]?.[state.lang]??key);
const escapeHTML=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const button=(key,action,cls='',extra='')=>`<button type="button" class="${cls}" data-action="${action}" ${extra}>${t(key)}</button>`;
const actionIcons={
  incense:'<path d="M7 17V8m5 9V6m5 11V8M5 17h14l-2 4H7zM7 5V3m5 0V1m5 4V3"/>',
  bow:'<path d="m4 21 3-9 3-8q2-2 2 1v10l-4 6m12 0-3-9-3-8q-2-2-2 1v10l4 6"/>',
  sit:'<ellipse cx="12" cy="14" rx="9" ry="4"/><path d="M3 14v4c0 5 18 5 18 0v-4M7 13h10"/>',
  beads:'<circle cx="12" cy="11" r="8" stroke-dasharray="1 4" stroke-width="3"/><path d="m12 19-2 4m2-4 2 4"/>',
  mo:'<path d="M3 15c0-9 13-11 18 1-3 6-16 6-18-1Zm2-2 13 3m-3-11 6 5"/>',
  leave:'<path d="M4 21V3h12v6M2 21h14v-4m-5-4h11m-4-4 4 4-4 4"/>'
};
const read=(key,fallback)=>{try{return JSON.parse(localStorage.getItem(key))??fallback;}catch{return fallback;}};
const write=(key,value)=>{try{localStorage.setItem(key,JSON.stringify(value));}catch{/* Private browsing still permits a complete visit. */}};

export function periodNow(date=new Date(),periods=state.layout.periods){
  const minute=date.getHours()*60+date.getMinutes();
  for(const [name,range] of Object.entries(periods)){
    const [start,end]=range.split('-').map(x=>{const [h,m]=x.split(':').map(Number);return h*60+m;});
    if(start<=end ? minute>=start&&minute<=end : minute>=start||minute<=end)return name;
  }
  return 'day';
}
export function placement(layout,id,pose){
  if(pose.startsWith('bow-')){
    const s=layout['hall-side'],scale=s.bowCanvasWidth/s.sourceCanvas[0];
    return {x:s.foot[0]-s.anchor[0]*scale,y:s.foot[1]-s.anchor[1]*scale,w:s.sourceCanvas[0]*scale,h:s.sourceCanvas[1]*scale};
  }
  const a=layout.front_image_anchors[`visitor-${id}-${pose}.webp`],s=layout.courtyard,scale=s.cushionWidth/a.cushionWidth;
  return {x:s.x-a.cushionBottomCenter[0]*scale,y:s.bottom-a.cushionBottomCenter[1]*scale,w:600*scale,h:900*scale};
}
function image(name){
  if(!images.has(name)) images.set(name,new Promise((resolve,reject)=>{
    const im=new Image();im.onload=()=>resolve(im);im.onerror=()=>{images.delete(name);reject(new Error('image'));};im.src=imageRoot+name;
  }));
  return images.get(name);
}
function sceneName(view=state.view){return ['incense','bow'].includes(view)?'hall-side':['sit','beads'].includes(view)?'courtyard':'hall-front';}
function sceneFile(view=state.view,period=state.period){return `scene-vn-${sceneName(view)}-${period}.webp`;}
function poses(view){return view==='bow'?['bow-1','bow-2','bow-3']:view==='incense'?['bow-1']:view==='sit'?['sit']:view==='beads'?['beads']:[];}
async function prepare(view,period){
  const scene=await image(sceneFile(view,period));
  const art={};
  for(const pose of (view==='mo'?['mo','mo-mallet']:poses(view))){
    const name=view==='mo'?`${pose}.webp`:`visitor-${state.visitor}-${pose}.webp`,key=name+period;
    if(!tinted.has(key)){
      const im=await image(name),c=document.createElement('canvas');c.width=im.width;c.height=im.height;
      const x=c.getContext('2d',{willReadFrequently:true});x.drawImage(im,0,0);
      const data=x.getImageData(0,0,c.width,c.height),tone=state.layout.toneRGB[period];
      for(let i=0;i<data.data.length;i+=4){for(let j=0;j<3;j++)data.data[i+j]*=tone[j]*(view==='mo'&&period==='night'?.9:1);}
      x.putImageData(data,0,0);tinted.set(key,c);
    }
    art[pose]=tinted.get(key);
  }
  return {scene,art};
}
let renderAssets=null;
function paint(now=Date.now()){
  if(!renderAssets)return;
  ctx.clearRect(0,0,941,1672);ctx.drawImage(renderAssets.scene,0,0,941,1672);
  const available=poses(state.view);if(!available.length)return;
  let pose=available[0],previous=null,mix=1;
  const a=state.activity;
  if(state.view==='bow'&&a?.bowStart!==null&&a?.bowStart!==undefined){
    const elapsed=Math.max(0,now-a.bowStart),sequence=['bow-1','bow-2','bow-3','bow-2','bow-1'],i=Math.min(4,Math.floor(elapsed/800));
    pose=sequence[i];previous=i>0?sequence[i-1]:null;mix=reduced.matches?1:Math.min(1,(elapsed-i*800)/280);
  }
  const pos=placement(state.layout,state.visitor,pose),s=state.layout;
  ctx.save();ctx.fillStyle='rgba(34,27,19,.10)';ctx.filter='blur(7px)';ctx.beginPath();
  if(sceneName()==='courtyard')ctx.ellipse(s.courtyard.x,s.courtyard.bottom-3,s.courtyard.cushionWidth*.45,12,0,0,Math.PI*2);
  else ctx.ellipse(s['hall-side'].foot[0]-65,s['hall-side'].foot[1]-2,70,7,0,0,Math.PI*2);
  ctx.fill();ctx.restore();
  const breath=state.view==='sit'&&a?.running&&!reduced.matches?Math.sin(now/4000*Math.PI*2)*3:0;
  if(previous&&mix<1&&renderAssets.art[previous]){ctx.globalAlpha=1-mix;ctx.drawImage(renderAssets.art[previous],pos.x,pos.y,pos.w,pos.h);}
  ctx.globalAlpha=mix;ctx.drawImage(renderAssets.art[pose],pos.x,pos.y+breath,pos.w,pos.h);ctx.globalAlpha=1;
}
function animation(){cancelAnimationFrame(drawFrame);const run=()=>{paint();if((state.view==='bow'&&state.activity?.bowStart!=null)||(state.view==='sit'&&state.activity?.running&&!reduced.matches))drawFrame=requestAnimationFrame(run);};run();}
function fx(){
  const f=state.layout.fx_hall_side,lit=state.view==='incense'&&state.activity?.running,bowing=state.view==='bow';
  $('#effects').innerHTML=`${bowing?`<ellipse class="halo-pulse" cx="${f.halo_center[0]}" cy="${f.halo_center[1]}" rx="92" ry="112" fill="#ffe2a6" opacity=".07"/>`:''}${lit?[-10,0,10].map((dx,i)=>`<circle class="fire" cx="${f.incense_tips[0]+dx}" cy="${f.incense_tips[1]}" r="4"/><path class="smoke" style="animation-delay:-${i*2}s" d="M${f.incense_tips[0]+dx} ${f.incense_tips[1]-5} c-18 -40 30 -65 3 -100 s23 -65 8 -95"/>`).join(''):''}`;
}
function stopActivity(){stopWoodAuto();state.activity=null;cancelAnimationFrame(drawFrame);audio.ambient('none');}
async function navigate(view,{keepResult=false}={}){
  const token=++transitionId;stopActivity();state.busy=true;$('#loading').hidden=false;$('#loading').textContent=t('loading');
  try{
    const period=periodNow(),assets=await prepare(view,period);
    if(token!==transitionId)return;
    state.view=view;state.period=period;renderAssets=assets;if(!keepResult)state.result=null;
    if(view==='mo')woodSession=0;if(view==='beads')state.bead=0;if(view==='sit')state.wood=0;
    state.busy=false;render();paint();$('#heading').focus({preventScroll:true});
  }catch{if(token===transitionId){state.busy=false;$('#notice').textContent=t('loadError');$('#controls').insertAdjacentHTML('beforeend',button('retry','retry'));}}
  finally{if(token===transitionId){$('#loading').hidden=true;$('#app').setAttribute('aria-busy','false');}}
}
function render(){
  const focused=document.activeElement,action=focused?.dataset?.action,target=focused?.dataset?.target,minutes=focused?.dataset?.minutes;
  document.documentElement.lang=state.lang;document.body.dataset.period=state.period;document.body.dataset.view=state.view;
  telegramAppearance(state.period,!!state.activity?.running&&['incense','sit'].includes(state.view));
  document.querySelectorAll('[data-i18n]').forEach(e=>e.textContent=t(e.dataset.i18n));
  $('#language').setAttribute('aria-label',t('language'));$('#controls').setAttribute('aria-label',t('actions'));
  if(inTelegram())$('#memorial').textContent=t('remind');
  telegramBack(!['entry','home'].includes(state.view));
  updateSoundUI();
  $('#sound-controls').hidden=!audio.enabled;
  $('#eyebrow').textContent=t(state.period);
  const heading=state.view==='entry'?'entryTitle':state.view==='choose'?'choose':state.view==='home'?'home':state.view;
  $('#heading').textContent=t(heading);$('#subtitle').textContent=t(state.view==='home'?'homeNote':state.view==='entry'||state.view==='choose'?'tagline':`${state.view}Note`);
  canvas.setAttribute('aria-label',t(sceneName()==='hall-front'?'sceneFront':sceneName()==='hall-side'?'sceneSide':'sceneCourt'));
  $('#notice').textContent='';$('#stage-note').textContent='';$('#entry-overlay').innerHTML='';
  if(state.view==='entry'){
    $('#controls').innerHTML=button('enter','enter','primary');
  }else if(state.view==='choose'){
    $('#controls').innerHTML=`<div class="visitor-choice"><img class="preview" src="${imageRoot}visitor-${state.visitor}-sit.webp" alt="${escapeHTML(t('choose'))}">${button('change','change')}${button('continue','continue','primary')}</div>`;
  }else if(state.view==='home'){
    $('#controls').innerHTML=`<nav class="action-nav">${['incense','bow','sit','mo','beads','leave'].map(key=>`<button data-action="${key}"><svg class="nav-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${actionIcons[key]}</svg>${t(key)}</button>`).join('')}</nav>`;
  }else if(state.result){
    $('#controls').innerHTML=`<div class="completion"><p>${reflections[state.result.reflection][state.lang]}</p><div class="row">${button('share','share','primary')}${button('back','home')}</div></div>`;
    $('#stage-note').textContent=t('completed');
  }else if(state.view==='incense'){
    $('#controls').innerHTML=`<div class="stack"><div id="incense-status" class="section-label"></div><div class="progress"><span id="incense-progress" style="width:0%"></span></div><div class="row">${button('light','light','primary',state.activity?'disabled':'')}${button('back','home')}</div></div>`;
  }else if(state.view==='bow'){
    const a=state.activity;
    $('#controls').innerHTML=`<div class="stack"><p class="section-label">${t('bowTarget')}</p><div class="choice-row">${[3,27,54,108].map(n=>`<button data-target="${n}" aria-pressed="${state.bowTarget===n}" ${a?.bowStart!=null?'disabled':''}>${n}</button>`).join('')}</div><p class="count" id="bow-count">${a?.count??0} / ${state.bowTarget}</p><div class="row">${button('bowOnce','bow-once','primary',a?.bowStart!=null?'disabled':'')}${button(a?.auto?'stopAuto':'auto','auto','',`aria-pressed="${!!a?.auto}"`)}</div>${button('back','home','text-button')}</div>`;
  }else if(state.view==='sit'){
    const a=state.activity;
    $('#controls').innerHTML=`<div class="stack"><p class="timer" id="timer" role="timer">${formatTime(a?remaining(a):state.sitMinutes*60000)}</p>${!a?`<div class="choice-row" aria-label="${t('duration')}">${[1,3,5,10].map(n=>`<button data-minutes="${n}" aria-pressed="${state.sitMinutes===n}">${n} ${t('minutes')}</button>`).join('')}</div>`:''}<div class="row">${!a?button('start','sit-start','primary'):button(a.running?'pause':'resume','pause','primary')}${a?button('finish','finish'):''}${button('wood','wood')}</div><p class="section-label" id="wood-count">${t('woodCount')}: ${state.wood}</p><div class="row"><label class="ambient-label" for="ambient">${t('ambient')}</label><select id="ambient" class="ambient">${['none','forest','rain'].map(k=>`<option value="${k}" ${audio.ambientKind===k?'selected':''}>${t(k)}</option>`).join('')}</select></div>${button('back','home','text-button')}</div>`;
  }else if(state.view==='mo'){
    $('#controls').innerHTML=`<div class="stack"><p id="daily-wood" class="count">${t('dailyWood',{count:dailyWood()})}</p><p id="wood-message" role="status">${woodSession>=108?t('wood108'):''}</p><div class="row">${button(woodAuto?'woodStop':'woodAuto','wood-auto','primary',`aria-pressed="${!!woodAuto}"`)}${button('back','home')}</div></div>`;
  }else if(state.view==='beads'){
    $('#controls').innerHTML=`<button class="bead-control" id="bead-control" data-action="bead" aria-label="${t('beadAction')}"><svg viewBox="0 0 220 180" aria-hidden="true">${Array.from({length:108},(_,i)=>{const a=i/108*Math.PI*2-Math.PI/2;return `<circle class="bead-dot ${i===state.bead%108?'current':''}" cx="${110+98*Math.cos(a)}" cy="${90+77*Math.sin(a)}" r="2.6"/>`;}).join('')}</svg><span>${state.bead} / 108</span></button>${button('back','home','text-button')}`;
    bindSwipe();
  }
  $('#more-toggle').hidden=state.view==='entry';$('#more-toggle').setAttribute('aria-label',t('more'));
  $('#wood-prop').hidden=state.view!=='mo';$('#mallet-prop').hidden=state.view!=='mo';
  $('#wood-prop').setAttribute('aria-label',t('wood'));
  if(state.view==='mo')for(const [id,key] of [['wood-art','mo'],['mallet-prop','mo-mallet']]){const c=$('#'+id),im=renderAssets.art[key];c.width=im.width;c.height=im.height;c.getContext('2d').drawImage(im,0,0);}
  fx();updateCounters();fitScene();
  if(focused&&!focused.isConnected){const replacement=action?document.querySelector(`[data-action="${action}"]`):target?document.querySelector(`[data-target="${target}"]`):minutes?document.querySelector(`[data-minutes="${minutes}"]`):null;if(replacement&&!replacement.disabled)replacement.focus({preventScroll:true});}
}
function fitScene(){
  if(!renderAssets)return;
  const stage=$('.stage'),heading=$('.scene-heading').getBoundingClientRect(),controls=$('#controls').getBoundingClientRect(),box=stage.getBoundingClientRect();
  // Cover would crop the Buddha and visitor on opposite edges; preserve their shared region.
  const top=heading.bottom-box.top+8,bottom=controls.top-box.top-8;
  const region=sceneName()==='hall-side'?[300,1280]:sceneName()==='courtyard'?[420,1400]:[300,1400];
  const fullScene=['entry','choose','home'].includes(state.view);
  const scale=fullScene?Math.max(box.width/941,box.height/1672):box.width/941;
  const sceneTop=fullScene?(box.height-1672*scale)/2:state.view==='mo'?0:Math.min(top-region[0]*scale,bottom-region[1]*scale);
  stage.style.setProperty('--scene-width',941*scale+'px');
  stage.style.setProperty('--scene-top',sceneTop+'px');
  stage.style.setProperty('--scene-image',`url("${renderAssets.scene.src}")`);
  if(state.view==='mo'){const width=box.width*.32,art=renderAssets.art.mo,height=width*art.height/art.width;$('#wood-prop').style.cssText=`width:${width}px;height:${height}px;left:${(box.width-width)/2}px;top:${controls.top-box.top-16-height}px`;$('#mallet-prop').style.cssText=`width:${width*.49}px;height:auto;left:${(box.width+width)/2-8}px;top:${controls.top-box.top-16-height-8}px`;}
}
new ResizeObserver(fitScene).observe($('#app'));
new ResizeObserver(fitScene).observe($('#controls'));
function formatTime(ms){const seconds=Math.ceil(Math.max(0,ms)/1000);return `${Math.floor(seconds/60).toString().padStart(2,'0')}:${(seconds%60).toString().padStart(2,'0')}`;}
function remaining(a){return a.running?Math.max(0,a.deadline-Date.now()):a.left;}
function updateCounters(){
  const a=state.activity;
  if(state.view==='incense'&&a){const left=remaining(a);if($('#incense-progress'))$('#incense-progress').style.width=`${100*(1-left/60000)}%`;if($('#incense-status'))$('#incense-status').textContent=`${t('burning')} · ${formatTime(left)}`;}
  if(state.view==='sit'&&a&&$('#timer'))$('#timer').textContent=formatTime(remaining(a));
}
function complete(kind,elapsed=0){
  if(state.result)return;
  const old=state.activity;
  state.result={kind,elapsed,count:kind==='bow'?old?.count:kind==='beads'?108:1,reflection:Math.floor(Math.random()*reflections.length)};
  const stored=read('ct-totals',{}),count=Number.isFinite(stored?.count)&&stored.count>=0?stored.count:0,seconds=Number.isFinite(stored?.seconds)&&stored.seconds>=0?stored.seconds:0;
  write('ct-totals',{count:count+1,seconds:seconds+Math.round(elapsed/1000)});
  stopActivity();audio.strike('bell');render();paint();
}
function bowOnce(){
  if(state.result||state.activity?.bowStart!=null)return;
  state.activity??={kind:'bow',count:0,auto:false,bowStart:null,started:Date.now()};
  state.activity.bowStart=Date.now();render();animation();
}
function bead(){
  if(state.result||state.bead>=108)return;
  state.activity??={kind:'beads',started:Date.now()};state.bead++;
  if(!haptic(state.bead===108?'heavy':'light'))try{navigator.vibrate?.(state.bead===108?[50,35,70]:10);}catch{/* Optional haptics. */}
  if(state.bead===108)complete('beads',Date.now()-state.activity.started);else render();
}
function bindSwipe(){
  const b=$('#bead-control');let start=null,moved=false;
  b.addEventListener('pointerdown',e=>{start={x:e.clientX,y:e.clientY};moved=false;b.setPointerCapture(e.pointerId);});
  b.addEventListener('pointerup',e=>{if(start&&start.y-e.clientY>25&&Math.abs(start.x-e.clientX)<70){moved=true;bead();}start=null;});
  b.addEventListener('pointercancel',()=>{start=null;});
  b.addEventListener('click',e=>{if(moved){e.preventDefault();e.stopPropagation();moved=false;}});
}

const audio=createTempleAudio({onChange:updateSoundUI,onError:()=>showSoundHint('soundUnavailable',6000),volume:()=>Number($('#volume').value)/100});
let hintTimer=0,woodAuto=null,woodSession=0;
function updateSoundUI(){
 const b=$('#sound-toggle');if(!b)return;
 const label=t(audio.enabled?'muteSound':'enableSound');b.setAttribute('aria-label',label);b.title=label;b.setAttribute('aria-pressed',String(audio.enabled));b.setAttribute('aria-busy',String(audio.loading));
 b.innerHTML=`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9h4l5-4v14l-5-4H4z"/>${audio.enabled?'<path d="M16 8q5 4 0 8m3-11q7 7 0 14"/>':'<path d="m16 9 5 6m0-6-5 6"/>'}</svg>`;
 $('#sound-controls').hidden=!audio.enabled;
 $('#audio-status').textContent=audio.loading?t('audioLoading'):'';
}
function showSoundHint(key,ms=3000){clearTimeout(hintTimer);const hint=$('#sound-hint');hint.getAnimations().forEach(a=>a.cancel());hint.textContent=t(key);hint.hidden=false;if(!reduced.matches)hint.animate([{opacity:1,offset:0},{opacity:1,offset:Math.max(0,1-300/ms)},{opacity:0}],{duration:ms});hintTimer=setTimeout(()=>{hint.hidden=true;},ms);}
async function enableSound(automatic=false){
 const began=Date.now();const pending=audio.enable();
 if(automatic)showSoundHint('tapMute');
 else setTimeout(()=>{if(audio.enabled&&audio.lastPlayed<began)showSoundHint('silentTip',6000);},2000);
 if(await pending){audio.strike('bell',.45);if(state.view==='sit'&&state.activity?.running)audio.ambient(audio.ambientKind);}
}
function localDay(){const d=new Date();return `${d.getFullYear()}-${d.getMonth()+1}-${d.getDate()}`;}
function dailyWood(){const stored=read('ct-wood',{});if(stored.day===localDay()&&Number.isSafeInteger(stored.count)&&stored.count>=0)return stored.count;return 0;}
function stopWoodAuto(){if(woodAuto){clearInterval(woodAuto);woodAuto=null;}}
function tapWood(){
 const count=dailyWood()+1;write('ct-wood',{day:localDay(),count});audio.strike('wood');
 if(state.view==='mo'){
  woodSession++;$('#daily-wood').textContent=t('dailyWood',{count});if(woodSession===108)$('#wood-message').textContent=t('wood108');
  if(!haptic('light'))try{navigator.vibrate?.(10);}catch{}
  if(!reduced.matches){
   const mallet=$('#mallet-prop');mallet.getAnimations().forEach(a=>a.cancel());mallet.animate([{transform:'translate(0,0) rotate(0deg)'},{transform:'translate(-24px,25px) rotate(-12deg)',offset:.5},{transform:'translate(0,0) rotate(0deg)'}],{duration:140});
   const art=$('#wood-art');art.getAnimations().forEach(a=>a.cancel());art.animate([{transform:'scale(1)'},{transform:'scale(.97)',offset:.5},{transform:'scale(1)'}],{duration:140});
   const ring=document.createElement('span');ring.className='wood-ripple';$('#wood-prop').append(ring);ring.animate([{transform:'scale(.3)',opacity:.25},{transform:'scale(1.2)',opacity:0}],{duration:650}).onfinish=()=>ring.remove();
  }
 }else if(state.view==='sit'){state.wood++;$('#wood-count').textContent=`${t('woodCount')}: ${state.wood}`;}
}

function openModal(title,body){lastFocus=document.activeElement;$('#modal-title').textContent=t(title);$('#modal-body').innerHTML=body;$('#modal').showModal();telegramBack(true);$('#close-modal').focus();}
function closeModal(){if($('#modal').open)$('#modal').close();}
$('#close-modal').addEventListener('click',closeModal);
$('#modal').addEventListener('close',()=>{if(shareURL){URL.revokeObjectURL(shareURL);shareURL=null;}telegramBack(!['entry','home'].includes(state.view));lastFocus?.focus?.();});
function openMore(){closeModal();$('#more-menu').showModal();telegramBack(true);}
$('#close-more').onclick=()=>$('#more-menu').close();
$('#more-menu').addEventListener('close',()=>telegramBack(!['entry','home'].includes(state.view)));
function memorial(){
  $('#more-menu').close();
  if(inTelegram()){
    openModal('remind',`<p>${t('remindInfo')}</p><form id="remind-form"><label class="consent"><input type="checkbox" required><span>${t('remindConsent')}</span></label><button class="primary">${t('remind')}</button><p role="status" id="remind-status"></p></form>`);
    $('#remind-form').addEventListener('submit',async e=>{e.preventDefault();const b=e.currentTarget.querySelector('button');if(b.disabled)return;b.disabled=true;try{const r=await fetch(apiURL('/telegram/remind'),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({initData:initData(),consent:true,consentAt:new Date().toISOString()}),signal:AbortSignal.timeout(12000)});$('#remind-status').textContent=t(r.ok?'registered':'unavailable');}catch{$('#remind-status').textContent=t('unavailable');}finally{b.disabled=false;}});return;
  }
  openModal('memorialTitle',`<p>${t('memorialInfo')}</p><form id="waitlist-form" novalidate><label for="email">${t('email')}</label><input id="email" name="email" type="email" autocomplete="email" maxlength="254" required><label class="consent"><input id="consent" type="checkbox" required><span>${t('consent')}</span></label><p id="form-status" role="status" class="error-inline"></p><button class="primary" type="submit">${t('register')}</button></form><p class="small" style="margin-top:20px">${t('zaloNote')}</p><a href="https://zalo.me/REPLACE_WITH_OFFICIAL_ACCOUNT" aria-disabled="true" id="zalo-link">${t('zalo')}</a>`);
  $('#zalo-link').addEventListener('click',e=>{e.preventDefault();$('#form-status').textContent=t('zaloNote');});
  $('#waitlist-form').addEventListener('submit',submitWaitlist);
}
async function submitWaitlist(e){
  e.preventDefault();const form=e.currentTarget,email=form.email.value.trim(),consent=$('#consent').checked,status=$('#form-status'),submit=form.querySelector('button');
  if(submit.disabled)return;
  if(!form.email.validity.valid||!email||!consent){status.textContent=t('invalid');(!form.email.validity.valid||!email?form.email:$('#consent')).focus();return;}
  submit.disabled=true;submit.textContent=t('sending');status.textContent='';
  try{
    const response=await fetch(apiURL('/waitlist'),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,language:state.lang,consent:true,consentAt:new Date().toISOString()}),signal:AbortSignal.timeout(12000)});
    if(!response.ok){status.textContent=t(response.status===429?'rateLimit':'unavailable');return;}
    const data=await response.json();if(data.ok!==true)throw new Error('invalid response');form.replaceChildren(Object.assign(document.createElement('p'),{textContent:t('registered')}));
  }catch{status.textContent=t('unavailable');}
  finally{submit.disabled=false;submit.textContent=t('register');}
}
function wrap(c,text,x,y,width,lineHeight){let line='';for(const word of text.split(' ')){const next=line?line+' '+word:word;if(c.measureText(next).width>width&&line){c.fillText(line,x,y);line=word;y+=lineHeight;}else line=next;}if(line)c.fillText(line,x,y);return y+lineHeight;}
async function makeShare(){
  if(!state.result)return;
  try{
    await document.fonts.ready;
    paint();const c=document.createElement('canvas');c.width=720;c.height=1280;const x=c.getContext('2d');
    x.fillStyle='#f3ecde';x.fillRect(0,0,720,1280);x.drawImage(canvas,90,0,540,960);
    x.fillStyle='#3d3429';x.textAlign='center';x.font='500 44px "Be Vietnam Pro", sans-serif';
    const key={incense:'shareIncense',bow:'shareBow',sit:'shareSit',beads:'shareBeads'}[state.result.kind];
    wrap(x,t(key,{minutes:(state.result.elapsed/60000).toFixed(1).replace(/\.0$/,'')}),360,1025,640,56);
    x.font='500 28px "Be Vietnam Pro", sans-serif';x.fillText(t('brand'),360,1160);
    x.font='18px "Be Vietnam Pro", sans-serif';x.fillText(t('tagline'),360,1201);x.font='15px sans-serif';x.fillText(location.origin,360,1250);
    shareBlob=await new Promise(resolve=>c.toBlob(resolve,'image/png'));if(!shareBlob)throw new Error('png');shareURL=URL.createObjectURL(shareBlob);
    openModal('shareTitle',`<img class="share-preview" src="${shareURL}" alt="${escapeHTML(t('shareTitle'))}"><div class="row">${button('shareAction','share-file','primary')}${button('download','download')}</div><p id="share-status" role="status"></p>`);
  }catch{$('#notice').textContent=t('shareError');}
}
function download(){if(!shareBlob)return;const url=URL.createObjectURL(shareBlob),a=document.createElement('a');a.href=url;a.download='chua-may.png';a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);}
async function shareFile(){
  if(telegramShare(t('tagline')))return;
  const file=new File([shareBlob],'chua-may.png',{type:'image/png'});
  if(navigator.canShare?.({files:[file]})&&navigator.share){try{await navigator.share({files:[file],title:t('brand')});}catch(e){if(e.name!=='AbortError')$('#share-status').textContent=t('shareError');}}
  else download();
}

document.addEventListener('click',async e=>{
  const b=e.target.closest('button');if(!b||b.disabled)return;
  if(b.dataset.target){state.bowTarget=Number(b.dataset.target);stopActivity();render();paint();return;}
  if(b.dataset.minutes){state.sitMinutes=Number(b.dataset.minutes);render();return;}
  const action=b.dataset.action;if(!action)return;if(state.busy)return;
  switch(action){
    case 'more':openMore();break;
    case 'enter':if(!read('ct-muted',false)&&!audio.enabled)void enableSound(true);await navigate('choose');break;
    case 'change':state.visitor=state.layout.v1_scope.visitors[(state.layout.v1_scope.visitors.indexOf(state.visitor)+1)%6];write('ct-visitor',state.visitor);render();break;
    case 'continue':write('ct-visitor',state.visitor);await navigate('home');break;
    case 'incense':case 'bow':case 'sit':case 'beads':case 'mo':case 'home':await navigate(action);break;
    case 'leave':await navigate('entry');$('#notice').textContent=t('goodbye');break;
    case 'retry':await navigate(state.view);break;
    case 'light':if(!state.activity){state.activity={kind:'incense',running:true,deadline:Date.now()+60000,started:Date.now()};render();}break;
    case 'bow-once':bowOnce();break;
    case 'auto':if(!state.activity){bowOnce();state.activity.auto=true;}else{state.activity.auto=!state.activity.auto;if(state.activity.auto&&state.activity.bowStart==null)bowOnce();}render();break;
    case 'sit-start':state.activity={kind:'sit',running:true,deadline:Date.now()+state.sitMinutes*60000,left:state.sitMinutes*60000,total:state.sitMinutes*60000};audio.ambient(audio.ambientKind);render();animation();break;
    case 'pause':{const a=state.activity;if(!a)break;if(a.running){a.left=remaining(a);a.running=false;const kind=audio.ambientKind;audio.ambient('none');audio.ambientKind=kind;}else{a.deadline=Date.now()+a.left;a.running=true;audio.ambient(audio.ambientKind);}render();animation();break;}
    case 'finish':if(state.activity)complete('sit',state.activity.total-remaining(state.activity));break;
    case 'wood':tapWood();break;
    case 'wood-auto':if(woodAuto)stopWoodAuto();else if(!document.hidden)woodAuto=setInterval(tapWood,1000);render();break;
    case 'bead':bead();break;
    case 'share':await makeShare();break;
    case 'share-file':await shareFile();break;
    case 'download':download();break;
  }
});
$('#memorial').addEventListener('click',memorial);
$('#language').addEventListener('change',e=>{state.lang=e.target.value;closeModal();render();});
$('#sound-toggle').addEventListener('click',()=>{if(audio.enabled){write('ct-muted',true);audio.mute();}else{write('ct-muted',false);void enableSound();}});
$('#volume').addEventListener('input',()=>audio.volume());
document.addEventListener('change',e=>{if(e.target.id==='ambient'){audio.ambientKind=e.target.value;if(state.activity?.running)audio.ambient(e.target.value);};});
reduced.addEventListener('change',()=>{animation();fx();});
document.addEventListener('visibilitychange',async()=>{if(document.hidden){stopWoodAuto();audio.stopBackground();cancelAnimationFrame(drawFrame);if(state.view==='mo')render();}else{await audio.wake();tick();animation();if(state.view==='sit'&&state.activity?.running)audio.ambient(audio.ambientKind);}});
let periodUpdating=false;
async function tick(){
  if(!state.layout||state.busy)return;
  const a=state.activity,now=Date.now();
  if(a?.kind==='bow'&&a.bowStart!=null&&now-a.bowStart>=4000){a.bowStart=null;a.count++;haptic('soft');audio.strike('keisu');if(a.count>=state.bowTarget)complete('bow',a.count*4000);else{render();paint();if(a.auto)bowOnce();}}
  else if(a?.running&&remaining(a)<=0){if(a.kind==='incense')complete('incense',60000);if(a.kind==='sit')complete('sit',a.total);}
  updateCounters();if(state.view==='mo'&&$('#daily-wood'))$('#daily-wood').textContent=t('dailyWood',{count:dailyWood()});
  const period=periodNow();if(period!==state.period&&!periodUpdating){periodUpdating=true;const token=transitionId,view=state.view;try{const assets=await prepare(view,period);if(token===transitionId){state.period=period;renderAssets=assets;render();paint();}}catch{/* Keep the last fully loaded scene on transient failures. */}finally{periodUpdating=false;}}
}
setInterval(tick,200);
async function init(){
  await initTelegram(()=>{if($('#more-menu').open)$('#more-menu').close();else if($('#modal').open)closeModal();else navigate(state.view==='choose'?'entry':'home');},openMore);
  try{const response=await fetch('assets/processed-v1/layout-v1.json');if(!response.ok)throw new Error('layout');state.layout=await response.json();const saved=read('ct-visitor',null);state.visitor=state.layout.v1_scope.visitors.includes(saved)?saved:state.layout.v1_scope.visitors[Math.floor(Math.random()*6)];await navigate('entry');}
  catch{$('#loading').hidden=true;$('#notice').textContent=t('loadError');$('#controls').innerHTML=button('retry','reload');$('#controls').onclick=e=>{if(e.target.dataset.action==='reload')location.reload();};$('#app').setAttribute('aria-busy','false');}
}
init();
