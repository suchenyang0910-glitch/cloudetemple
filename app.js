import {bowFrame} from './bow.js';
import {mountBeads} from './beads.js';
import {createTempleAudio} from './audio.js';
import {assetURL,loadImage,placeholder} from './resources.js';
import {copy,reflections} from './i18n.js';
import {apiURL,initTelegram,inTelegram,initData,telegramBack,telegramAppearance,haptic,telegramShare} from './telegram.js';

const $=s=>document.querySelector(s);
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
const state={view:'entry',lang:'vi',visitor:null,period:'day',layout:null,busy:false,activity:null,result:null,bowTarget:3,sitMinutes:3,wood:0,bead:0,beadRound:1,beadHand:'right'};
const images=new Map(),tinted=new Map();
let beadCleanup=null,pendingView=null,choiceToken=0,choiceFront=0;
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

export function periodNow(date=new Date(),periods=state.layout?.periods??{dawn:"05:00-07:59",day:"08:00-16:59",dusk:"17:00-18:59",night:"19:00-04:59"}){
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
  if(!images.has(name))images.set(name,loadImage(name,t('imageUnavailable')));
  return images.get(name);
}
function sceneName(view=state.view){return ['incense','bow'].includes(view)?'hall-side':['sit','beads','choose'].includes(view)?'courtyard':'hall-front';}
function sceneFile(view=state.view,period=state.period){return `scene-vn-${sceneName(view)}-${period}.webp`;}
function poses(view){return view==='bow'?['bow-1','bow-2','bow-3']:view==='incense'?['bow-1']:view==='sit'?['sit']:view==='beads'?['beads']:[];}
async function prepare(view,period){
  const visitor=state.visitor;
  const scene=await image(sceneFile(view,period));
  const art={};
  for(const pose of (view==='mo'?['mo','mo-mallet']:poses(view))){
    const name=view==='mo'?`${pose}.webp`:`visitor-${visitor}-${pose}.webp`,key=name+period;
    if(!tinted.has(key)){
      const im=await image(name),c=document.createElement('canvas');c.width=im.width;c.height=im.height;
      const x=c.getContext('2d',{willReadFrequently:true});x.drawImage(im,0,0);
      const data=x.getImageData(0,0,c.width,c.height),tone=state.layout.toneRGB[period];
      for(let i=0;i<data.data.length;i+=4){for(let j=0;j<3;j++)data.data[i+j]*=tone[j]*(view==='mo'&&period==='night'?.9:1);}
      x.putImageData(data,0,0);if(!im.placeholder)tinted.set(key,c);else {art[pose]=c;continue;}
    }
    art[pose]=tinted.get(key);
  }
  return {scene,art,view};
}
let renderAssets=null;
function paint(now=performance.now()){
  if(!renderAssets||renderAssets.view!==state.view)return;
  ctx.clearRect(0,0,941,1672);ctx.drawImage(renderAssets.scene,0,0,941,1672);
  const available=poses(state.view);if(!available.length)return;
  let pose=available[0],previous=null,mix=1;
  const a=state.activity;
  if(state.view==='bow'&&a?.bowStart!==null&&a?.bowStart!==undefined){
    const frame=bowFrame(now-a.bowStart,reduced.matches);pose=`bow-${frame.to}`;previous=`bow-${frame.from}`;mix=frame.mix;
  }
  const pos=placement(state.layout,state.visitor,pose),s=state.layout;
  if(sceneName()==='courtyard'){const box=$('.stage').getBoundingClientRect(),space=$('#controls').getBoundingClientRect().top-$('.scene-heading').getBoundingClientRect().bottom-48;const factor=Math.max(.3,Math.min(.72,space/(pos.h*(parseFloat($('.stage').style.getPropertyValue('--scene-width'))||box.width)/941))); pos.x=s.courtyard.x+(pos.x-s.courtyard.x)*factor;pos.y=s.courtyard.bottom+(pos.y-s.courtyard.bottom)*factor;pos.w*=factor;pos.h*=factor;}
  ctx.save();ctx.fillStyle='rgba(34,27,19,.10)';ctx.filter='blur(7px)';ctx.beginPath();
  if(sceneName()==='courtyard')ctx.ellipse(s.courtyard.x,s.courtyard.bottom-3,s.courtyard.cushionWidth*.45,12,0,0,Math.PI*2);
  else ctx.ellipse(s['hall-side'].foot[0]-65,s['hall-side'].foot[1]-2,70,7,0,0,Math.PI*2);
  ctx.fill();ctx.restore();
  const breath=state.view==='sit'&&a?.running&&!reduced.matches?Math.sin(now/4000*Math.PI*2)*3:0;
  if(previous&&mix<1&&renderAssets.art[previous]){ctx.globalAlpha=1-mix;ctx.drawImage(renderAssets.art[previous],pos.x,pos.y,pos.w,pos.h);}
  ctx.globalAlpha=mix;ctx.drawImage(renderAssets.art[pose],pos.x,pos.y+breath,pos.w,pos.h);ctx.globalAlpha=1;
}
function animation(){cancelAnimationFrame(drawFrame);const run=()=>{const now=performance.now();advanceBow(now);paint(now);if((state.view==='bow'&&state.activity?.bowStart!=null)||(state.view==='sit'&&state.activity?.running&&!reduced.matches))drawFrame=requestAnimationFrame(run);};run();}
function fx(){
  const f=state.layout.fx_hall_side,lit=state.view==='incense'&&state.activity?.running,bowing=state.view==='bow';
  $('#effects').innerHTML=`${bowing?`<ellipse class="halo-pulse" cx="${f.halo_center[0]}" cy="${f.halo_center[1]}" rx="92" ry="112" fill="#ffe2a6" opacity=".07"/>`:''}${lit?[-10,0,10].map((dx,i)=>`<circle class="fire" cx="${f.incense_tips[0]+dx}" cy="${f.incense_tips[1]}" r="4"/><path class="smoke" style="animation-delay:-${i*2}s" d="M${f.incense_tips[0]+dx} ${f.incense_tips[1]-5} c-18 -40 30 -65 3 -100 s23 -65 8 -95"/>`).join(''):''}`;
}
function stopActivity(){stopWoodAuto();beadCleanup?.();beadCleanup=null;state.activity=null;cancelAnimationFrame(drawFrame);audio.ambient('none',1,2);}
function prefetch(view){
 const visitor=state.visitor,period=state.period;
 const run=()=>{if(state.visitor!==visitor||state.period!==period||state.view!==view)return;
  const names=['bow-1','bow-2','bow-3','sit','beads'].map(p=>`visitor-${visitor}-${p}.webp`);
  if(view==='home')names.push(...['incense','sit','mo'].map(v=>sceneFile(v,period)),'mo.webp','mo-mallet.webp');
  if(view==='choose')names.push(...state.layout.v1_scope.visitors.map(id=>`visitor-${id}-choose-v1.webp`));
  names.forEach(name=>void image(name));
 };
 if(window.requestIdleCallback)requestIdleCallback(run,{timeout:1500});else setTimeout(run,1000);
}
async function navigate(view,{keepResult=false}={}){
 if(!state.layout){await layoutReady;return navigate(view,{keepResult});}
 if(pendingView===view)return;
 const token=++transitionId;pendingView=view;stopActivity();state.busy=true;
 const old=renderAssets?canvas.cloneNode():null;
 if(old){old.id='scene-old';old.className='scene-surface';old.setAttribute('aria-hidden','true');old.style.cssText=`width:${canvas.getBoundingClientRect().width}px;top:${canvas.offsetTop}px`;old.getContext('2d').drawImage(canvas,0,0);canvas.before(old);}
 state.view=view;state.period=periodNow();if(!keepResult)state.result=null;
 if(view==='mo')woodSession=0;if(view==='beads'){state.bead=0;state.beadRound=1;}if(view==='sit')state.wood=0;
 render();$('#app').setAttribute('aria-busy','true');canvas.style.opacity='0';
 const timer=setTimeout(()=>{if(token===transitionId){$('#loading').hidden=false;$('#loading').textContent=t('loading');}},400);
 try{
  const assets=await prepare(view,state.period);if(token!==transitionId)return;
  renderAssets=assets;state.busy=false;render();paint();animation();
  canvas.style.opacity='1';const duration=reduced.matches?150:300;
  canvas.animate([{opacity:0,filter:reduced.matches?'none':'blur(4px)'},{opacity:1,filter:'none'}],{duration});
  for(const e of [$('.scene-heading'),$('#controls')])e.animate([{opacity:.5},{opacity:1}],{duration:reduced.matches?150:220,delay:reduced.matches?0:80});
  if(old){const a=old.animate([{opacity:1},{opacity:0}],{duration});a.onfinish=()=>old.remove();}
  $('.stage').classList.add('scene-ready');
  if(assets.scene.placeholder){$('#notice').textContent=t('imageUnavailable');$('#controls').insertAdjacentHTML('beforeend',button('retry','retry'));}
  if(['home','choose'].includes(view))prefetch(view);
  if(view==='beads'&&audio.enabled)void audio.load('bead-v1').catch(()=>{});
 }catch{if(token===transitionId){$('#notice').textContent=t('loadError');$('#controls').insertAdjacentHTML('beforeend',button('retry','retry'));canvas.style.opacity='1';}}
 finally{clearTimeout(timer);if(token===transitionId){pendingView=null;state.busy=false;$('#loading').hidden=true;$('#app').setAttribute('aria-busy','false');}else old?.remove();}
}
async function showChoice(){
 const token=++choiceToken,visitor=state.visitor,im=await image(`visitor-${visitor}-choose-v1.webp`);
 if(token!==choiceToken||state.view!=='choose')return;if(im.placeholder){$('#notice').textContent=t('imageUnavailable');if(!$('[data-action=retry-choice]'))$('#controls').insertAdjacentHTML('beforeend',button('retry','retry-choice'));return;}
 const nodes=[...document.querySelectorAll('.choice-image')],slot=nodes[1-choiceFront],old=nodes[choiceFront];if(!slot)return;
 const next=new Image();next.className='choice-image';next.alt=t('choose');next.src=assetURL(`processed-v1/img/visitor-${visitor}-choose-v1.webp`);
 try{await next.decode();}catch{if(token===choiceToken)$('#notice').textContent=t('imageUnavailable');return;}
 if(token!==choiceToken||state.view!=='choose')return;
 // Decode off-DOM; keep the last good image fully opaque underneath each transition.
 old.style.transition='none';old.style.opacity=old.naturalWidth?'1':'0';old.style.zIndex='1';next.style.opacity='0';next.style.zIndex='2';slot.replaceWith(next);
 next.getBoundingClientRect();next.style.opacity='1';choiceFront=1-choiceFront;
 setTimeout(()=>{if(token===choiceToken)old.style.opacity='0';},200);
 document.querySelectorAll('.choice-dots i').forEach((e,i)=>e.classList.toggle('selected',state.layout.v1_scope.visitors[i]===visitor));
 prefetch('choose');fitScene();
}
function changeVisitor(delta=1){const ids=state.layout.v1_scope.visitors;state.visitor=ids[(ids.indexOf(state.visitor)+delta+ids.length)%ids.length];write('ct-visitor',state.visitor);void showChoice();}
function feedback(kind){if(!haptic(kind))try{navigator.vibrate?.(kind==='heavy'?[50,35,70]:kind==='medium'?25:10);}catch{}}
function bounce(e){if(e&&!reduced.matches)e.animate([{transform:'translateY(0)'},{transform:'translateY(-3px)',offset:.4},{transform:'translateY(0)'}],{duration:180});}

