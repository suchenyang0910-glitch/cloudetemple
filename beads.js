import {assetURL} from './resources.js';
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

export function beadArc(width,height,offset,left=false){
 const radius=width*.9,angle=.22+offset/radius;
 const x=width*1.64-radius*Math.cos(angle),y=height*.49+radius*Math.sin(angle);
 return {x:left?width-x:x,y,angle:(left?-1:1)*-angle*180/Math.PI};
}

export function mountBeads(el,{step,count=0,reduced=false,left=false}){
 const track=el.querySelector('.bead-track'),nodes=[...track.children],model=new BeadMotion(step);
 const area=el.parentElement;
 for(const kind of ['wood','spacer','guru'])area.style.setProperty(`--bead-${kind}`,`url("${assetURL(`processed-v1/img/bead-${kind}-v2.webp`)}")`);
 let width=area.clientWidth,height=area.clientHeight;
 model.pitch=Math.max(48,Math.min(58,width*.142))+6;
 model.count=count;model.position=count*model.pitch;
 let raf=0,disposed=false,down=null,animationStart=0,from=model.position,to=model.position;
 const draw=position=>{
  const base=Math.floor(position/model.pitch),fraction=position/model.pitch-base;
  nodes.forEach((node,i)=>{
   const offset=(i-7+fraction)*model.pitch,number=base+8-i;
   const {x,y,angle}=beadArc(width,height,offset,left),near=Math.max(0,1-Math.abs(offset)/model.pitch);
   node.className='strand-bead'+(number===109?' guru':[27,54,81].includes(number)?' spacer':'');
   node.dataset.number=number;
   node.style.transform=`translate(${x}px,${y}px) translate(-50%,-50%) rotate(${angle}deg) scale(${1+near*.07})`;
   node.style.opacity=String(Math.max(0,Math.min(1,(y+20)/45,(height+20-y)/45)));
  });
 };
 const resize=new ResizeObserver(()=>{width=area.clientWidth;height=area.clientHeight;const size=model.pitch-6;area.style.setProperty('--bead-size',size+'px');const p=beadArc(width,height,0,left);el.querySelector('.thumb-point').style.cssText=`left:${p.x}px;top:${p.y}px`;const r=width*.9;el.querySelector('.bead-thread').style.cssText=`width:${r*2}px;height:${r*2}px;left:${(left?-width*.64:width*1.64)-r}px;top:${height*.49-r}px`;draw(model.position);});resize.observe(area);
 const frame=now=>{
  if(disposed)return;
  if(model.active&&!reduced){model.frame(now);draw(model.position);}
  else if(animationStart){const p=Math.min(1,(now-animationStart)/180);draw(from+(to-from)*(1+1.6*(p-1)**3+.6*(p-1)**2));if(p===1)animationStart=0;}
  if(model.active||animationStart)raf=requestAnimationFrame(frame);
 };
 const settle=(start,end)=>{cancelAnimationFrame(raf);from=start;to=end;if(reduced){draw(end);return;}animationStart=performance.now();raf=requestAnimationFrame(frame);};
 el.addEventListener('pointerdown',e=>{if(e.clientX<20||e.clientX>innerWidth-20||e.button!==0)return;el.focus({preventScroll:true});down={x:e.clientX,y:e.clientY};model.begin(e.clientX,e.clientY,innerWidth);el.setPointerCapture(e.pointerId);cancelAnimationFrame(raf);raf=requestAnimationFrame(frame);});
 el.addEventListener('pointermove',e=>model.move(e.clientX,e.clientY));
 const release=e=>{if(!down)return;const previous=model.position,tapped=model.end(performance.now(),!reduced);if(tapped||(reduced&&e.clientY-down.y>25&&Math.abs(e.clientX-down.x)<Math.abs(e.clientY-down.y)))model.tap(performance.now());down=null;settle(previous,model.position);};
 el.addEventListener('pointerup',release);
 el.addEventListener('pointercancel',()=>{if(!down)return;down=null;const previous=model.position;model.end(performance.now(),false);settle(previous,model.position);});
 el.addEventListener('click',e=>{e.stopPropagation();if(e.detail===0){const previous=model.position;model.tap(performance.now());settle(previous,model.position);}});
 el.addEventListener('keydown',e=>{if(['Enter',' '].includes(e.key)){e.preventDefault();const previous=model.position;model.tap(performance.now());settle(previous,model.position);}});
 draw(model.position);
 if(!reduced&&count===0)settle(-model.pitch,0);
 return ()=>{disposed=true;resize.disconnect();cancelAnimationFrame(raf);};
}
