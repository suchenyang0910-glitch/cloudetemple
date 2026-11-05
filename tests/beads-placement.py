from pathlib import Path
from datetime import datetime,timezone
import json
from playwright.sync_api import sync_playwright

out=Path('screenshots/round3/review2/placement');out.mkdir(parents=True,exist_ok=True);rows=[]
ids=json.loads(Path('assets/processed-v1/layout-v1.json').read_text(encoding='utf-8'))['v1_scope']['visitors']
probe="""(()=>{const draw=CanvasRenderingContext2D.prototype.drawImage,cache=new WeakMap();CanvasRenderingContext2D.prototype.drawImage=function(im,...args){
 if(this.canvas.id==='scene'&&im instanceof HTMLCanvasElement&&im.width===600&&args.length===4){
  let b=cache.get(im);if(!b){const d=im.getContext('2d').getImageData(0,0,im.width,im.height).data;b=[im.width,im.height,0,0];for(let y=0;y<im.height;y++)for(let x=0;x<im.width;x++)if(d[(y*im.width+x)*4+3]>0){b[0]=Math.min(b[0],x);b[1]=Math.min(b[1],y);b[2]=Math.max(b[2],x+1);b[3]=Math.max(b[3],y+1)}cache.set(im,b)}window.visitorDraw={args,bbox:b};
 }return draw.call(this,im,...args)};})()"""
with sync_playwright() as pw:
 b=pw.chromium.launch()
 for w,h in [(375,548),(393,659),(375,667),(390,844),(393,852),(430,932)]:
  c=b.new_context(viewport={'width':w,'height':h},timezone_id='UTC');p=c.new_page();p.add_init_script(probe);p.add_init_script("localStorage.setItem('ct-muted','true')")
  p.clock.set_fixed_time(datetime(2026,11,5,10,tzinfo=timezone.utc))
  def ready():p.wait_for_function("document.querySelector('#app').getAttribute('aria-busy')==='false'");p.wait_for_timeout(320)
  def click(a):p.locator(f'[data-action={a}]').click();ready()
  for id in ids:
   p.goto('http://127.0.0.1:8828');ready();p.evaluate('(id)=>{localStorage.setItem("ct-visitor",JSON.stringify(id));localStorage.setItem("ct-bead-hand",JSON.stringify("right"))}',id);p.reload();ready()
   click('enter');click('continue');click('beads')
   for hand in ['right','left']:
    if p.evaluate('document.body.dataset.hand')!=hand:click('bead-hand')
    m=p.evaluate("""()=>{const box=document.querySelector('#scene').getBoundingClientRect(),d=visitorDraw,a=d.args,b=d.bbox,s=box.width/941;
     const person={left:box.x+(a[0]+b[0]/600*a[2])*s,right:box.x+(a[0]+b[2]/600*a[2])*s,top:box.y+(a[1]+b[1]/900*a[3])*s,bottom:box.y+(a[1]+b[3]/900*a[3])*s};
     const beads=[...document.querySelectorAll('.strand-bead')].filter(e=>+getComputedStyle(e).opacity>0).map(e=>e.getBoundingClientRect()).filter(r=>r.right>0&&r.left<innerWidth);
     const thumb=document.querySelector('.thumb-point').getBoundingClientRect(),area=document.querySelector('.beads-area').getBoundingClientRect(),heading=document.querySelector('.scene-heading').getBoundingClientRect(),control=document.querySelector('#controls').getBoundingClientRect();
     return {person,sourceAlphaBBox:b,gap:document.body.dataset.hand==='right'?Math.min(...beads.map(r=>r.left))-person.right:person.left-Math.max(...beads.map(r=>r.right)),thumbX:thumb.x+thumb.width/2,thumbY:thumb.y+thumb.height/2,thumbPercent:(thumb.y+thumb.height/2)/innerHeight*100,panelTop:control.top,touchTop:parseFloat(getComputedStyle(document.querySelector('.beads-area')).getPropertyValue('--bead-touch-top')),headingBottom:heading.bottom,topClear:beads.every(r=>r.top>=100),behindPanel:area.bottom>control.top,scroll:document.documentElement.scrollWidth>innerWidth||document.documentElement.scrollHeight>innerHeight};} """)
    assert m['gap']>=16,(w,id,hand,m)
    assert 63<=m['thumbPercent']<=66 and m['topClear'] and m['behindPanel'] and m['touchTop']>=m['headingBottom'] and not m['scroll'],m
    # Conservative sweep: every arc position and a rotated 56px bead rectangle, not just initial nodes.
    gap=p.evaluate("""async ({person,hand})=>{const {beadArc}=await import('./beads.js');const w=innerWidth,h=innerHeight,size=Math.max(48,Math.min(58,w*.142));let gap=Infinity;for(let off=-600;off<600;off+=2){const p=beadArc(w,h,off,hand==='left'),a=p.angle*Math.PI/180,scale=1.07,half=size*.5*scale*(Math.abs(Math.cos(a))+Math.abs(Math.sin(a)));if(p.y-half<100||p.y-half>document.querySelector('#controls').getBoundingClientRect().top)continue;if(Math.min(p.x,w-p.x)<size*.76+10)continue;const tasselX=-Math.sin(a)*size*1.12*scale;gap=Math.min(gap,hand==='right'?p.x-half+Math.min(0,tasselX)-person.right:person.left-p.x-half-Math.max(0,tasselX));}return gap} """,{'person':m['person'],'hand':hand})
    assert gap>=16,(w,id,hand,gap);rows.append(dict(width=w,height=h,visitor=id,hand=hand,sweepGap=gap,**m))
    if id=='bun-light' and w in [375,393]:
     for period,hour in [('day',10),('night',21)]:
      p.clock.set_fixed_time(datetime(2026,11,5,hour,tzinfo=timezone.utc));p.wait_for_function(f"document.body.dataset.period==='{period}'");p.wait_for_timeout(300)
      p.evaluate("""m=>{const e=document.createElement('div');e.id='measurement';e.style='position:fixed;inset:0;pointer-events:none;z-index:999';e.innerHTML=`<svg width="100%" height="100%"><circle cx="${m.thumbX}" cy="${m.thumbY}" r="36" fill="none" stroke="#f5dfad" stroke-width="2" stroke-dasharray="4 3"/><path d="M0 ${m.thumbY}H${innerWidth}" stroke="#f5dfad" stroke-dasharray="4 4" opacity=".6"/></svg><span style="position:absolute;top:${m.thumbY+40}px;left:12px;background:#29271fe8;color:#fff4d9;padding:6px 9px;border-radius:4px;font:12px system-ui">y=${m.thumbY.toFixed(1)}px · ${m.thumbPercent.toFixed(1)}% H</span>`;document.body.append(e)}""",m)
      p.screenshot(path=str(out/f'{w}x{h}-{period}-{hand}.png'));p.locator('#measurement').evaluate('(e)=>e.remove()')
     p.clock.set_fixed_time(datetime(2026,11,5,10,tzinfo=timezone.utc));p.wait_for_timeout(350)
  c.close()
 b.close()
(out/'checks.json').write_text(json.dumps(rows,indent=2));print(json.dumps({'cases':len(rows),'minGap':min(r['sweepGap'] for r in rows),'thumbPercent':[min(r['thumbPercent'] for r in rows),max(r['thumbPercent'] for r in rows)]}))