function render(){
  const focused=document.activeElement,action=focused?.dataset?.action,target=focused?.dataset?.target,minutes=focused?.dataset?.minutes;
  document.documentElement.lang=state.lang;document.body.dataset.period=state.period;document.body.dataset.view=state.view;document.body.dataset.hand=state.beadHand;
  telegramAppearance(state.period,!!state.activity?.running&&['incense','sit'].includes(state.view));
  document.querySelectorAll('[data-i18n]').forEach(e=>e.textContent=t(e.dataset.i18n));
  $('#language').setAttribute('aria-label',t('language'));$('#controls').setAttribute('aria-label',t('actions'));
  if(inTelegram())$('#memorial').textContent=t('remind');
  telegramBack(!['entry','home'].includes(state.view));
  updateSoundUI();
  $('#sound-controls').hidden=!audio.enabled;
  $('#eyebrow').textContent=t(state.period);
  const heading=state.view==='entry'?'entryTitle':state.view==='choose'?'choose':state.view==='home'?'home':state.view;
  $('#heading').textContent=t(heading)+(state.view==='beads'?' · '+t('beadRound',{n:state.beadRound}):'');$('#subtitle').textContent=t(state.view==='home'?'homeNote':state.view==='entry'||state.view==='choose'?'tagline':`${state.view}Note`);
  canvas.setAttribute('aria-label',t(sceneName()==='hall-front'?'sceneFront':sceneName()==='hall-side'?'sceneSide':'sceneCourt'));
  $('#notice').textContent='';$('#stage-note').textContent='';if(state.view!=='choose')$('#entry-overlay').innerHTML='';
  if(state.view==='entry'){
    $('#controls').innerHTML=button('enter','enter','primary');
  }else if(state.view==='choose'){
    $('#controls').innerHTML=`<div class="choice-dots" aria-hidden="true">${state.layout.v1_scope.visitors.map(()=>'<i></i>').join('')}</div>${button('continue','continue','primary')}`;
    if(!$('.choice-image')){
     $('#entry-overlay').innerHTML=`<div class="choice-person"><img class="choice-image" alt="${escapeHTML(t('choose'))}"><img class="choice-image" alt="" aria-hidden="true"></div><button class="choice-arrow previous" data-action="previous" aria-label="${escapeHTML(t('change'))}">‹</button><button class="choice-arrow next" data-action="change" aria-label="${escapeHTML(t('change'))}">›</button>`;
     let x=null;$('#entry-overlay').onpointerdown=e=>{x=e.clientX;};$('#entry-overlay').onpointerup=e=>{if(x!==null&&Math.abs(e.clientX-x)>35)changeVisitor(e.clientX<x?1:-1);x=null;};
    }void showChoice();
  }else if(state.view==='home'){
    $('#controls').innerHTML=`<nav class="action-nav">${['incense','bow','sit','mo','beads','leave'].map(key=>`<button data-action="${key}"><svg class="nav-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${actionIcons[key]}</svg>${t(key)}</button>`).join('')}</nav>`;
  }else if(state.view==='leave'){
    $('#controls').innerHTML=`<p class="leave-message">${t('goodbye')}</p>${button('reenter','reenter','primary')}`;
  }else if(state.result){
    $('#controls').innerHTML=`<div class="completion"><p>${reflections[state.result.reflection][state.lang]}</p>${state.result.kind==='beads'?button('beadAgain','bead-again','primary'):''}<div class="row">${button('share','share',state.result.kind==='beads'?'text-button':'primary')}${button('back','home')}</div></div>`;
    $('#subtitle').textContent=t('completed');
  }else if(state.view==='incense'){
    $('#controls').innerHTML=`<div class="stack"><div id="incense-status" class="section-label"></div><div class="incense-stick" aria-hidden="true"><span id="incense-progress"></span></div><div class="row">${button('light','light','primary',state.activity?'disabled':'')}${button('back','home')}</div></div>`;
  }else if(state.view==='bow'){
    const a=state.activity;
    $('#controls').innerHTML=`<div class="stack"><p class="section-label">${t('bowTarget')}</p><div class="choice-row">${[3,27,54,108].map(n=>`<button data-target="${n}" aria-pressed="${state.bowTarget===n}" ${a?.bowStart!=null?'disabled':''}>${n}</button>`).join('')}</div><p class="count" id="bow-count">${a?.count??0} / ${state.bowTarget}</p><div class="row">${button('bowOnce','bow-once','primary',a?.bowStart!=null?'disabled':'')}${button(a?.auto?'stopAuto':'auto','auto','',`aria-pressed="${!!a?.auto}"`)}</div>${button('back','home','back-button')}</div>`;
  }else if(state.view==='sit'){
    const a=state.activity;
    $('#controls').innerHTML=`<div class="stack"><p class="timer" id="timer" role="timer">${formatTime(a?remaining(a):state.sitMinutes*60000)}</p>${!a?`<div class="choice-row" aria-label="${t('duration')}">${[1,3,5,10].map(n=>`<button data-minutes="${n}" aria-pressed="${state.sitMinutes===n}">${n} ${t('minutes')}</button>`).join('')}</div>`:''}<div class="row">${!a?button('start','sit-start','primary'):button(a.running?'pause':'resume','pause','primary')}${a?button('finish','finish'):''}${a?button('wood','wood'):''}</div><p class="section-label" id="wood-count" ${!a?'hidden':''}>${t('woodCount')}: ${state.wood}</p><div class="row"><label class="ambient-label" for="ambient">${t('ambient')}</label><div class="choice-row ambient-options">${['none','forest','rain'].map(k=>`<button data-ambient="${k}" aria-pressed="${audio.ambientKind===k}">${t(k)}</button>`).join('')}</div></div>${button('back','home','back-button')}</div>`;
  }else if(state.view==='mo'){
    $('#controls').innerHTML=`<div class="stack"><p id="daily-wood" class="count">${t('dailyWood',{count:dailyWood()})}</p><p id="wood-message" role="status">${woodSession>=108?t('wood108'):''}</p><div class="row">${button(woodAuto?'woodStop':'woodAuto','wood-auto','primary',`aria-pressed="${!!woodAuto}"`)}${button('back','home')}</div></div>`;
  }else if(state.view==='beads'){
    $('#controls').innerHTML=`<div class="beads-area"><button class="bead-control" id="bead-control" data-action="bead" aria-label="${escapeHTML(t('beadAction'))}"><span class="bead-thread" aria-hidden="true"></span><span class="thumb-point" aria-hidden="true"></span><span class="bead-track" aria-hidden="true">${Array.from({length:13},()=>'<i class="strand-bead"></i>').join('')}</span></button></div><div class="bead-summary"><span id="bead-count" role="status" aria-live="polite">${Math.min(108,state.bead)} / 108</span>${button(state.beadHand==='left'?'leftHand':'rightHand','bead-hand','','aria-label="'+escapeHTML(t('switchHand'))+'"')}</div>${button('back','home','back-button')}`;
    beadCleanup?.();beadCleanup=mountBeads($('#bead-control'),{step:bead,count:state.bead,reduced:reduced.matches,left:state.beadHand==='left'});
  }
  $('#more-toggle').hidden=false;$('#more-toggle').setAttribute('aria-label',t('more'));
  $('#wood-prop').hidden=state.view!=='mo'||state.busy;$('#mallet-prop').hidden=state.view!=='mo'||state.busy;
  $('#wood-prop').setAttribute('aria-label',t('wood'));
  if(state.view==='mo'&&renderAssets?.art.mo&&!state.busy)for(const [id,key] of [['wood-art','mo'],['mallet-prop','mo-mallet']]){const c=$('#'+id),im=renderAssets.art[key];c.width=im.width;c.height=im.height;c.getContext('2d').drawImage(im,0,0);}
  if(state.layout)fx();updateCounters();if(state.view==='bow')syncBowControls();fitScene();
  if(focused&&!focused.isConnected){const replacement=action?document.querySelector(`[data-action="${action}"]`):target?document.querySelector(`[data-target="${target}"]`):minutes?document.querySelector(`[data-minutes="${minutes}"]`):null;if(replacement&&!replacement.disabled)replacement.focus({preventScroll:true});}
}
function fitScene(){
  if(!renderAssets)return;
  const stage=$('.stage'),heading=$('.scene-heading').getBoundingClientRect(),controls=$('#controls').getBoundingClientRect(),box=stage.getBoundingClientRect();
  // Cover would crop the Buddha and visitor on opposite edges; preserve their shared region.
  const top=heading.bottom-box.top+8,bottom=controls.top-box.top-8;
  const region=sceneName()==='hall-side'?[300,1280]:sceneName()==='courtyard'?[420,state.layout.courtyard.bottom+(state.view==='beads'?360:42)]:[300,1400];
  const fullScene=['entry','choose','home','leave','mo'].includes(state.view);
  const scale=fullScene||sceneName()==='courtyard'?Math.max(box.width/941,box.height/1672):box.width/941;
  let sceneTop=fullScene?(box.height-1672*scale)/2:state.view==='mo'?0:Math.min(top-region[0]*scale,bottom-region[1]*scale);
  if(sceneName()==='courtyard'&&!fullScene)sceneTop=Math.max(sceneTop,bottom+8-1672*scale);
  stage.style.setProperty('--scene-width',941*scale+'px');
  stage.style.setProperty('--scene-top',sceneTop+'px');
  stage.style.setProperty('--scene-image','none');
  if(state.view==='choose'){const overlay=$('#entry-overlay'),pos=placement(state.layout,state.visitor,'sit');overlay.style.top='0';overlay.style.bottom='0';const person=$('.choice-person');if(person)person.style.cssText=`inset:auto;left:${(box.width-941*scale)/2+pos.x*scale-20}px;top:${sceneTop+pos.y*scale}px;width:${pos.w*scale}px;height:${pos.h*scale}px;max-width:none;margin:0`;}
  if(state.view==='mo'&&renderAssets.art.mo){const width=box.width*.40,art=renderAssets.art.mo,height=width*art.height/art.width;$('#wood-prop').style.cssText=`width:${width}px;height:${height}px;left:${(box.width-width)/2}px;top:${controls.top-box.top-16-height}px`;$('#mallet-prop').style.cssText=`width:${width*.49}px;height:auto;left:${(box.width+width)/2-8}px;top:${controls.top-box.top-16-height-8}px`;}
}
new ResizeObserver(fitScene).observe($('#app'));
new ResizeObserver(fitScene).observe($('#controls'));
function formatTime(ms){const seconds=Math.ceil(Math.max(0,ms)/1000);return `${Math.floor(seconds/60).toString().padStart(2,'0')}:${(seconds%60).toString().padStart(2,'0')}`;}
function remaining(a){return a.running?Math.max(0,a.deadline-Date.now()):a.left;}
function updateCounters(){
  const a=state.activity;
  if(state.view==='incense'&&a){const left=remaining(a);if($('#incense-progress'))$('#incense-progress').style.transform=`scaleY(${left/60000})`;if($('#incense-status'))$('#incense-status').textContent=`${t('burning')} · ${formatTime(left)}`;}
  if(state.view==='sit'&&a&&$('#timer'))$('#timer').textContent=formatTime(remaining(a));
}
function complete(kind,elapsed=0){
  if(state.result)return;
  const old=state.activity;
  state.result={kind,elapsed,count:kind==='bow'?old?.count:kind==='beads'?108:1,reflection:Math.floor(Math.random()*reflections.length)};
  const stored=read('ct-totals',{}),count=Number.isFinite(stored?.count)&&stored.count>=0?stored.count:0,seconds=Number.isFinite(stored?.seconds)&&stored.seconds>=0?stored.seconds:0;
  write('ct-totals',{count:count+1,seconds:seconds+Math.round(elapsed/1000)});
  stopActivity();audio.strike('bell',kind==='bow'?.8:1);if(['incense','bow'].includes(kind))feedback('medium');render();paint();$('.scene-heading').animate([{opacity:.65},{opacity:1}],{duration:reduced.matches?150:200});
}
function syncBowControls(){
 const a=state.activity,active=a?.bowStart!=null;
 const counter=$('#bow-count');if(!counter)return;
 counter.textContent=`${a?.count??0} / ${state.bowTarget}`;
 const once=$('[data-action=bow-once]'),auto=$('[data-action=auto]');
 once.disabled=active;once.classList.toggle('primary',!a?.auto);
 auto.textContent=t(a?.auto?'stopAuto':'auto');auto.setAttribute('aria-pressed',String(!!a?.auto));auto.classList.toggle('primary',!!a?.auto);
 document.querySelectorAll('[data-target]').forEach(e=>{e.disabled=active;});
}
function advanceBow(now){
 const a=state.activity;if(state.view!=='bow'||a?.bowStart==null)return;
 const elapsed=now-a.bowStart;
 if(!a.struck&&elapsed>=1200){a.struck=true;audio.strike('keisu');feedback('soft');}
 if(!a.counted&&elapsed>=3200){a.counted=true;a.count++;syncBowControls();}
 if(a.count>=state.bowTarget&&elapsed>=3700){complete('bow',a.count*3800);return;}
 if(elapsed>=3800){a.bowStart=null;if(a.auto)Object.assign(a,{bowStart:now,struck:false,counted:false});syncBowControls();}
}
function bowOnce(now=performance.now()){
 if(state.result||state.activity?.bowStart!=null||state.activity?.count>=state.bowTarget)return;
 state.activity??={kind:'bow',count:0,auto:false,bowStart:null,started:now};
 Object.assign(state.activity,{bowStart:now,struck:false,counted:false});syncBowControls();animation();
}

