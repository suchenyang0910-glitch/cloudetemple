// Local HTTP preview with the real Pages handler and an explicitly ephemeral KV substitute.
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {onRequest} from '../functions/api/waitlist.js';
const root=fileURLToPath(new URL('../',import.meta.url)),store=new Map();
const env={WAITLIST_SECRET:'local-preview-only-not-a-production-secret',WAITLIST:{async get(k){const r=store.get(k);return r&&r.until>Date.now()?r.value:null;},async put(k,v,o){store.set(k,{value:v,until:Date.now()+o.expirationTtl*1000});}}};
const mime={'.html':'text/html; charset=utf-8','.css':'text/css','.js':'text/javascript','.json':'application/json','.webp':'image/webp','.png':'image/png','.m4a':'audio/mp4','.mp3':'audio/mpeg','.woff2':'font/woff2','.txt':'text/plain; charset=utf-8'};
const allowed=new Set(['index.html','preload.js','styles.css','app.js','config.js','i18n.js','telegram.js','audio.js','audio-debug.js','analytics.js','resources.js','beads.js','bow.js','incense.js','referrals.js','morning.js','festival.js','gioi-thieu.html','quyen-rieng-tu.html','dieu-khoan.html','family.html','family.css','family.js','family-analytics.js','family-i18n.js','family-consent.js','calendar-presale.html','calendar-presale.css','calendar-presale.js','dev-outbox.html','dev-outbox.js','admin.html','admin.css','admin.js']);
const server=http.createServer(async(req,res)=>{
  try{
    const url=new URL(req.url,'http://127.0.0.1');
    if(url.pathname==='/api/waitlist'){
      const chunks=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>4096){res.writeHead(413);res.end();return;}chunks.push(chunk);}
      const headers=new Headers(req.headers);headers.set('CF-Connecting-IP','127.0.0.1');
      const response=await onRequest({request:new Request('http://'+req.headers.host+url.pathname,{method:req.method,headers,...(req.method==='POST'?{body:Buffer.concat(chunks)}:{})}),env});
      res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));return;
    }
    let name=decodeURIComponent(url.pathname).replace(/^\/+|\/+$/g, '')||'index.html';if(name==='dev/outbox')name='dev-outbox.html';if(['gioi-thieu','quyen-rieng-tu','dieu-khoan'].includes(name))name+='.html';
    if(name==='en')name='static/en/index.html';else if(/^(en\/)?(huong-dan\/(thap-huong|le-phat|lan-chuoi|go-mo|ngoi-yen)|cau-hoi-thuong-gap)$/.test(name))name='static/'+name+'/index.html';
    if(!allowed.has(name)&&!/^static\/(en\/)?(huong-dan\/(thap-huong|le-phat|lan-chuoi|go-mo|ngoi-yen)|cau-hoi-thuong-gap)\/index\.html$/.test(name)&&name!=='static/en/index.html'&&!/^assets\/share\/[a-z0-9-]+\.webp$/.test(name)&&!/^assets\/fonts\/[a-zA-Z0-9-]+\.(woff2|txt)$/.test(name)&&!/^assets\/family\/[a-z0-9-]+\.(webp|woff2|txt)$/.test(name)&&!/^assets\/audio\/[a-z0-9-]+\.(m4a|mp3)$/.test(name)&&!/^assets\/processed-v1\/((img|mobile)\/[a-z0-9-]+\.(webp|png)|layout-v1\.json)$/.test(name)){res.writeHead(404);res.end('Not found');return;}
    const file=['admin.html','admin.css','admin.js'].includes(name)?path.join('admin-ui',name):name;
    let content=await fs.readFile(path.join(root,file));if(name==='index.html'&&url.searchParams.get('debug')==='audio')content=Buffer.from(content.toString().replace('</body>','<script type="module" src="audio-debug.js"></script></body>'));res.writeHead(200,{'Content-Type':mime[path.extname(name)]||'application/octet-stream','Cache-Control':'no-store'});res.end(content);
  }catch{res.writeHead(404);res.end('Not found');}
});
server.listen(Number(process.env.PORT||8788),'127.0.0.1',()=>console.log('Cloud Temple preview: http://127.0.0.1:'+server.address().port+' (waitlist uses memory only)'));
