import {bowFrame} from './bow.js';
import {mountBeads} from './beads.js';
import {beadGuruRule,beadMotionConfig} from './config.js';
import {createTempleAudio} from './audio.js';
import {assetURL,loadImage,placeholder,enableImageDebug} from './resources.js';
import {copy,reflections,shareCopy} from './i18n.js';
import {apiURL,initTelegram,inTelegram,initData,telegramBack,telegramAppearance,haptic,telegramShare,telegramStory,telegramStartParam} from './telegram.js';
import {createMorning} from './morning.js';
import {getFestivalPeriod,createNewYearBell,hasForbiddenWord,readFlower,writeFlower} from './festival.js';
import {incenseConfig,incenseVisual,incensePhaseDone} from './incense.js';

let analytics,woodStarted;
let festivalPeriod=getFestivalPeriod(),newYearBell;
let familyEnabled=false;
const event=(name,params)=>analytics?.event(name,params);
function completed(activity,ms,n){event('activity_complete',{activity,duration_bucket:ms<60000?'<1m':ms<180000?'1-3m':ms<=600000?'3-10m':'>10m',count_bucket:n>=108?'108+':n>=54?'54-107':n>=27?'27-53':n>1?'2-26':'1'})}
const $=s=>document.querySelector(s);
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
const state={view:'entry',lang:'vi',visitor:null,period:'day',layout:null,busy:false,activity:null,incense:null,result:null,bowTarget:3,sitMinutes:1,sitOptionsOpen:false,wood:0,moFrame:1,breathGuide:false,breathPattern:'4-6',bead:0,beadRound:1,beadDirection:1,beadHand:'right',beadFrame:1};
const images=new Map(),tinted=new Map();
let beadCleanup=null,pendingView=null,choiceToken=0,choiceFront=0;
let transitionId=0,drawFrame=0,lastFocus=null,shareBlob=null,shareURL=null;
let beadMotionTimer=0,beadMotionRaf=0,beadLastStep=-Infinity,beadAnnounced=-1;
const launchParams=new URLSearchParams(location.search),launchSources=new Set(['system','zalo','facebook','messenger','copy','recommend']),launchActivities=new Set(['incense','bow','sit','mo','beads']);
const launchAttribution={source:launchSources.has(launchParams.get('s'))?launchParams.get('s'):'',activity:launchActivities.has(launchParams.get('a'))?launchParams.get('a'):''};
let pendingLaunchActivity=launchAttribution.activity;
if(launchParams.get('lang')==='en')state.lang='en';
if(['s','a'].some(k=>launchParams.has(k))){launchParams.delete('s');launchParams.delete('a');history.replaceState(history.state,'',location.pathname+(launchParams.size?'?'+launchParams:'')+location.hash);}
document.documentElement.classList.add('js-ready');
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
  leave:'<path d="M4 21V3h12v6M2 21h14v-4m-5-4h11m-4-4 4 4-4 4"/>',
  memorial:'<path d="M5 21h14M7 21V9h10v12M9 9V4h6v5M10 13h4m-2-2v4"/>'
};
const read=(key,fallback)=>{try{return JSON.parse(localStorage.getItem(key))??fallback;}catch{return fallback;}};
const write=(key,value)=>{try{localStorage.setItem(key,JSON.stringify(value));}catch{/* Private browsing still permits a complete visit. */}};
const breathPatterns={'4-6':[4,6],'4-4':[4,4],'5-7':[5,7]};
state.sitMinutes=[1,3,5,10].includes(read('ct-sit-minutes',1))?read('ct-sit-minutes',1):1;
state.breathGuide=read('ct-breath-guide',false)===true;
state.breathPattern=breathPatterns[read('ct-breath-pattern','4-6')]?read('ct-breath-pattern','4-6'):'4-6';

export function breathFrame(now,start,pattern='4-6'){
  const [inhale,exhale]=breathPatterns[pattern]??breathPatterns['4-6'],cycle=(inhale+exhale)*1000,elapsed=Math.max(0,now-start)%cycle;
  if(elapsed<inhale*1000){const p=elapsed/(inhale*1000);return {phase:'inhale',scale:1+.0075*(1-Math.cos(Math.PI*p)),progress:p};}
  const p=(elapsed-inhale*1000)/(exhale*1000);return {phase:'exhale',scale:1.015-.0075*(1-Math.cos(Math.PI*p)),progress:p};
}