function bead(){
  if(state.result||state.bead>=109)return;
  state.activity??={kind:'beads',started:Date.now()};state.bead++;
  const marker=[27,54,81].includes(state.bead);
  feedback(state.bead===109?'heavy':marker?'medium':'light');
  if(!audio.strike('bead-v1',1,.97+Math.random()*.06))audio.strike('wood',.35,1.6);
  if(state.bead===109)complete('beads',Date.now()-state.activity.started);
  else {if(marker)audio.strike('keisu',.25);$('#bead-count').textContent=`${Math.min(108,state.bead)} / 108`;bounce($('#bead-count'));}
}

export const audio=createTempleAudio({onChange:updateSoundUI,onError:()=>showSoundHint('soundUnavailable',6000),volume:()=>Number($('#volume').value)/100});
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
 if(await pending){audio.strike('bell',.6);if(state.view==='sit'&&state.activity?.running)audio.ambient(audio.ambientKind);if(state.view==='incense'&&state.activity?.running)audio.ambient('forest',.6,2);if(state.view==='beads')void audio.load('bead-v1').catch(()=>{});}
}
function localDay(){const d=new Date();return `${d.getFullYear()}-${d.getMonth()+1}-${d.getDate()}`;}
function dailyWood(){const stored=read('ct-wood',{});if(stored.day===localDay()&&Number.isSafeInteger(stored.count)&&stored.count>=0)return stored.count;return 0;}
function stopWoodAuto(){if(woodAuto){clearInterval(woodAuto);woodAuto=null;}}
function tapWood(){
 const count=dailyWood()+1;write('ct-wood',{day:localDay(),count});audio.strike('wood');
 if(state.view==='mo'){
  woodSession++;$('#daily-wood').textContent=t('dailyWood',{count});if(woodSession===108){$('#wood-message').textContent=t('wood108');audio.strike('bell',.5);}bounce($('#daily-wood'));
  if(!haptic('light'))try{navigator.vibrate?.(10);}catch{}
  if(!reduced.matches){
   const mallet=$('#mallet-prop');mallet.getAnimations().forEach(a=>a.cancel());mallet.animate([{transform:'translate(0,0) rotate(0deg)'},{transform:'translate(-24px,25px) rotate(-12deg)',offset:.5},{transform:'translate(0,0) rotate(0deg)'}],{duration:140});
   const art=$('#wood-art');art.getAnimations().forEach(a=>a.cancel());art.animate([{transform:'scale(1)'},{transform:'scale(.97)',offset:.5},{transform:'scale(1)'}],{duration:140});
   const ring=document.createElement('span');ring.className='wood-ripple';$('#wood-prop').append(ring);ring.animate([{transform:'scale(.3)',opacity:.25},{transform:'scale(1.2)',opacity:0}],{duration:650}).onfinish=()=>ring.remove();
  }
 }else if(state.view==='sit'){feedback('light');state.wood++;$('#wood-count').textContent=`${t('woodCount')}: ${state.wood}`;}
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
  if(b.dataset.ambient){audio.ambientKind=b.dataset.ambient;if(state.activity?.running)void audio.ambient(b.dataset.ambient);render();return;}
  if(b.dataset.minutes){state.sitMinutes=Number(b.dataset.minutes);render();return;}
  const action=b.dataset.action;if(!action)return;
  switch(action){
    case 'more':openMore();break;
    case 'enter':if(!read('ct-muted',false)&&!audio.enabled)void enableSound(true);await navigate('choose');break;
    case 'change':changeVisitor();break;
    case 'previous':changeVisitor(-1);break;
    case 'continue':write('ct-visitor',state.visitor);await navigate('home');break;
    case 'incense':case 'bow':case 'sit':case 'beads':case 'mo':case 'home':await navigate(action);break;
    case 'leave':audio.strike('bell',.5);await navigate('leave');break;
    case 'reenter':await navigate('entry');break;
    case 'retry-choice':images.delete(`visitor-${state.visitor}-choose-v1.webp`);b.remove();void showChoice();break;
    case 'retry':images.clear();tinted.clear();await navigate(state.view);break;
    case 'light':if(!state.activity){state.activity={kind:'incense',running:true,deadline:Date.now()+60000,started:Date.now()};audio.strike('keisu',.6);feedback('soft');void audio.ambient('forest',.6,2);render();}break;
    case 'bow-once':bowOnce();break;
    case 'auto':if(!state.activity){bowOnce();state.activity.auto=true;}else{state.activity.auto=!state.activity.auto;if(state.activity.auto&&state.activity.bowStart==null)bowOnce();}syncBowControls();break;
    case 'sit-start':state.activity={kind:'sit',running:true,deadline:Date.now()+state.sitMinutes*60000,left:state.sitMinutes*60000,total:state.sitMinutes*60000};audio.ambient(audio.ambientKind);render();animation();break;
    case 'pause':{const a=state.activity;if(!a)break;if(a.running){a.left=remaining(a);a.running=false;const kind=audio.ambientKind;audio.ambient('none');audio.ambientKind=kind;}else{a.deadline=Date.now()+a.left;a.running=true;audio.ambient(audio.ambientKind);}render();animation();break;}
    case 'finish':if(state.activity)complete('sit',state.activity.total-remaining(state.activity));break;
    case 'wood':tapWood();break;
    case 'wood-auto':if(woodAuto)stopWoodAuto();else if(!document.hidden)woodAuto=setInterval(tapWood,1000);render();break;
    case 'bead':break;
    case 'bead-hand':state.beadHand=state.beadHand==='left'?'right':'left';write('ct-bead-hand',state.beadHand);render();break;
    case 'bead-again':state.result=null;state.bead=0;state.beadRound++;render();paint();$('#bead-control').focus({preventScroll:true});break;
    case 'share':await makeShare();break;
    case 'share-file':await shareFile();break;
    case 'download':download();break;
  }
});
$('#memorial').addEventListener('click',memorial);
$('#language').addEventListener('change',e=>{state.lang=e.target.value;closeModal();render();});
$('#sound-toggle').addEventListener('click',()=>{if(audio.enabled){write('ct-muted',true);audio.mute();}else{write('ct-muted',false);void enableSound();}});
const savedVolume=read('ct-volume',80);$('#volume').value=typeof savedVolume==='number'&&Number.isFinite(savedVolume)&&savedVolume>=0&&savedVolume<=100?savedVolume:80;
state.beadHand=read('ct-bead-hand','right')==='left'?'left':'right';
$('#volume').addEventListener('input',()=>{write('ct-volume',Number($('#volume').value));audio.volume();});
$('#controls').addEventListener('pointerdown',e=>{const action=e.target.closest('[data-action]')?.dataset.action;if(action==='enter')void image(`visitor-${state.visitor}-sit.webp`);else if(['incense','bow','sit','beads','mo'].includes(action))void image(sceneFile(action,periodNow()));});
document.addEventListener('click',()=>{void audio.wake();},true);
reduced.addEventListener('change',()=>{animation();fx();if(state.view==='beads')render();});
document.addEventListener('visibilitychange',async()=>{if(document.hidden){stopWoodAuto();audio.stopBackground();cancelAnimationFrame(drawFrame);if(state.view==='mo')render();}else{await audio.wake();tick();animation();if(state.view==='sit'&&state.activity?.running)audio.ambient(audio.ambientKind);if(state.view==='incense'&&state.activity?.running)audio.ambient('forest',.6,2);if(state.view==='beads')void audio.load('bead-v1').catch(()=>{});}});
let periodUpdating=false;
async function tick(){
  if(!state.layout||state.busy)return;
  const a=state.activity,now=Date.now();
  if(a?.running&&remaining(a)<=0){if(a.kind==='incense')complete('incense',60000);if(a.kind==='sit')complete('sit',a.total);}
  updateCounters();if(state.view==='mo'&&$('#daily-wood'))$('#daily-wood').textContent=t('dailyWood',{count:dailyWood()});
  const period=periodNow();if(period!==state.period&&!periodUpdating){periodUpdating=true;const token=transitionId,view=state.view;try{const assets=await prepare(view,period);if(token===transitionId){state.period=period;renderAssets=assets;render();paint();}}catch{/* Keep the last fully loaded scene on transient failures. */}finally{periodUpdating=false;}}
}
setInterval(tick,200);
let resolveLayout;const layoutReady=new Promise(resolve=>resolveLayout=resolve);
async function init(){
  state.period=periodNow();document.body.dataset.period=state.period;$('#eyebrow').textContent=t(state.period);$('#subtitle').textContent=t('tagline');updateSoundUI();
  await initTelegram(()=>{if($('#more-menu').open)$('#more-menu').close();else if($('#modal').open)closeModal();else navigate(state.view==='choose'?'entry':'home');},openMore);
  try{const response=await fetch(assetURL('processed-v1/layout-v1.json'),{credentials:'omit'});if(!response.ok)throw new Error('layout');state.layout=await response.json();const saved=read('ct-visitor',null);state.visitor=state.layout.v1_scope.visitors.includes(saved)?saved:state.layout.v1_scope.visitors[Math.floor(Math.random()*6)];state.period=periodNow();resolveLayout();if(!transitionId)await navigate('entry');}
  catch{$('#loading').hidden=true;$('#notice').textContent=t('loadError');$('#controls').innerHTML=button('retry','reload');$('#controls').onclick=e=>{if(e.target.dataset.action==='reload')location.reload();};$('#app').setAttribute('aria-busy','false');}
}
performance.mark('ct-interactive');
init();
