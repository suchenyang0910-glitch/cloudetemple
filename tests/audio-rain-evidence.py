import argparse, base64
from pathlib import Path
from playwright.sync_api import sync_playwright

parser=argparse.ArgumentParser()
parser.add_argument('--url',default='http://127.0.0.1:8788/')
parser.add_argument('--out',required=True)
args=parser.parse_args();out=Path(args.out);out.mkdir(parents=True,exist_ok=True)

with sync_playwright() as p:
 browser=p.chromium.launch(headless=True)
 page=browser.new_page(viewport={'width':360,'height':640})
 page.goto(args.url);page.locator('[data-action=enter]').click();page.wait_for_timeout(800)
 page.locator('#sound-toggle').click();page.wait_for_function("async()=>{const {audio}=await import('/app.js');return audio.enabled&&!audio.loading}")
 for kind in ('rain','rain-strings'):
  data=page.evaluate("""async kind=>{
   const {audio}=await import('/app.js');await audio.load('ambient-rain');const destination=audio.context.createMediaStreamDestination();audio.limiter.connect(destination);
   const chunks=[],recorder=new MediaRecorder(destination.stream,{mimeType:'audio/webm;codecs=opus'});recorder.ondataavailable=e=>chunks.push(e.data);recorder.start();
   await audio.ambient(kind,.32);
   await new Promise(resolve=>setTimeout(resolve,30000));const stopped=new Promise(resolve=>recorder.onstop=resolve);recorder.stop();await stopped;audio.limiter.disconnect(destination);
   const bytes=new Uint8Array(await new Blob(chunks).arrayBuffer());let binary='';for(let i=0;i<bytes.length;i+=32768)binary+=String.fromCharCode(...bytes.subarray(i,i+32768));return btoa(binary);
  }""",kind)
  (out/f'{kind}-30s.webm').write_bytes(base64.b64decode(data))
 browser.close()
