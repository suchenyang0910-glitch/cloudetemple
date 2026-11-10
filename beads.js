import {assetURL} from './resources.js';
import {beadMotionConfig} from './config.js';
export class BeadMotion {
 constructor(step){this.step=step;this.pitch=42;this.position=0;this.count=0;this.last=-Infinity;}
 begin(x,y,width=Infinity){this.start={x,y};this.origin=this.position;this.startCount=this.count;this.target=this.origin;this.axis=null;this.active=x>=20&&x<=width-20;}
 move(x,y){if(!this.active)return;const dx=x-this.start.x,dy=y-this.start.y;if(!this.axis&&Math.hypot(dx,dy)>8)this.axis=Math.abs(dx)>Math.abs(dy)?'x':'y';if(this.axis==='y')this.target=this.origin+dy;}
 frame(now){
  if(!this.active||this.axis!=='y')return;
  const next=this.origin+(this.count-this.startCount+1)*this.pitch;
  this.position=Math.min(this.target,next-0.01);
  if(this.target>=next&&now-this.last>=90){this.count++;this.last=now;this.position=next;this.step(this.count);}
 }
 end(now=performance.now(),commit=true){
  const tapped=this.active&&!this.axis;
  const advance=commit&&this.active&&this.axis==='y'&&this.position-this.count*this.pitch>this.pitch*.5;
  this.active=false;
  if(advance){this.count++;this.last=now;this.position=this.count*this.pitch;this.step(this.count);}
  else this.position=this.count*this.pitch;
  return tapped;
 }
 tap(now){if(now-this.last<90)return false;this.count++;this.last=now;this.position+=this.pitch;this.step(this.count);return true;}
}

export function beadArc(width,height,offset,left=false,config=beadMotionConfig){
 const radius=width*config.arcRadius,angle=offset/radius;
 const x=width*config.laneRight-radius*(1-Math.cos(angle));
 return {x,y:height*.65+radius*Math.sin(angle),angle:-angle*180/Math.PI};
}