export function periodNow(date=new Date(),periods=state.layout?.periods??{dawn:"05:00-07:59",day:"08:00-16:59",dusk:"17:00-18:59",night:"19:00-04:59"}){
  const minute=date.getHours()*60+date.getMinutes();
  for(const [name,range] of Object.entries(periods)){
    const [start,end]=range.split('-').map(x=>{const [h,m]=x.split(':').map(Number);return h*60+m;});
    if(start<=end ? minute>=start&&minute<=end : minute>=start||minute<=end)return name;
  }
  return 'day';
}
export function placement(layout,id,pose){
  if(pose==='stand')return {x:193,y:1018,w:240,h:360};
  if(pose.startsWith('mo-')||pose.startsWith('beads-side-'))return {x:350,y:838,w:397,h:397};
  if(pose.startsWith('bow-')){
    const s=layout['hall-side'],scale=s.bowCanvasWidth/s.sourceCanvas[0];
    return {x:s.foot[0]-s.anchor[0]*scale,y:s.foot[1]-s.anchor[1]*scale-(pose.startsWith('bow-')?0:55),w:s.sourceCanvas[0]*scale,h:s.sourceCanvas[1]*scale};
  }
  const a=layout.front_image_anchors[`visitor-${id}-${pose}.webp`],s=layout.courtyard,scale=s.cushionWidth/a.cushionWidth;
  return {x:s.x-a.cushionBottomCenter[0]*scale,y:s.bottom-a.cushionBottomCenter[1]*scale,w:600*scale,h:900*scale};
}
function image(name){
  if(!images.has(name)){
    const pending=loadImage(name,t('imageUnavailable'));images.set(name,pending);
    pending.then(im=>{if(im.placeholder&&images.get(name)===pending)images.delete(name);});
  }
  return images.get(name);
}
function sceneName(view=state.view){return ['incense','bow','mo','beads'].includes(view)?'hall-side':['sit','choose'].includes(view)?'courtyard':'hall-front';}
function sceneFile(view=state.view,period=state.period){return view==='incense'?`scene-vn-hall-side-incense-patch-${period}.webp`:['mo','beads'].includes(view)?`scene-vn-hall-side-floor-${period}.webp`:`scene-vn-${sceneName(view)}-${period}.webp`;}
const incensePoses=['inc-walk-1','inc-walk-2','inc-hold','inc-light','inc-vai-1','inc-vai-2','inc-plant-1','inc-end'];
function poses(view){return view==='morning'?['stand']:view==='bow'?['bow-1','bow-2','bow-3']:view==='incense'?incensePoses:view==='mo'?['mo-1-v3','mo-2-v3','mo-3-v3']:view==='sit'?['sit']:view==='beads'?['beads-side-1-v1','beads-side-2-v1','beads-side-3-v1']:[];}
const morning=createMorning({event});
const artFile=(visitor,pose)=>`visitor-${visitor}-${pose}${pose.startsWith('inc-')?'-v1':pose==='sit'||pose==='beads'?'-nocushion':''}.webp`;
async function prepare(view,period){
  const visitor=state.visitor;
  const scene=await image(sceneFile(view,period));
  const art={};let missing=!!scene.placeholder;
  if(view==='beads')missing=(await Promise.all(['wood','spacer','guru'].map(kind=>image(`bead-${kind}-v2.webp`)))).some(im=>im.placeholder)||missing;
  for(const pose of poses(view)){
    const name=artFile(visitor,pose),key=name+period;
    if(!tinted.has(key)){
      const im=await image(name),c=document.createElement('canvas');c.width=im.width;c.height=im.height;
      const x=c.getContext('2d',{willReadFrequently:true});x.drawImage(im,0,0);
      const data=x.getImageData(0,0,c.width,c.height),tone=state.layout.toneRGB[period];
      for(let i=0;i<data.data.length;i+=4){for(let j=0;j<3;j++)data.data[i+j]*=tone[j]*(['mo','beads','incense'].includes(view)&&period==='night'?.9:1);}
      x.putImageData(data,0,0);if(!im.placeholder)tinted.set(key,c);else {missing=true;art[pose]=c;continue;}
    }
    art[pose]=tinted.get(key);
  }
  const props={},toneProp=async name=>{const key=`prop:${name}:${period}`;if(!tinted.has(key)){const im=await image(name),c=document.createElement('canvas');c.width=im.width;c.height=im.height;const x=c.getContext('2d',{willReadFrequently:true});x.drawImage(im,0,0);const data=x.getImageData(0,0,c.width,c.height),tone=state.layout.toneRGB[period],extra=period==='night'?.9:1;for(let i=0;i<data.data.length;i+=4)for(let j=0;j<3;j++)data.data[i+j]*=tone[j]*extra;x.putImageData(data,0,0);tinted.set(key,c);}return tinted.get(key);};
  if(['mo','beads'].includes(view))props.cushion=await toneProp('hall-cushion-v2.webp');
  if(view==='mo')for(const name of ['mo-low-table-v2.webp','mo-v6.webp'])props[name]=await toneProp(name);
  return {scene,art,props,view,missing};
}
let renderAssets=null;
function paint(now=performance.now()){
  if(!renderAssets||renderAssets.view!==state.view)return;
  ctx.clearRect(0,0,941,1672);ctx.drawImage(renderAssets.scene,0,0,941,1672);
  const available=poses(state.view);if(!available.length)return;
  let pose=state.view==='mo'?`mo-${state.moFrame}-v3`:state.view==='beads'?`beads-side-${state.beadFrame}-v1`:state.view==='incense'?incenseVisual(now,state.incense,reduced.matches).pose:available[0],previous=null,mix=1;
  const a=state.activity;
  if(state.view==='bow'&&a?.bowStart!==null&&a?.bowStart!==undefined){
    const frame=bowFrame(now-a.bowStart,reduced.matches);pose=`bow-${frame.to}`;previous=`bow-${frame.from}`;mix=frame.mix;
  }
  const visual=state.view==='incense'?incenseVisual(now,state.incense,reduced.matches):null;
  const pos=visual?{x:visual.footX-380*(391/560),y:visual.footY-930*(671/960),w:391,h:671}:placement(state.layout,state.visitor,pose),s=state.layout;
  canvas.dataset.cushionPolicy=state.view==='incense'?'hidden':'scene';canvas.dataset.pose=pose;canvas.dataset.visitor=state.visitor;
  if(sceneName()==='courtyard'){const box=$('.stage').getBoundingClientRect(),space=$('#controls').getBoundingClientRect().top-$('.scene-heading').getBoundingClientRect().bottom-48;const factor=Math.max(.3,Math.min(.72,space/(pos.h*(parseFloat($('.stage').style.getPropertyValue('--scene-width'))||box.width)/941))); pos.x=s.courtyard.x+(pos.x-s.courtyard.x)*factor;pos.y=s.courtyard.bottom+(pos.y-s.courtyard.bottom)*factor;pos.w*=factor;pos.h*=factor;}
  const shift=0;
  pos.x+=shift;
  ctx.save();ctx.fillStyle='rgba(34,27,19,.10)';ctx.filter='blur(7px)';ctx.beginPath();
  if(sceneName()==='courtyard')ctx.ellipse(s.courtyard.x+shift,s.courtyard.bottom-3,s.courtyard.cushionWidth*.45,12,0,0,Math.PI*2);
  else if(state.view==='incense')ctx.ellipse(visual.footX-28,visual.footY-2,62,7,0,0,Math.PI*2);
  else ctx.ellipse(s['hall-side'].foot[0]-65,s['hall-side'].foot[1]-2,70,7,0,0,Math.PI*2);
  ctx.fill();ctx.restore();
  if(state.view==='sit'&&a?.running&&state.breathGuide){
    const frame=breathFrame(now,a.breathStarted,state.breathPattern);updateBreathCue(frame.phase);
    if(!reduced.matches){const dw=pos.w*(frame.scale-1),dh=pos.h*(frame.scale-1);pos.x-=dw/2;pos.y-=dh;pos.w+=dw;pos.h+=dh;}
  }
  const drawProp=(im,x,y,w,h)=>ctx.drawImage(im,x,y,w,h);
  if(['mo','beads'].includes(state.view))drawProp(renderAssets.props.cushion,484,1163,282,129);
  if(state.view==='mo'){
    drawProp(renderAssets.props['mo-low-table-v2.webp'],285,1140,259,117);
    drawProp(renderAssets.props['mo-v6.webp'],426,1053,124,124);
  }
  if(previous&&mix<1&&renderAssets.art[previous]){ctx.globalAlpha=1-mix;ctx.drawImage(renderAssets.art[previous],pos.x,pos.y,pos.w,pos.h);}
  ctx.globalAlpha=mix;ctx.drawImage(renderAssets.art[pose],pos.x,pos.y,pos.w,pos.h);ctx.globalAlpha=1;
  if(state.view==='incense'&&state.incense?.planted){
    ctx.save();ctx.strokeStyle='#6b3b25';ctx.lineWidth=3;for(const dx of [-8,0,8]){ctx.beginPath();ctx.moveTo(288+dx,872);ctx.lineTo(288+dx,798);ctx.stroke();ctx.fillStyle='#df6d32';ctx.beginPath();ctx.arc(288+dx,798,3.5,0,Math.PI*2);ctx.fill();if(!reduced.matches){ctx.strokeStyle='rgba(100,89,76,.42)';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(288+dx,793);ctx.bezierCurveTo(276+dx,770,300+dx,748,286+dx,724);ctx.stroke();ctx.strokeStyle='#6b3b25';ctx.lineWidth=3;}}
    ctx.restore();
  }
}
function animation(){cancelAnimationFrame(drawFrame);const run=()=>{const now=performance.now();advanceBow(now);advanceIncense(now);paint(now);if((state.view==='bow'&&state.activity?.bowStart!=null)||(state.view==='sit'&&state.activity?.running&&state.breathGuide&&!reduced.matches)||(state.view==='incense'&&state.incense&&!reduced.matches))drawFrame=requestAnimationFrame(run);};run();}
function fx(){
  const f=state.layout.fx_hall_side,bowing=state.view==='bow';
  $('#effects').innerHTML=bowing?`<ellipse class="halo-pulse" cx="${f.halo_center[0]}" cy="${f.halo_center[1]}" rx="92" ry="112" fill="#ffe2a6" opacity=".07"/>`:'';
}
function stopActivity(){stopWoodAuto();stopWoodMotion();stopBeadMotion();clearTimeout(finishTimer);clearTimeout(incenseReadyTimer);beadCleanup?.();beadCleanup=null;state.activity=null;state.incense=null;cancelAnimationFrame(drawFrame);audio.ambient('none',1,2);audio.stopBreathing(2);updateBreathCue();}
function prefetch(view){
 const visitor=state.visitor,period=state.period;
 const run=()=>{if(state.visitor!==visitor||state.period!==period||state.view!==view)return;
  const names=['bow-1','bow-2','bow-3','sit','beads','beads-side-1-v1','beads-side-2-v1','beads-side-3-v1','mo-1-v3','mo-2-v3','mo-3-v3'].map(p=>artFile(visitor,p));
  if(view==='home')names.push(...['incense','sit','mo'].map(v=>sceneFile(v,period)));
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
 if(state.view!==view)analytics?.view(view);state.view=view;state.period=periodNow();if(!keepResult)state.result=null;
  if(view==='incense')state.incense={phase:'waiting',phaseStarted:performance.now(),auto:read('ct-incense-auto',false)===true,planted:false,strikes:0};
  if(view==='mo')woodSession=0;if(view==='beads'){state.bead=0;state.beadRound=1;state.beadDirection=1;state.beadFrame=1;beadAnnounced=-1;}if(view==='sit')state.wood=0;
 render();$('#app').setAttribute('aria-busy','true');canvas.style.opacity='0';
 finishBoot();
 const timer=setTimeout(()=>{if(token===transitionId){$('#loading').hidden=false;$('#loading').textContent=t('loading');}},400);
 try{
  const assets=await prepare(view,state.period);if(token!==transitionId)return;
  renderAssets=assets;state.busy=false;render();paint();animation();
  canvas.style.opacity='1';const duration=reduced.matches?150:300;
  canvas.animate([{opacity:0,filter:reduced.matches?'none':'blur(4px)'},{opacity:1,filter:'none'}],{duration});
  for(const e of [$('.scene-heading'),$('#controls')])e.animate([{opacity:.5},{opacity:1}],{duration:reduced.matches?150:220,delay:reduced.matches?0:80});
  if(old){const a=old.animate([{opacity:1},{opacity:0}],{duration});a.onfinish=()=>old.remove();}
  $('.stage').classList.add('scene-ready');
  if(assets.missing){$('#notice').textContent=t('imageUnavailable');$('#controls').insertAdjacentHTML('beforeend',button('retry','retry'));}
  if(['home','choose'].includes(view))prefetch(view);
  if(view==='beads'&&audio.enabled)void audio.load('bead-v1').catch(()=>{});
  if(view==='incense'&&audio.enabled)void audio.load('ignite-v1').catch(()=>{});
 }catch{if(token===transitionId){$('#notice').textContent=t('loadError');$('#controls').insertAdjacentHTML('beforeend',button('retry','retry'));canvas.style.opacity='1';}}
 finally{clearTimeout(timer);if(token===transitionId){pendingView=null;state.busy=false;$('#loading').hidden=true;$('#app').setAttribute('aria-busy','false');}else old?.remove();}
}
async function showChoice(){
 const token=++choiceToken,visitor=state.visitor,im=await image(`visitor-${visitor}-choose-v1.webp`);
 if(token!==choiceToken||state.view!=='choose')return;if(im.placeholder){$('#notice').textContent=t('imageUnavailable');if(!$('[data-action=retry-choice]'))$('#controls').insertAdjacentHTML('beforeend',button('retry','retry-choice'));return;}
 const nodes=[...document.querySelectorAll('.choice-image')],slot=nodes[1-choiceFront],old=nodes[choiceFront];if(!slot)return;
 const next=im;if(next===old)return;next.className='choice-image';next.alt=t('choose');next.draggable=false;
 if(token!==choiceToken||state.view!=='choose')return;
 // Decode off-DOM; keep the last good image fully opaque underneath each transition.
 old.style.transition='none';old.style.opacity=old.naturalWidth?'1':'0';old.style.zIndex='1';next.style.opacity='0';next.style.zIndex='2';if(slot!==next)slot.replaceWith(next);
 next.getBoundingClientRect();next.style.opacity='1';choiceFront=1-choiceFront;
 setTimeout(()=>{if(token===choiceToken)old.style.opacity='0';},200);
 document.querySelectorAll('.choice-dots i').forEach((e,i)=>e.classList.toggle('selected',state.layout.v1_scope.visitors[i]===visitor));
 prefetch('choose');fitScene();
}
function changeVisitor(delta=1){const ids=state.layout.v1_scope.visitors;state.visitor=ids[(ids.indexOf(state.visitor)+delta+ids.length)%ids.length];write('ct-visitor',state.visitor);void showChoice();}
function feedback(kind){if(!haptic(kind))try{navigator.vibrate?.(kind==='heavy'?[50,35,70]:kind==='medium'?25:10);}catch{}}
function bounce(e){if(e&&!reduced.matches)e.animate([{transform:'translateY(0)'},{transform:'translateY(-3px)',offset:.4},{transform:'translateY(0)'}],{duration:180});}

function render(){
  beadCleanup?.();beadCleanup=null;$('.beads-area')?.remove();
  const focused=document.activeElement,action=focused?.dataset?.action,target=focused?.dataset?.target,minutes=focused?.dataset?.minutes;
  document.documentElement.lang=state.lang;document.body.dataset.period=state.period;document.body.dataset.view=state.view;document.body.dataset.hand=state.beadHand;document.body.dataset.festival=festivalPeriod?.id??'';document.body.dataset.flower=readFlower();
  const flowerBtn=$('#flower-toggle-btn');if(flowerBtn){const f=readFlower();flowerBtn.textContent=t(f==='hoa-mai'?'flowerDao':'flowerMai');flowerBtn.hidden=!festivalPeriod||festivalPeriod.id==='ong-tao';}
  telegramAppearance(state.period,!!state.activity?.running&&['incense','sit'].includes(state.view));
  document.querySelectorAll('[data-i18n]').forEach(e=>e.textContent=t(e.dataset.i18n));
  $('#language').setAttribute('aria-label',t('language'));$('#controls').setAttribute('aria-label',t('actions'));
  if(inTelegram())$('#memorial').textContent=t('remind');
  telegramBack(!['entry','home'].includes(state.view));
  updateSoundUI();
  $('#sound-controls').hidden=!audio.enabled;
  $('#eyebrow').textContent=t(state.period);
  const heading=state.view==='entry'?'entryTitle':state.view==='choose'?'choose':state.view==='home'?'home':state.view==='morning'?'morningTitle':state.view;
  $('#heading').textContent=t(heading)+(state.view==='beads'?' · '+t('beadRound',{n:state.beadRound}):'');$('#subtitle').textContent=t(state.view==='home'?'homeNote':state.view==='entry'?'entryGuide':state.view==='choose'?'tagline':state.view==='morning'?'morningNote':`${state.view}Note`);
  if(festivalPeriod&&state.view==='home')$('#subtitle').textContent=t(festivalShareKey());
  canvas.setAttribute('aria-label',t(sceneName()==='hall-front'?'sceneFront':sceneName()==='hall-side'?'sceneSide':'sceneCourt'));
  $('#notice').textContent='';updateBreathCue();if(state.view!=='choose')$('#entry-overlay').innerHTML='';
  if(state.view==='morning'){
    const inProgress=morning.isActive();
    $('#controls').innerHTML=`<div class="stack morning-stack"><p class="morning-bell-hint" id="morning-bell-status" aria-live="polite" role="status">${inProgress?t('morningBell'):''}</p><div class="row">${button('morningStart','morning-start','primary')}${button('morningSkip','morning-skip','')}</div></div>`;
  }else if(state.view==='entry'){
    $('#controls').innerHTML=button('enter','enter','primary');
  }else if(state.view==='choose'){
    $('#controls').innerHTML=`<div class="choice-dots" aria-hidden="true">${state.layout.v1_scope.visitors.map(()=>'<i></i>').join('')}</div>${button('continue','continue','primary')}`;
    if(!$('.choice-image')){
     $('#entry-overlay').innerHTML=`<div class="choice-person"><img class="choice-image" alt="${escapeHTML(t('choose'))}"><img class="choice-image" alt="" aria-hidden="true"></div><button class="choice-arrow previous" data-action="previous" aria-label="${escapeHTML(t('change'))}">‹</button><button class="choice-arrow next" data-action="change" aria-label="${escapeHTML(t('change'))}">›</button>`;
     let x=null;$('#entry-overlay').onpointerdown=e=>{x=e.clientX;};$('#entry-overlay').onpointerup=e=>{if(x!==null&&Math.abs(e.clientX-x)>35)changeVisitor(e.clientX<x?1:-1);x=null;};
    }void showChoice();
  }else if(state.view==='home'){
    const actions=['incense','bow','sit','mo','beads'];
    $('#controls').innerHTML=`<nav class="action-nav">${actions.map(key=>`<button data-action="${key}"><svg class="nav-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${actionIcons[key]}</svg>${key==='memorial'?t('familyAltar'):t(key)}</button>`).join('')}</nav>`;
  }else if(state.view==='leave'){
    $('#controls').innerHTML=`<p class="leave-message">${t('goodbye')}</p>${button('reenter','reenter','primary')}`;
  }else if(state.result){
    $('#controls').innerHTML=`<div class="completion"><p>${reflections[state.result.reflection][state.lang]}</p>${state.result.kind==='beads'?button('beadAgain','bead-again','primary'):''}<div class="row">${button('shareAction','share','primary')}${button('download','download')}</div><p id="share-status" role="status"></p>${button('back','home','back-button')}</div>`;
    $('#subtitle').textContent=t('completed');
  }else if(state.view==='incense'){
    const journey=state.incense,earlyOk=journey?.phase==='standing'&&state.activity&&performance.now()-state.activity.startedMonotonic>=incenseConfig.earlyMs&&performance.now()-journey.standStarted>=incenseConfig.standMinMs;
    const phaseKey={waiting:'incenseWalking',walking:'incenseWalking','ready-light':'incenseReadyLight',lighting:'incenseLighting','ready-vai':'incenseReadyBow',bowing:'incenseBowing','ready-plant':'incenseReadyPlant',planting:'incensePlanting',standing:'incenseStanding'}[journey?.phase]||'incenseWalking';
    const primaryKey=journey?.phase==='ready-light'?'incenseLightNow':journey?.phase==='ready-vai'?'incenseBowThree':journey?.phase==='ready-plant'?'incensePlantNow':earlyOk?'incenseDone':phaseKey;
    const enabled=['ready-light','ready-vai','ready-plant'].includes(journey?.phase)||earlyOk;
    const morningSkipBtn=morning.isActive()?`<button type="button" class="text-button morning-skip-step" data-action="morning-skip-step" data-step="incense">${t('morningSkipStep')}</button>`:'';
    $('#controls').innerHTML=`<div class="stack"><div id="incense-status" class="section-label">${t(phaseKey)}</div><div class="incense-stick" aria-hidden="true"><span id="incense-progress"></span></div><div class="row">${enabled?button(primaryKey,'light','primary'):''}${button(journey?.auto?'incenseAutoOn':'incenseAuto','incense-auto','',`aria-pressed="${!!journey?.auto}"`)}${morning.isActive()?morningSkipBtn:button('back','home','back-button')}</div></div>`;
  }else if(state.view==='bow'){
    const a=state.activity;
    const bowBack=morning.isActive()?`<button type="button" class="text-button morning-skip-step" data-action="morning-skip-step" data-step="bow">${t('morningSkipStep')}</button>`:button('back','home','back-button');
    const target=`<div class="bow-status"><p class="section-label${a?' bow-target-summary':''}">${t('bowTarget')}${a?`: ${state.bowTarget}`:''}</p><p class="count" id="bow-count">${a?.count??0} / ${state.bowTarget}</p></div>${a?'':`<div class="choice-row">${[3,27,54,108].map(n=>`<button data-target="${n}" aria-pressed="${state.bowTarget===n}">${n}</button>`).join('')}</div>`}`;
    $('#controls').innerHTML=`<div class="stack">${target}<div class="row bow-actions">${button('bowOnce','bow-once','primary',a?.bowStart!=null?'disabled':'')}${button(a?.auto?'stopAuto':'auto','auto','',`aria-pressed="${!!a?.auto}"`)}</div><div class="bow-back">${bowBack}</div></div>`;
  }else if(state.view==='sit'){
    const a=state.activity;
    const sitBack=morning.isActive()?`<button type="button" class="text-button morning-skip-step" data-action="morning-skip-step" data-step="sit">${t('morningSkipStep')}</button>`:button('back','home','back-button');
    const summary=t('sitSummary',{minutes:state.sitMinutes,ambient:t(audio.ambientKind),breath:t(state.breathGuide?'breathOn':'breathOff')});
    const options=!a&&state.sitOptionsOpen?`<div class="sit-options" role="dialog" aria-label="${t('sitOptions')}"><div class="choice-row duration-options" aria-label="${t('duration')}">${[1,3,5,10].map(n=>`<button data-minutes="${n}" aria-pressed="${state.sitMinutes===n}">${n} ${t('minutes')}</button>`).join('')}</div><div class="breath-controls"><button type="button" data-action="breath-toggle" aria-pressed="${state.breathGuide}">${t('breathGuide')}</button><div class="choice-row" aria-label="${t('breathPace')}">${Object.keys(breathPatterns).map(k=>`<button data-breath="${k}" aria-pressed="${state.breathPattern===k}">${k.replace('-', ' / ')}</button>`).join('')}</div></div><div class="choice-row ambient-options">${['none','forest','rain'].map(k=>`<button data-ambient="${k}" aria-pressed="${audio.ambientKind===k}">${t(k)}</button>`).join('')}<button class="sit-options-close" type="button" data-action="sit-options" aria-label="${t('close')}">×</button></div></div>`:'';
    $('#controls').innerHTML=options||`<div class="stack sit-main"><p class="timer" id="timer" role="timer">${formatTime(a?remaining(a):state.sitMinutes*60000)}</p><p class="sit-summary">${summary}</p><div class="row">${!a?`${button('start','sit-start','primary')}${button('sitOptions','sit-options','',`aria-expanded="false"`)}`:`${button(a.running?'pause':'resume','pause','primary')}${button('finish','finish')}`}${sitBack}</div></div>`;
  }else if(state.view==='mo'){
    $('#controls').innerHTML=`<div class="stack"><p id="daily-wood" class="count">${t('dailyWood',{count:dailyWood()})}</p><p id="wood-message" role="status">${woodSession>=108?t('wood108'):''}</p><div class="row">${button(woodAuto?'woodStop':'woodAuto','wood-auto','primary',`aria-pressed="${!!woodAuto}"`)}${button('back','home')}</div></div>`;
  }else if(state.view==='beads'){
    $('#controls').innerHTML=`<div class="beads-area"><button class="bead-control" id="bead-control" data-action="bead" aria-label="${escapeHTML(t('beadAction'))}"><span class="bead-thread" aria-hidden="true"></span><span class="thumb-point" aria-hidden="true"></span><span class="bead-track" aria-hidden="true">${Array.from({length:13},()=>'<i class="strand-bead"></i>').join('')}</span></button></div><div class="bead-summary"><span id="bead-count" aria-hidden="true">${Math.min(108,state.bead)} / 108</span><span class="bead-guide" aria-hidden="true"><svg viewBox="0 0 32 56"><path d="M12 27V14a3 3 0 0 1 6 0v9-6a3 3 0 0 1 6 0v14c0 9-4 15-11 15-5 0-8-3-10-8l-2-6a3 3 0 0 1 5-2l3 4M16 49v6m-4-4 4 4 4-4"/></svg><b>${escapeHTML(t('beadSwipe'))}</b><span class="bead-chevrons"><svg viewBox="0 0 28 54"><path d="m7 10 7 7 7-7M7 25l7 7 7-7M7 40l7 7 7-7"/></svg></span></span><span id="bead-status" class="sr-only" role="status" aria-live="polite">${Math.min(108,Math.max(0,beadAnnounced))} / 108</span></div><div class="row bead-actions"><button type="button" data-action="bead-hand" aria-label="${escapeHTML(t('switchHand')+' · '+t(state.beadHand==='left'?'currentLeft':'currentRight'))}"><svg class="hand-arrows" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 8h18M7 4 3 8l4 4m14 4H3m14-4 4 4-4 4"/></svg>${t('switchHand')}</button>${button('back','home','back-button')}</div>`;
    $('.stage').append($('.beads-area'));beadCleanup=mountBeads($('#bead-control'),{step:bead,count:state.bead,reduced:reduced.matches,left:false,direction:state.beadDirection});updateBeadCount(state.bead===0);
  }
  $('#more-toggle').hidden=false;$('#more-toggle').setAttribute('aria-label',t('more'));
  $('#leave-top').hidden=state.view!=='home';$('#leave-top').innerHTML=`<svg viewBox="0 0 24 24" aria-hidden="true">${actionIcons.leave}</svg>`;$('#leave-top').setAttribute('aria-label',t('leave'));$('#leave-top').title=t('leave');
  if(familyEnabled)$('#memorial').textContent=t('familyAltar');
  $('#leave-more').hidden=!familyEnabled;$('#leave-more').textContent=t('leave');
  $('#wood-prop').hidden=state.view!=='mo'||state.busy;
  $('#wood-prop').setAttribute('aria-label',t('wood'));
  if(state.layout)fx();updateCounters();if(state.view==='bow')syncBowControls();fitScene();
  document.querySelectorAll('img,canvas,svg').forEach(e=>e.draggable=false);
  if(focused&&!focused.isConnected){const replacement=action?document.querySelector(`[data-action="${action}"]`):target?document.querySelector(`[data-target="${target}"]`):minutes?document.querySelector(`[data-minutes="${minutes}"]`):null;if(replacement&&!replacement.disabled)replacement.focus({preventScroll:true});}
}
function fitScene(){
  if(!renderAssets)return;
  const stage=$('.stage'),heading=$('.scene-heading').getBoundingClientRect(),controls=$('#controls').getBoundingClientRect(),box=stage.getBoundingClientRect();
  // Cover would crop the Buddha and visitor on opposite edges; preserve their shared region.
  const top=heading.bottom-box.top+8,bottom=controls.top-box.top-8;
  const region=sceneName()==='hall-side'?[300,1280]:sceneName()==='courtyard'?[420,state.layout.courtyard.bottom+(state.view==='beads'?360:42)]:[300,1400];
  const fullScene=['entry','choose','home','leave'].includes(state.view);
  const scale=fullScene||sceneName()==='courtyard'?Math.max(box.width/941,box.height/1672):box.width/941;
  let sceneTop=fullScene?(box.height-1672*scale)/2:Math.min(top-region[0]*scale,bottom-region[1]*scale);
  if(sceneName()==='courtyard'&&!fullScene)sceneTop=Math.max(sceneTop,bottom+8-1672*scale);
  stage.style.setProperty('--scene-width',941*scale+'px');
  stage.style.setProperty('--scene-top',sceneTop+'px');
  stage.style.setProperty('--scene-image','none');
  $('#stage-note').style.bottom=state.view==='sit'?`${box.bottom-controls.top+8}px`:'';
  if(state.view==='choose'){const overlay=$('#entry-overlay'),pos=placement(state.layout,state.visitor,'sit');overlay.style.top='0';overlay.style.bottom='0';const person=$('.choice-person');if(person)person.style.cssText=`inset:auto;left:${(box.width-941*scale)/2+pos.x*scale-20}px;top:${sceneTop+pos.y*scale}px;width:${pos.w*scale}px;height:${pos.h*scale}px;max-width:none;margin:0`;}
  if(state.view==='mo'){
    const sceneLeft=(box.width-941*scale)/2;
    $('#wood-prop').style.cssText=`left:${sceneLeft+285*scale}px;top:${sceneTop+1035*scale}px;width:${285*scale}px;height:${230*scale}px`;
  }
}
new ResizeObserver(()=>{fitScene();paint();}).observe($('#app'));
new ResizeObserver(fitScene).observe($('#controls'));
function formatTime(ms){const seconds=Math.ceil(Math.max(0,ms)/1000);return `${Math.floor(seconds/60).toString().padStart(2,'0')}:${(seconds%60).toString().padStart(2,'0')}`;}
function setIncensePhase(phase,now=performance.now()){
 const j=state.incense;if(!j)return;j.phase=phase;j.phaseStarted=now;if(phase.startsWith('ready-'))j.readySince=now;if(phase==='standing')j.standStarted=now;render();
}
function startIncenseStep(now=performance.now()){
 const j=state.incense;if(!j)return;
 if(j.phase==='ready-light'){
  event('activity_start',{activity:'incense'});state.activity={kind:'incense',running:true,startedMonotonic:now,started:Date.now()};j.ignited=false;setIncensePhase('lighting',now);void audio.load('ignite-v1').catch(()=>{});void audio.ambient('forest',.6,2);
 }else if(j.phase==='ready-vai'){j.strikes=0;setIncensePhase('bowing',now);}
 else if(j.phase==='ready-plant')setIncensePhase('planting',now);
 else if(j.phase==='standing'&&state.activity&&now-state.activity.startedMonotonic>=incenseConfig.earlyMs&&now-j.standStarted>=incenseConfig.standMinMs)complete('incense',Math.round(now-state.activity.startedMonotonic));
}
function advanceIncense(now){
 const j=state.incense;if(state.view!=='incense'||!j)return;
 const elapsed=now-j.phaseStarted;
 if(j.phase==='lighting'&&!j.ignited&&elapsed>=incenseConfig.igniteAt){j.ignited=true;audio.strike('ignite-v1',.7);feedback('soft');}
 if(j.phase==='bowing'){
  const cycle=reduced.matches?incenseConfig.reducedVaiMs:incenseConfig.vaiCycleMs,strike=reduced.matches?cycle*.45:incenseConfig.vaiStrikeAt;
  const due=Math.min(incenseConfig.vaiCount,Math.max(0,Math.floor((elapsed-strike)/cycle)+1));
  while(j.strikes<due){j.strikes++;audio.strike('keisu',.55);feedback('soft');}
 }
 if(j.phase==='planting'&&!j.planted&&elapsed>=incenseConfig.plantAt){j.planted=true;audio.strike('keisu',.35);feedback('soft');}
 if(incensePhaseDone(now,j,reduced.matches)){
  const next={waiting:'walking',walking:'ready-light',lighting:'ready-vai',bowing:'ready-plant',planting:'standing'}[j.phase];if(next)setIncensePhase(next,now);
 }
 if(j.auto&&j.phase.startsWith('ready-')&&now-j.readySince>=incenseConfig.autoGap)startIncenseStep(now);
 if(!j.auto&&!j.earlyShown&&j.phase==='standing'&&state.activity&&now-state.activity.startedMonotonic>=incenseConfig.earlyMs&&now-j.standStarted>=incenseConfig.standMinMs){j.earlyShown=true;render();}
 if(j.auto&&j.phase==='standing'&&state.activity&&now-state.activity.startedMonotonic>=incenseConfig.earlyMs&&now-j.standStarted>=incenseConfig.standMinMs)complete('incense',Math.round(now-state.activity.startedMonotonic));
}
function remaining(a){
  if(a.kind==='incense'){const elapsed=performance.now()-a.startedMonotonic;return Math.max(0,Math.min(60000,Number.isFinite(elapsed)?60000-elapsed:0));}
  return a.running?Math.max(0,a.deadline-Date.now()):a.left;
}
function updateCounters(){
  const a=state.activity;
  if(state.view==='incense'&&a){const left=remaining(a);if($('#incense-progress'))$('#incense-progress').style.transform=`scaleY(${left/60000})`;const status=$('#incense-status');if(status)status.textContent=`${status.textContent.split(' · ')[0]} · ${formatTime(left)}`;}
  if(state.view==='sit'&&a&&$('#timer'))$('#timer').textContent=formatTime(remaining(a));
}
function complete(kind,elapsed=0,countOverride){
  if(state.result)return;
  const old=state.activity;
  if(shareURL)URL.revokeObjectURL(shareURL);shareURL=null;shareBlob=null;
  state.result={kind,elapsed,count:countOverride??(kind==='bow'?old?.count:kind==='beads'?108:1),reflection:Math.floor(Math.random()*reflections.length)};
  completed(kind,elapsed,state.result.count);
  const stored=read('ct-totals',{}),count=Number.isFinite(stored?.count)&&stored.count>=0?stored.count:0,seconds=Number.isFinite(stored?.seconds)&&stored.seconds>=0?stored.seconds:0;
  write('ct-totals',{count:count+1,seconds:seconds+Math.round(elapsed/1000)});
  stopActivity();audio.strike('bell',kind==='bow'?.8:1);if(['incense','bow'].includes(kind))feedback('medium');
  const morningNext=morning.advance(kind);
  if(morningNext){void navigate(morningNext.navigate);return;}
  render();paint();$('.scene-heading').animate([{opacity:.65},{opacity:1}],{duration:reduced.matches?150:200});
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
 if(!state.activity)event('activity_start',{activity:'bow'});state.activity??={kind:'bow',count:0,auto:false,bowStart:null,started:now};
 Object.assign(state.activity,{bowStart:now,struck:false,counted:false});render();animation();
}

function queueBeadFrame(frame){
  state.beadFrame=frame;if(beadMotionRaf||state.view!=='beads')return;
  beadMotionRaf=requestAnimationFrame(()=>{beadMotionRaf=0;if(state.view==='beads')paint();});
}
function stopBeadMotion(){clearTimeout(beadMotionTimer);cancelAnimationFrame(beadMotionRaf);beadMotionTimer=0;beadMotionRaf=0;beadLastStep=-Infinity;state.beadFrame=1;}
function runBeadMotion(marker=false,now=performance.now()){
  const rapid=now-beadLastStep<beadMotionConfig.rapidIntervalMs;beadLastStep=now;clearTimeout(beadMotionTimer);queueBeadFrame(2);
  if(reduced.matches){beadMotionTimer=setTimeout(()=>{beadMotionTimer=0;queueBeadFrame(1);},beadMotionConfig.reducedHoldMs);return;}
  const pause=(rapid?beadMotionConfig.idleReturnMs:beadMotionConfig.pullMs)+(marker?beadMotionConfig.markerExtraMs:0);
  beadMotionTimer=setTimeout(()=>{beadMotionTimer=0;queueBeadFrame(3);beadMotionTimer=setTimeout(()=>{beadMotionTimer=0;queueBeadFrame(1);},beadMotionConfig.returnMs);},pause);
}
function updateBeadCount(announce=false){
  const value=`${Math.min(108,state.bead)} / 108`,visible=$('#bead-count'),status=$('#bead-status');if(visible)visible.textContent=value;
  if(status&&announce&&beadAnnounced!==state.bead){status.textContent=value;beadAnnounced=state.bead;}
}
function bead(){
  const limit=beadGuruRule==='turn-back'?108:109;
  if(state.result||state.bead>=limit)return;
  if(!state.activity)event('activity_start',{activity:'beads'});state.activity??={kind:'beads',started:Date.now()};state.bead++;
  const marker=[27,54,81].includes(state.bead);
  feedback(state.bead===limit?'heavy':marker?'medium':'light');
  if(!audio.strike('bead-v1',1,.97+Math.random()*.06))audio.strike('wood',.35,1.6);
  runBeadMotion(marker);
  const announce=state.bead%9===0||marker||state.bead===limit;updateBeadCount(announce);bounce($('#bead-count'));
  if(state.bead===limit)complete('beads',Date.now()-state.activity.started,108);
  else if(marker)audio.strike('keisu',.25);
}

export const audio=createTempleAudio({onChange:updateSoundUI,onError:()=>showSoundHint('soundUnavailable',6000),volume:()=>Number($('#volume').value)/100});
audio.ambientKind=['none','forest','rain'].includes(read('ct-sit-ambient','none'))?read('ct-sit-ambient','none'):'none';
let hintTimer=0,woodAuto=null,woodSession=0,woodMotionTimer=0,finishTimer=0,incenseReadyTimer=0,woodQueue=[];
function updateBreathCue(phase){const cue=$('#stage-note');if(!cue)return;const active=state.view==='sit'&&state.activity?.running&&state.breathGuide;if(!active){if(cue.dataset.breath)cue.textContent='';delete cue.dataset.breath;return;}const next=phase??breathFrame(performance.now(),state.activity.breathStarted,state.breathPattern).phase;cue.dataset.breath=next;cue.textContent=t(next==='inhale'?'inhale':'exhale');}
function startBreathing(fade=.2){if(state.view!=='sit'||!state.activity?.running||!state.breathGuide)return;state.activity.breathStarted=performance.now();updateBreathCue('inhale');void audio.breathing(state.breathPattern,.5,fade);animation();}
function placeSoundMessage(element){const heading=$('.scene-heading');if(element&&heading)element.style.top=`${Math.ceil(heading.getBoundingClientRect().bottom+8)}px`;}
function updateSoundUI(){
 const b=$('#sound-toggle');if(!b)return;
 const label=t(audio.enabled?'muteSound':'enableSound');b.setAttribute('aria-label',label);b.title=label;b.setAttribute('aria-pressed',String(audio.enabled));b.setAttribute('aria-busy',String(audio.loading));
 b.innerHTML=`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9h4l5-4v14l-5-4H4z"/>${audio.enabled?'<path d="M16 8q5 4 0 8m3-11q7 7 0 14"/>':'<path d="m16 9 5 6m0-6-5 6"/>'}</svg>`;
 $('#sound-controls').hidden=!audio.enabled;
 const status=$('#audio-status');status.textContent=audio.loading?t('audioLoading'):'';placeSoundMessage(status);
 if(audio.loading){clearTimeout(hintTimer);$('#sound-hint').hidden=true;}
}
function showSoundHint(key,ms=3000){if(audio.loading)return;clearTimeout(hintTimer);$('#audio-status').textContent='';const hint=$('#sound-hint');placeSoundMessage(hint);hint.getAnimations().forEach(a=>a.cancel());hint.textContent=t(key);hint.hidden=false;if(!reduced.matches)hint.animate([{opacity:1,offset:0},{opacity:1,offset:Math.max(0,1-300/ms)},{opacity:0}],{duration:ms});hintTimer=setTimeout(()=>{hint.hidden=true;},ms);}
async function enableSound(automatic=false){
 const began=Date.now();const pending=audio.enable();
  if(await pending){if(automatic)showSoundHint('tapMute');else setTimeout(()=>{if(audio.enabled&&audio.lastPlayed<began)showSoundHint('silentTip',6000);},2000);audio.strike('bell',.6);if(state.view==='sit'&&state.activity?.running){audio.ambient(audio.ambientKind);startBreathing();}if(state.view==='incense'&&state.activity?.running)audio.ambient('forest',.6,2);if(state.view==='beads')void audio.load('bead-v1').catch(()=>{});}
}
function localDay(){const d=new Date();return `${d.getFullYear()}-${d.getMonth()+1}-${d.getDate()}`;}
function dailyWood(){const stored=read('ct-wood',{});if(stored.day===localDay()&&Number.isSafeInteger(stored.count)&&stored.count>=0)return stored.count;return 0;}
function stopWoodAuto(){if(woodAuto){clearInterval(woodAuto);woodAuto=null;}}
function stopWoodMotion(){clearTimeout(woodMotionTimer);woodMotionTimer=0;woodQueue=[];state.moFrame=1;}
function runWoodMotion(){
  if(state.view!=='mo'||!woodQueue.length)return;
  const hit=woodQueue.shift(),land=()=>{state.moFrame=3;paint();audio.strike('wood');if(!haptic('light'))try{navigator.vibrate?.(10);}catch{}if(hit.final){woodQueue=[];woodMotionTimer=setTimeout(()=>complete('mo',performance.now()-woodStarted,woodSession),80);return;}woodMotionTimer=setTimeout(()=>{state.moFrame=1;paint();woodMotionTimer=0;if(woodQueue.length)runWoodMotion();},woodQueue.length?80:120);};
  if(reduced.matches){land();return;}state.moFrame=2;paint();woodMotionTimer=setTimeout(land,60);
}
function tapWood(){
 const count=dailyWood()+1;write('ct-wood',{day:localDay(),count});
 if(state.view==='mo'){
    if(!woodSession){woodStarted=performance.now();event('activity_start',{activity:'mo'})}woodSession++;$('#daily-wood').textContent=t('dailyWood',{count});const final=woodSession===108;if(final)$('#wood-message').textContent=t('wood108');else bounce($('#daily-wood'));woodQueue.push({final});if(!woodMotionTimer)runWoodMotion();
 }else if(state.view==='sit'){audio.strike('wood');feedback('light');state.wood++;$('#wood-count').textContent=`${t('woodCount')}: ${state.wood}`;}
}

function finishSit(){const a=state.activity;if(!a||a.finishing)return;a.left=remaining(a);a.running=false;a.finishing=true;const elapsed=a.total-a.left;audio.stopBreathing(2);updateBreathCue();render();finishTimer=setTimeout(()=>{if(state.activity===a)complete('sit',elapsed);},2000);}

function openModal(title,body){lastFocus=document.activeElement;$('#modal-title').textContent=t(title);$('#modal-body').innerHTML=body;$('#modal').showModal();telegramBack(true);$('#close-modal').focus();}
function closeModal(){if($('#modal').open)$('#modal').close();}
$('#close-modal').addEventListener('click',closeModal);
$('#modal').addEventListener('close',()=>{if(shareURL){URL.revokeObjectURL(shareURL);shareURL=null;}telegramBack(!['entry','home'].includes(state.view));lastFocus?.focus?.();});
function openMore(){closeModal();$('#more-menu').showModal();telegramBack(true);}
$('#close-more').onclick=()=>$('#more-menu').close();
$('#leave-more').onclick=()=>$('#more-menu').close();
$('#more-menu').addEventListener('close',()=>telegramBack(!['entry','home'].includes(state.view)));
function memorial(){
  if(familyEnabled){location.href='/family.html';return;}
  analytics?.view('memorial');$('#modal').addEventListener('close',()=>analytics?.view(state.view),{once:true});
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
  if(!form.email.validity.valid||!email||!consent){event('waitlist_submit',{result:'invalid'});status.textContent=t('invalid');(!form.email.validity.valid||!email?form.email:$('#consent')).focus();return;}
  submit.disabled=true;submit.textContent=t('sending');status.textContent='';
  try{
    const response=await fetch(apiURL('/waitlist'),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,language:state.lang,consent:true,consentAt:new Date().toISOString()}),signal:AbortSignal.timeout(12000)});
    if(!response.ok){event('waitlist_submit',{result:response.status===429?'rate_limit':'error'});status.textContent=t(response.status===429?'rateLimit':'unavailable');return;}
    const data=await response.json();if(data.ok!==true)throw new Error('invalid response');event('waitlist_submit',{result:'success'});form.replaceChildren(Object.assign(document.createElement('p'),{textContent:t('registered')}));
  }catch{event('waitlist_submit',{result:'error'});status.textContent=t('unavailable');}
  finally{submit.disabled=false;submit.textContent=t('register');}
}
function lines(c,text,width){const result=[];let line='';for(const word of text.split(' ')){const next=line?line+' '+word:word;if(c.measureText(next).width>width&&line){result.push(line);line=word;}else line=next;}if(line)result.push(line);return result;}
export function shareCardLayout(c,text){
  let font=44,body=[];do{c.font=`500 ${font}px "Be Vietnam Pro", sans-serif`;body=lines(c,text,620);if(body.length*font*1.2<=142)break;font-=2;}while(font>=28);
  const lineHeight=Math.round(font*1.2),top=958+(142-body.length*lineHeight)/2;
  return {font,lineHeight,body,bodyBox:{top,bottom:top+body.length*lineHeight},footerBox:{top:1112,bottom:1238}};
}
async function makeShare(show=true){
  if(!state.result)return false;
  try{
    await document.fonts.ready;
    paint();const c=document.createElement('canvas');c.width=720;c.height=1280;const x=c.getContext('2d');
    x.fillStyle='#f3ecde';x.fillRect(0,0,720,1280);x.drawImage(canvas,90,0,540,930);
    x.fillStyle='#3d3429';x.textAlign='center';const layout=shareCardLayout(x,shareText());x.font=`500 ${layout.font}px "Be Vietnam Pro", sans-serif`;
    layout.body.forEach((line,index)=>x.fillText(line,360,layout.bodyBox.top+(index+1)*layout.lineHeight-layout.lineHeight*.18));
    const qr=await image('share-qr.png');if(!qr.placeholder)x.drawImage(qr,52,1118,112,112);
    x.textAlign='left';x.font='500 28px "Be Vietnam Pro", sans-serif';x.fillText(t('brand'),200,1145);
    x.font='18px "Be Vietnam Pro", sans-serif';x.fillText(t('tagline'),200,1184);x.font='15px sans-serif';x.fillText('h5.chuamay.org',200,1225);
    window.__ctShareLayout=layout;
    shareBlob=await new Promise(resolve=>c.toBlob(resolve,'image/png'));if(!shareBlob)throw new Error('png');shareURL=URL.createObjectURL(shareBlob);
    if(show)showShareModal();return true;
  }catch{$('#notice').textContent=t('shareError');return false;}
}
function showShareModal(){openModal('shareTitle',`<img class="share-preview" src="${shareURL}" alt="${escapeHTML(t('shareTitle'))}"><div class="row">${button('shareAction','share-file','primary')}${button('download','download')}</div><p id="share-status" role="status"></p>`);}
function download(){
 if(!shareBlob)return;
 if(inTelegram()){
  if(!$('#modal').open)showShareModal();
  $('#share-status').textContent=t('longPressSave');return;
 }
 event('share_channel',{channel:'download'});const url=URL.createObjectURL(shareBlob),a=document.createElement('a');a.href=url;a.download='chua-may.png';a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);
}
const shareActivity=()=>state.result?.kind||'share';
const shareSource=channel=>`s_${channel}_a_${shareActivity()}`.replace(/[^a-z0-9_-]/g,'').slice(0,64);
const shareLink=channel=>`${location.origin}/?s=${encodeURIComponent(channel)}&a=${encodeURIComponent(shareActivity())}`;
function festivalShareKey(){return festivalPeriod&&({'ong-tao':'tetShareOngTao','tat-nien':'tetShareTatNien',mung1:'tetShareMung1',mung2:'tetShareMung2',mung3:'tetShareMung3',ram:'tetShareRam'}[festivalPeriod.id]||null);}
function shareText(){const r=state.result||{},{key,params}=shareCopy(r.kind,r.elapsed,r.count),base=t(key,params),festival=festivalShareKey();const text=festival?`${base} · ${t(festival)}`:base;if(hasForbiddenWord(text))console.warn('[festival] forbidden word detected');return text;}
async function copyShare(channel,track=true){try{await navigator.clipboard.writeText(shareLink(channel));if(track)event('share_channel',{channel:'copy'});$('#share-status').textContent=t('linkCopied');return true}catch{$('#share-status').textContent=t('shareError');return false}}
function sharePanel(){if($('.share-channels'))return;const telegram=inTelegram();$('#modal-body').insertAdjacentHTML('beforeend',`<div class="share-channels">${telegram?button('story','share-story')+button('telegramForward','share-telegram'):button('facebook','share-facebook')+button('messenger','share-messenger')+button('copyLink','share-copy')}</div>`);}
async function shareFile(){
  const text=shareText();if(inTelegram()){showShareModal();sharePanel();return}
  const file=new File([shareBlob],'chua-may.png',{type:'image/png'});
  if(navigator.share){try{const data=navigator.canShare?.({files:[file]})?{files:[file],text,url:shareLink('system'),title:t('brand')}:{text,url:shareLink('system'),title:t('brand')};await navigator.share(data);event('share_channel',{channel:'system'});return}catch(e){if(e.name==='AbortError')return;}}
  showShareModal();sharePanel();
}

