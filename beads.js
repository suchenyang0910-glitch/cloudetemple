// The pending artwork is deliberately not referenced here: CSS beads remain until review.
export class BeadMotion {
 constructor(step){this.step=step;this.pitch=42;this.position=0;this.count=0;this.last=-Infinity;}
 begin(x,y){this.start={x,y};this.origin=this.position;this.startCount=this.count;this.target=this.origin;this.axis=null;this.active=x>=20;}
 move(x,y){if(!this.active)return;const dx=x-this.start.x,dy=y-this.start.y;if(!this.axis&&Math.hypot(dx,dy)>8)this.axis=Math.abs(dx)>Math.abs(dy)?'x':'y';if(this.axis==='y')this.target=this.origin+dy;}
 frame(now){
  if(!this.active||this.axis!=='y')return;
  const next=this.origin+(this.count-this.startCount+1)*this.pitch;
  this.position=Math.min(this.target,next-0.01);
  if(this.target>=next&&now-this.last>=90){this.count++;this.last=now;this.position=next;this.step(this.count);}
 }
 end(){const tapped=this.active&&!this.axis;this.active=false;this.position=this.target<this.origin?this.origin:Math.round(this.position/this.pitch)*this.pitch;return tapped;}
 tap(now){if(now-this.last<90)return false;this.count++;this.last=now;this.position+=this.pitch;this.step(this.count);return true;}
}

export function mountBeads(el,{step,count=0,reduced=false}){
 const track=el.querySelector('.bead-track'),nodes=[...track.children],model=new BeadMotion(step);
 model.count=count;model.position=count*model.pitch;
 let raf=0,disposed=false,down=null,animationStart=0,from=model.position,to=model.position;
 const draw=position=>{
  const base=Math.floor(position/model.pitch),fraction=position/model.pitch-base;
  nodes.forEach((node,i)=>{
   const y=(i-1+fraction)*model.pitch,number=model.count+6-i;
   const x=12*Math.sin((y/336)*Math.PI),near=Math.max(0,1-Math.abs(y-210)/42);
   node.className='strand-bead'+(number===108?' guru':number>0&&number%27===0?' spacer':'');
   node.style.transform=`translate(${x}px,${y}px) rotate(${position/model.pitch*20}deg) scale(${1+near*.08})`;
   node.style.opacity=String(Math.max(0,Math.min(1,y/35,(336-y)/40)));
  });
 };
 const frame=now=>{
  if(disposed)return;
  if(model.active&&!reduced){model.frame(now);draw(model.position);}
  else if(animationStart){const p=Math.min(1,(now-animationStart)/180);draw(from+(to-from)*(1-(1-p)**3));if(p===1)animationStart=0;}
  if(model.active||animationStart)raf=requestAnimationFrame(frame);
 };
 const settle=(start,end)=>{cancelAnimationFrame(raf);from=start;to=end;if(reduced){draw(end);return;}animationStart=performance.now();raf=requestAnimationFrame(frame);};
 el.addEventListener('pointerdown',e=>{if(e.clientX<20||e.button!==0)return;el.focus({preventScroll:true});down={x:e.clientX,y:e.clientY};model.begin(e.clientX,e.clientY);el.setPointerCapture(e.pointerId);cancelAnimationFrame(raf);raf=requestAnimationFrame(frame);});
 el.addEventListener('pointermove',e=>model.move(e.clientX,e.clientY));
 const release=e=>{if(!down)return;const previous=model.position,tapped=model.end();if(tapped||(reduced&&e.clientY-down.y>25&&Math.abs(e.clientX-down.x)<Math.abs(e.clientY-down.y)))model.tap(performance.now());down=null;settle(previous,model.position);};
 el.addEventListener('pointerup',release);
 el.addEventListener('pointercancel',()=>{down=null;const previous=model.position;model.end();settle(previous,model.position);});
 el.addEventListener('click',e=>{e.stopPropagation();if(e.detail===0){const previous=model.position;model.tap(performance.now());settle(previous,model.position);}});
 el.addEventListener('keydown',e=>{if(['Enter',' '].includes(e.key)){e.preventDefault();const previous=model.position;model.tap(performance.now());settle(previous,model.position);}});
 draw(model.position);
 if(!reduced&&count===0)settle(-model.pitch,0);
 return ()=>{disposed=true;cancelAnimationFrame(raf);};
}