export function mountBeads(el,{step,count=0,reduced=false,left=false,direction=1}){
 const guide=el.querySelector('.bead-guide'),chevrons=el.querySelector('.bead-chevrons');
 let guideTimer=0,demoTimer=0;
 const remember=()=>{try{localStorage.setItem('ct-bead-guide','true');}catch{}};
 const learned=()=>{try{return localStorage.getItem('ct-bead-guide')==='true';}catch{return false;}};
 const hideGuide=save=>{clearTimeout(guideTimer);clearInterval(demoTimer);guide.classList.remove('visible');if(save)remember();};
 const track=el.querySelector('.bead-track'),nodes=[...track.children],model=new BeadMotion(n=>{hideGuide(true);step(n);});
 const area=el.parentElement;
 for(const kind of ['wood','spacer','guru'])area.style.setProperty(`--bead-${kind}`,`url("${assetURL(`processed-v1/img/bead-${kind}-v2.webp`)}")`);
 let width=area.clientWidth,height=area.clientHeight;
 model.pitch=beadMotionConfig.beadPitch;
 model.count=count;model.position=count*model.pitch;
 let raf=0,disposed=false,down=null,animationStart=0,from=model.position,to=model.position;
 const draw=position=>{
  const base=Math.floor(position/model.pitch),fraction=position/model.pitch-base;
  nodes.forEach((node,i)=>{
   const offset=direction*(i-7+fraction)*model.pitch,number=base+8-i;
   const {x,y,angle}=beadArc(width,height,offset,left),near=Math.max(0,1-Math.abs(offset)/model.pitch);
   const physical=direction===1?number:110-number;
   node.className='strand-bead'+(physical===109?' guru':[27,54,81].includes(number)?' spacer':'');
   node.dataset.number=number;
   node.style.transform=`translate(${x}px,${y}px) translate(-50%,-50%) rotate(${angle}deg) scale(${1+near*.07})`;
   const half=beadMotionConfig.beadDiameter*.76;
   node.style.opacity=String(Math.max(0,Math.min(1,(y-half-100)/35,(height+20-y)/45,(Math.min(x,width-x)-half+16)/8)));
  });
 };
 const resize=new ResizeObserver(()=>{width=area.clientWidth;height=area.clientHeight;const areaBox=area.getBoundingClientRect(),heading=document.querySelector('.scene-heading'),top=Math.max(100,heading.getBoundingClientRect().bottom-areaBox.top+8),controlTop=document.querySelector('.controls').getBoundingClientRect().top-areaBox.top;area.style.setProperty('--bead-size',beadMotionConfig.beadDiameter+'px');area.style.setProperty('--bead-touch-top',top+'px');const p=beadArc(width,height,0,left),r=width*beadMotionConfig.arcRadius,guideY=Math.min(p.y+88,controlTop-13);el.querySelector('.thumb-point').style.cssText=`left:${p.x}px;top:${p.y}px`;guide.style.cssText=`left:${Math.max(52,p.x-72)}px;top:${guideY}px`;chevrons.style.cssText=`left:${p.x}px;top:${p.y+52}px`;el.querySelector('.bead-thread').style.cssText=`width:${r*2}px;height:${r*2}px;left:${left?p.x-r*2:p.x}px;top:${p.y-r}px`;draw(model.position);});resize.observe(area);resize.observe(document.querySelector('.scene-heading'));
 const frame=now=>{
  if(disposed)return;
  if(model.active&&!reduced){model.frame(now);draw(model.position);}
  else if(animationStart){const p=Math.min(1,(now-animationStart)/animationDuration);draw(from+(to-from)*(1+1.6*(p-1)**3+.6*(p-1)**2));if(p===1)animationStart=0;}
  if(model.active||animationStart)raf=requestAnimationFrame(frame);
 };
 let animationDuration=180;
 const settle=(start,end,duration=180)=>{cancelAnimationFrame(raf);from=start;to=end;animationDuration=duration;if(reduced){draw(end);return;}animationStart=performance.now();raf=requestAnimationFrame(frame);};
 const demo=()=>{if(!down)settle(-model.pitch*.5,0,1400);};
 const showGuide=(ms=0)=>{clearTimeout(guideTimer);clearInterval(demoTimer);guide.classList.add('visible');demo();if(!reduced)demoTimer=setInterval(demo,2000);if(ms)guideTimer=setTimeout(()=>hideGuide(false),ms);};
 const block=e=>e.preventDefault();el.addEventListener('touchstart',block,{passive:false});el.addEventListener('contextmenu',block);el.addEventListener('selectstart',block);
 el.addEventListener('pointerdown',e=>{const box=area.getBoundingClientRect(),rightSide=e.clientX>=box.left+box.width*beadMotionConfig.touchRightStart,lowerHalf=e.clientY>=box.top+box.height*.5;if((!rightSide&&!lowerHalf)||e.clientX<20||e.clientX>innerWidth-20||e.button!==0)return;e.preventDefault();getSelection()?.removeAllRanges();clearTimeout(guideTimer);clearInterval(demoTimer);el.focus({preventScroll:true});down={x:e.clientX,y:e.clientY};model.begin(e.clientX,e.clientY,innerWidth);el.setPointerCapture(e.pointerId);cancelAnimationFrame(raf);raf=requestAnimationFrame(frame);});
 el.addEventListener('pointermove',e=>{if(down)e.preventDefault();model.move(e.clientX,e.clientY);});
 const release=e=>{if(!down)return;e.preventDefault();const dx=e.clientX-down.x,dy=e.clientY-down.y,invalid=Math.abs(dx)>Math.abs(dy)||dy<0,previous=model.position,tapped=model.end(performance.now(),!reduced);if(tapped||(reduced&&dy>25&&Math.abs(dx)<Math.abs(dy)))model.tap(performance.now());down=null;settle(previous,model.position);if(invalid)showGuide(1500);};
 el.addEventListener('pointerup',release);
 el.addEventListener('pointercancel',()=>{if(!down)return;down=null;const previous=model.position;model.end(performance.now(),false);settle(previous,model.position);});
 el.addEventListener('click',e=>{e.stopPropagation();if(e.detail===0){const previous=model.position;model.tap(performance.now());settle(previous,model.position);}});
 el.addEventListener('keydown',e=>{if(['Enter',' '].includes(e.key)){e.preventDefault();const previous=model.position;model.tap(performance.now());settle(previous,model.position);}});
 draw(model.position);
 if(!learned())showGuide();else if(count===0)guideTimer=setTimeout(()=>showGuide(1500),5000);
 return ()=>{disposed=true;resize.disconnect();cancelAnimationFrame(raf);clearTimeout(guideTimer);clearInterval(demoTimer);};
}
