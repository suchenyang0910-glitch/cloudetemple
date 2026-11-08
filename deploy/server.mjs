import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {isIP} from 'node:net';
import {onRequest} from '../functions/api/waitlist.js';
import {createStore} from './store.mjs';

const root=fileURLToPath(new URL('../dist/',import.meta.url));
const origin=new URL(process.env.PUBLIC_ORIGIN).origin;
if(!process.env.WAITLIST_SECRET||process.env.WAITLIST_SECRET.length<32)throw Error('WAITLIST_SECRET is required');
const store=createStore(process.env.WAITLIST_DB||'/data/waitlist.sqlite');
const env={WAITLIST:store,WAITLIST_SECRET:process.env.WAITLIST_SECRET};
const headers={'X-Content-Type-Options':'nosniff','X-Frame-Options':'DENY','Referrer-Policy':'strict-origin-when-cross-origin','Permissions-Policy':'camera=(), microphone=(), geolocation=()'};
const headerFile=await fs.readFile(path.join(root,'_headers'),'utf8');
headers['Content-Security-Policy']=headerFile.match(/Content-Security-Policy:\s*(.+)/)[1].trim();
const types={'.html':'text/html; charset=utf-8','.css':'text/css','.js':'text/javascript','.json':'application/json','.webp':'image/webp','.svg':'image/svg+xml','.png':'image/png','.mp3':'audio/mpeg','.m4a':'audio/mp4','.woff2':'font/woff2'};
async function publicFiles(dir='',files=new Set()){
  for(const entry of await fs.readdir(path.join(root,dir),{withFileTypes:true})){
    const name=path.posix.join(dir,entry.name);
    if(entry.isDirectory())await publicFiles(name,files);
    else if(!entry.name.startsWith('_'))files.add(name);
  }
  return files;
}
const files=await publicFiles();
const server=http.createServer(async(req,res)=>{
  for(const [k,v] of Object.entries(headers))res.setHeader(k,v);
  try{
    const url=new URL(req.url,origin);
    if(url.pathname==='/healthz'){res.writeHead(200,{'Content-Type':'text/plain','Cache-Control':'no-store'});res.end('ok');return;}
    if(url.pathname==='/api/waitlist'){
      // Only Caddy can reach the loopback-published port; it overwrites this header with the TCP peer address.
      const ip=req.headers['x-cloudtemple-client-ip'];
      if(typeof ip!=='string'||!isIP(ip)){res.writeHead(403);res.end();return;}
      if(req.method==='POST'&&req.headers.origin!==origin){res.writeHead(403);res.end();return;}
      const chunks=[];let size=0;
      for await(const chunk of req){size+=chunk.length;if(size>4096){res.writeHead(413);res.end();return;}chunks.push(chunk);}
      const h=new Headers(req.headers);h.set('CF-Connecting-IP',ip);
      const response=await onRequest({request:new Request(origin+url.pathname,{method:req.method,headers:h,...(['GET','HEAD'].includes(req.method)?{}:{body:Buffer.concat(chunks)})}),env});
      res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));return;
    }
    if(!['GET','HEAD'].includes(req.method)){res.writeHead(405,{'Allow':'GET, HEAD'});res.end();return;}
    const name=decodeURIComponent(url.pathname).replace(/^\/+/, '')||'index.html';
    if(!files.has(name)){res.writeHead(404);res.end('Not found');return;}
    const data=await fs.readFile(path.join(root,name));
    res.writeHead(200,{'Content-Type':types[path.extname(name)],'Cache-Control':name.endsWith('.webp')?'public, max-age=86400':'no-cache','Content-Length':data.length});res.end(req.method==='HEAD'?undefined:data);
  }catch{res.writeHead(500,{'Cache-Control':'no-store'});res.end('Unavailable');}
});
server.requestTimeout=15000;server.headersTimeout=10000;
server.listen(Number(process.env.PORT||8789),'0.0.0.0',()=>console.log('Cloud Temple ready on '+server.address().port));
process.on('SIGTERM',()=>server.close(()=>{store.close();process.exit(0);}));
