from pathlib import Path
import json
from datetime import datetime,timezone,timedelta
from playwright.sync_api import sync_playwright
out=Path('screenshots/round3/bow-followup');out.mkdir(parents=True,exist_ok=True)
with sync_playwright() as pw:
 b=pw.chromium.launch(headless=True);c=b.new_context(viewport={'width':393,'height':852},record_video_dir=str(out/'raw'),record_video_size={'width':393,'height':852});p=c.new_page();errors=[];p.on('pageerror',lambda e:errors.append(str(e)))
 p.add_init_script("localStorage.setItem('ct-muted','true');localStorage.setItem('ct-visitor',JSON.stringify('bun-light'))")
 p.goto('http://127.0.0.1:8823')
 def ready():p.wait_for_function("document.querySelector('#app').getAttribute('aria-busy')==='false'")
 ready()
 for a in ['enter','continue','bow']:p.locator(f'[data-action={a}]').click();ready()
 p.locator('[data-target="27"]').click()
 p.evaluate("""async()=>{const {audio}=await import('/app.js');window.sounds=[];const strike=audio.strike.bind(audio);audio.strike=(...args)=>{sounds.push({at:performance.now(),args});return strike(...args)};
 window.anchorSamples=[];const draw=CanvasRenderingContext2D.prototype.drawImage;CanvasRenderingContext2D.prototype.drawImage=function(...a){if(this.canvas.id==='scene'&&a.length===5&&a[0] instanceof HTMLCanvasElement)anchorSamples.push(a.slice(1));return draw.apply(this,a)};
 window.panelSamples=[];window.panelNodes=[...document.querySelectorAll('#controls button,#bow-count')];window.panelOriginal=document.querySelector('#controls').firstElementChild;window.sampling=true;const f=()=>{if(!sampling)return;panelSamples.push(panelNodes.map(e=>{const r=e.getBoundingClientRect();return [r.x,r.y,r.width,r.height,e.isConnected]}));requestAnimationFrame(f)};requestAnimationFrame(f);}""")
 p.locator('[data-action=auto]').click();p.wait_for_function("document.querySelector('#bow-count').textContent.startsWith('5 /')",timeout=25000);p.locator('[data-action=auto]').click();p.wait_for_timeout(850)
 result=p.evaluate("""()=>{sampling=false;const first=panelSamples[0];return {frames:panelSamples.length,panelMaxDelta:Math.max(...panelSamples.flatMap(row=>row.flatMap((v,i)=>v.slice(0,4).map((x,j)=>Math.abs(x-first[i][j]))))),nodesRetained:panelNodes.every(e=>e.isConnected)&&panelOriginal===document.querySelector('#controls').firstElementChild,anchorMaxDelta:Math.max(...anchorSamples.flatMap(row=>row.map((x,i)=>Math.abs(x-anchorSamples[0][i])))),sounds,count:document.querySelector('#bow-count').textContent}}""")
 assert result['panelMaxDelta']<=1,result;assert result['anchorMaxDelta']<=1;assert result['nodesRetained'];assert len(result['sounds'])==5,result
 p.screenshot(path=str(out/'five-bows.png'));video=p.video;c.close();video.save_as(str(out/'five-bows-393.webm'))
 c=b.new_context(viewport={'width':375,'height':667});p=c.new_page();p.clock.install();p.add_init_script("localStorage.setItem('ct-muted','true')");p.goto('http://127.0.0.1:8823');ready()
 for a in ['enter','continue','bow']:p.locator(f'[data-action={a}]').click();ready()
 p.evaluate("""async()=>{const {audio}=await import('/app.js');window.sounds=[];audio.strike=(...args)=>sounds.push({at:performance.now(),args});}""")
 p.clock.pause_at(datetime.fromtimestamp(p.evaluate('Date.now()')/1000,timezone.utc)+timedelta(seconds=1));p.locator('[data-action=auto]').click();p.clock.run_for(1000);assert p.evaluate('sounds.length')==0, p.evaluate('sounds')
 p.clock.run_for(300);assert p.evaluate('sounds.length')==1
 p.clock.run_for(10100);assert p.locator('[data-action=share]').is_visible();p.screenshot(path=str(out/'completed-375.png'));sounds=p.evaluate('sounds');assert len(sounds)==4 and sounds[-1]['args']==['bell',.8],sounds
 # Each keisu is 2.5s before that bow's final completion bell (1.2s versus 3.7s).
 assert 2450<=sounds[-1]['at']-sounds[-2]['at']<=2550,sounds
 result['completionSounds']=sounds;result['errors']=errors;assert not errors;c.close();b.close()
(out/'checks.json').write_text(json.dumps(result,indent=2),encoding='utf-8');print(json.dumps({k:v for k,v in result.items() if k!='sounds'}))