document.addEventListener('click',async e=>{
  const b=e.target.closest('button');if(!b||b.disabled)return;
  if(b.dataset.target){state.bowTarget=Number(b.dataset.target);stopActivity();render();paint();return;}
  if(b.dataset.ambient){audio.ambientKind=b.dataset.ambient;write('ct-sit-ambient',audio.ambientKind);if(state.activity?.running)void audio.ambient(b.dataset.ambient);render();return;}
  if(b.dataset.breath){state.breathPattern=breathPatterns[b.dataset.breath]?b.dataset.breath:'4-6';write('ct-breath-pattern',state.breathPattern);if(state.activity?.running)startBreathing(.15);render();return;}
  if(b.dataset.minutes){state.sitMinutes=Number(b.dataset.minutes);write('ct-sit-minutes',state.sitMinutes);render();return;}
  const action=b.dataset.action;if(!action)return;
  switch(action){
    case 'more':openMore();break;
    case 'enter':if(!read('ct-muted',false)&&!audio.enabled)void enableSound(true);await navigate('choose');break;
    case 'change':changeVisitor();break;
    case 'previous':changeVisitor(-1);break;
    case 'continue':{write('ct-visitor',state.visitor);if(morning.shouldShow()&&!pendingLaunchActivity){morning.start();await navigate('morning');break;}const target=pendingLaunchActivity||'home';pendingLaunchActivity='';await navigate(target);break;}
    case 'morning-start':{state.bowTarget=3;state.sitMinutes=1;const status=$('#morning-bell-status');if(status)status.textContent=t('morningBell');audio.strike('bell',.8);const next=morning.bellDone();setTimeout(async()=>{if(morning.isActive())await navigate(next);},3200);break;}
    case 'morning-skip':{morning.skip('morning');await navigate('home');break;}
    case 'morning-skip-step':{const step=b.dataset.step;const r=morning.skip(step);if(r)await navigate(r.navigate);else await navigate('home');break;}
    case 'morning-replay':{if($('#more-menu').open)$('#more-menu').close();morning.replay();await navigate('morning');break;}
    case 'flower-toggle':writeFlower(readFlower()==='hoa-mai'?'hoa-dao':'hoa-mai');render();break;
    case 'incense':case 'bow':case 'sit':case 'beads':case 'mo':case 'home':await navigate(action);break;
    case 'leave':audio.strike('bell',.5);await navigate('leave');break;
    case 'reenter':await navigate('entry');break;
    case 'retry-choice':images.delete(`visitor-${state.visitor}-choose-v1.webp`);b.remove();void showChoice();break;
    case 'retry':images.clear();tinted.clear();await navigate(state.view);break;
    case 'light':startIncenseStep();animation();break;
    case 'incense-auto':if(state.incense){state.incense.auto=!state.incense.auto;write('ct-incense-auto',state.incense.auto);state.incense.readySince=performance.now();render();animation();}break;
    case 'incense-done':{const a=state.activity;if(a?.kind==='incense')complete('incense',Math.round(performance.now()-a.startedMonotonic));break;}
    case 'bow-once':bowOnce();break;
    case 'auto':if(!state.activity){bowOnce();state.activity.auto=true;}else{state.activity.auto=!state.activity.auto;if(state.activity.auto&&state.activity.bowStart==null)bowOnce();}syncBowControls();break;
    case 'sit-options':state.sitOptionsOpen=!state.sitOptionsOpen;render();break;
    case 'sit-start':state.sitOptionsOpen=false;event('activity_start',{activity:'sit'});state.activity={kind:'sit',running:true,deadline:Date.now()+state.sitMinutes*60000,left:state.sitMinutes*60000,total:state.sitMinutes*60000,breathStarted:performance.now(),breathFading:false};audio.ambient(audio.ambientKind);startBreathing();render();animation();break;
    case 'pause':{const a=state.activity;if(!a||a.finishing)break;if(a.running){a.left=remaining(a);a.running=false;const kind=audio.ambientKind;audio.ambient('none');audio.ambientKind=kind;audio.stopBreathing(.2);updateBreathCue();}else{a.deadline=Date.now()+a.left;a.running=true;a.breathFading=false;audio.ambient(audio.ambientKind);startBreathing();}render();animation();break;}
    case 'finish':finishSit();break;
    case 'breath-toggle':state.breathGuide=!state.breathGuide;write('ct-breath-guide',state.breathGuide);if(state.breathGuide)startBreathing();else{audio.stopBreathing(.2);updateBreathCue();}render();animation();break;
    case 'wood':tapWood();break;
    case 'wood-auto':if(woodAuto)stopWoodAuto();else if(!document.hidden)woodAuto=setInterval(tapWood,1000);render();break;
    case 'bead':break;
    case 'bead-hand':stopBeadMotion();state.beadHand=state.beadHand==='left'?'right':'left';event('hand_switch',{hand:state.beadHand});write('ct-bead-hand',state.beadHand);render();paint();break;
    case 'bead-again':stopBeadMotion();state.result=null;state.bead=0;beadAnnounced=-1;state.beadRound++;if(beadGuruRule==='turn-back')state.beadDirection*=-1;render();paint();$('#bead-control').focus({preventScroll:true});break;
    case 'memorial':memorial();break;
    case 'share':event('share_open',{activity:state.result.kind});if(await makeShare(false))await shareFile();break;
    case 'share-file':await shareFile();break;
    case 'download':if(shareBlob||await makeShare(false))download();break;
    case 'share-copy':await copyShare('copy');break;
    case 'share-facebook':event('share_channel',{channel:'facebook'});open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareLink('facebook'))}`,'_blank','noopener');break;
    case 'share-messenger':if(await copyShare('messenger',false)){event('share_channel',{channel:'messenger'});open(`fb-messenger://share?link=${encodeURIComponent(shareLink('messenger'))}`,'_self');}break;
    case 'share-zalo':if(await copyShare('zalo',false)){event('share_channel',{channel:'zalo'});open('zalo://','_self');}break;
    case 'share-telegram':if(telegramShare(shareText(),shareSource('tg_forward')))event('share_channel',{channel:'telegram_forward'});break;
    case 'share-story':if(telegramStory(shareText(),shareSource('tg_story')))event('share_channel',{channel:'telegram_story'});else $('#share-status').textContent=t('shareError');break;
    case 'recommend':$('#more-menu').close();openModal('recommend',`<p>${escapeHTML(t('recommendText'))}</p><div class="row">${button('shareAction','share-recommend','primary')}${button('copyLink','share-copy')}</div><p id="share-status" role="status"></p>`);break;
    case 'share-recommend':if(inTelegram())telegramShare(t('recommendText'),'s_tg_forward_a_recommend');else if(navigator.share)try{await navigator.share({title:t('brand'),text:t('recommendText'),url:shareLink('recommend')});}catch{}else await copyShare('recommend');break;
  }
});
const continuous=e=>e.target.closest?.('#bead-control,#wood-prop,[data-action="bow-once"]');
document.addEventListener('dragstart',e=>{if(e.target.closest?.('img,canvas,svg'))e.preventDefault();});
for(const type of ['contextmenu','selectstart'])$('#app').addEventListener(type,e=>{if(continuous(e))e.preventDefault();});
$('#app').addEventListener('touchstart',e=>{if(e.target.closest?.('#bead-control'))e.preventDefault();},{passive:false});
$('#app').addEventListener('pointerdown',e=>{if(continuous(e)){if(e.target.closest?.('#bead-control'))e.preventDefault();getSelection()?.removeAllRanges();}});
$('#memorial').addEventListener('click',memorial);
$('#language').addEventListener('change',e=>{state.lang=e.target.value;closeModal();render();});
$('#sound-toggle').addEventListener('click',()=>{event('sound_toggle',{state:audio.enabled?'off':'on'});if(audio.enabled){write('ct-muted',true);audio.mute();}else{write('ct-muted',false);void enableSound();}});
const savedVolume=read('ct-volume',80);$('#volume').value=typeof savedVolume==='number'&&Number.isFinite(savedVolume)&&savedVolume>=0&&savedVolume<=100?savedVolume:80;
state.beadHand=read('ct-bead-hand','right')==='left'?'left':'right';
$('#volume').addEventListener('input',()=>{write('ct-volume',Number($('#volume').value));audio.volume();});
$('#controls').addEventListener('pointerdown',e=>{const action=e.target.closest('[data-action]')?.dataset.action;if(action==='enter')void image(artFile(state.visitor,'sit'));else if(['incense','bow','sit','beads','mo'].includes(action))void image(sceneFile(action,periodNow()));});
document.addEventListener('click',()=>{void audio.wake();},true);
reduced.addEventListener('change',()=>{stopBeadMotion();animation();paint();fx();if(state.view==='beads')render();});
document.addEventListener('visibilitychange',async()=>{if(document.hidden){stopWoodAuto();stopWoodMotion();stopBeadMotion();audio.stopBackground();audio.stopBreathing();cancelAnimationFrame(drawFrame);if(['mo','beads'].includes(state.view))render();}else{await audio.wake();tick();animation();if(state.view==='sit'&&state.activity?.running){audio.ambient(audio.ambientKind);startBreathing();}if(state.view==='incense'&&state.activity?.running)audio.ambient('forest',.6,2);if(state.view==='beads')void audio.load('bead-v1').catch(()=>{});}});
let periodUpdating=false;
async function tick(){
  if(!state.layout||state.busy)return;
  const a=state.activity,now=Date.now();
  if(state.view==='incense'){advanceIncense(performance.now());if(reduced.matches)paint();}
  if(a?.kind==='sit'&&a.running&&remaining(a)<=2000&&!a.breathFading){a.breathFading=true;audio.stopBreathing(2);}
  if(a?.running&&remaining(a)<=0){if(a.kind==='incense'&&state.incense?.phase==='standing')complete('incense',60000);if(a.kind==='sit')complete('sit',a.total);}
  updateCounters();updateBreathCue();if(state.view==='mo'&&$('#daily-wood'))$('#daily-wood').textContent=t('dailyWood',{count:dailyWood()});
  const nextFestival=getFestivalPeriod();if(nextFestival?.id!==festivalPeriod?.id){festivalPeriod=nextFestival;render();}
  if(newYearBell&&audio.enabled&&!document.hidden)newYearBell.arm(true);
  const period=periodNow();if(period!==state.period&&!periodUpdating){periodUpdating=true;const token=transitionId,view=state.view;try{const assets=await prepare(view,period);if(token===transitionId){state.period=period;renderAssets=assets;render();paint();}}catch{/* Keep the last fully loaded scene on transient failures. */}finally{periodUpdating=false;}}
}
setInterval(tick,200);
let resolveLayout;const layoutReady=new Promise(resolve=>resolveLayout=resolve);
async function init(){
  state.period=periodNow();document.documentElement.lang=state.lang;$('#language').value=state.lang;document.body.dataset.period=state.period;$('#eyebrow').textContent=t(state.period);$('#subtitle').textContent=t('tagline');updateSoundUI();
  const familyReady=fetch(apiURL('/family/status'),{credentials:'include',signal:AbortSignal.timeout(3000)}).then(async response=>{familyEnabled=response.ok&&(await response.json()).enabled===true;}).catch(()=>{familyEnabled=false;});
  await initTelegram(()=>{if($('#more-menu').open)$('#more-menu').close();else if($('#modal').open)closeModal();else navigate(state.view==='choose'?'entry':'home');},openMore);
  if(telegramStartParam()==='family'){location.replace('/family.html?telegram=1');return;}
  enableImageDebug(inTelegram());
  if(['staging.chuamay.org','h5.chuamay.org','miniapp.chuamay.org'].includes(location.hostname))void import('./analytics.js').then(({setupAnalytics})=>{
    analytics=setupAnalytics(inTelegram,{...launchAttribution,startParam:telegramStartParam()});window.addEventListener('ct-image-failure',e=>event('image_load_failed',e.detail));
  }).catch(()=>{/* A statistics module failure must not interrupt the visit. */});
  try{const response=await fetch(assetURL('processed-v1/layout-v1.json'),{credentials:'omit'});if(!response.ok)throw new Error('layout');state.layout=await response.json();await familyReady;const saved=read('ct-visitor',null);state.visitor=state.layout.v1_scope.visitors.includes(saved)?saved:state.layout.v1_scope.visitors[Math.floor(Math.random()*6)];state.period=periodNow();resolveLayout();
  const ring=(count,newYear=false)=>{if(state.view==='sit'&&state.activity?.running){audio.strike('bell',.22);return;}if(newYear)showNewYearBanner();for(let i=0;i<count;i++)setTimeout(()=>audio.strike('bell',.6),i*1500);};
  newYearBell=createNewYearBell({onBell:count=>ring(count),onNewYear:count=>{launchLanterns();ring(count,true);}});if(!transitionId)await navigate('entry');if(!read('ct-sound-hint-seen',false)){write('ct-sound-hint-seen',true);showSoundHint('soundFirstHint');}}
  catch{finishBoot();$('#loading').hidden=true;$('#notice').textContent=t('loadError');$('#controls').innerHTML=button('retry','reload');$('#controls').onclick=e=>{if(e.target.dataset.action==='reload')location.reload();};$('#app').setAttribute('aria-busy','false');}
}
function finishBoot(){const boot=$('#boot');if(!boot)return;performance.mark('ct-interactive');boot.classList.add('ready');setTimeout(()=>boot.remove(),350);}
function showNewYearBanner(){const b=$('#tet-banner');if(!b)return;b.textContent=t('tetBanner');b.hidden=false;if(!reduced.matches)b.animate([{opacity:0},{opacity:1,offset:.1},{opacity:1,offset:.8},{opacity:0}],{duration:10000});setTimeout(()=>{b.hidden=true;b.textContent='';},10000);}
function launchLanterns(){const svg=$('#effects');if(!svg||reduced.matches)return;for(let i=0;i<5;i++){const el=document.createElementNS('http://www.w3.org/2000/svg','ellipse');el.setAttribute('cx',120+i*160);el.setAttribute('cy',1100);el.setAttribute('rx','18');el.setAttribute('ry','26');el.setAttribute('fill','#e8431a');el.setAttribute('opacity','.85');el.style.animation=`lantern-rise ${3+i*.4}s ease-in forwards`;el.style.animationDelay=`${i*.3}s`;svg.appendChild(el);setTimeout(()=>el.remove(),6000+i*300);}}
init();
