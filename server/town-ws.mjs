import http from 'node:http';
import {createTownCore,limits} from './town-realtime.mjs';
export function createTownSocketServer({WebSocketServer,store,scenes,origins,environment,clock=Date.now,log=()=>{},memory=()=>process.memoryUsage().rss}){
  if(environment!=='staging')throw Error('town_staging_only');
  const core=createTownCore({store,scenes,clock,log});
  const server=http.createServer((req,res)=>{res.writeHead(req.url==='/healthz'?200:404,{'Content-Type':'application/json'});res.end(JSON.stringify({ok:req.url==='/healthz'}));});
  server.maxConnections=limits.connections;server.headersTimeout=5000;server.requestTimeout=5000;server.keepAliveTimeout=1000;
  const wss=new WebSocketServer({noServer:true,maxPayload:limits.payload,perMessageDeflate:false,clientTracking:true,maxFragments:32,maxBufferedChunks:32});
  server.on('upgrade',(req,socket,head)=>{
    if(req.url!=='/town-ws'||!origins.has(req.headers.origin)||core.counts().connections>=limits.connections||memory()>=limits.memory){socket.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n');return;}
    wss.handleUpgrade(req,socket,head,ws=>{
      const c=core.connect({origin:req.headers.origin,send:msg=>{if(ws.readyState!==1)return;if(ws.bufferedAmount>limits.buffer){ws.terminate();return;}ws.send(JSON.stringify(msg));},close:()=>ws.terminate()});
      if(!c){ws.terminate();return;}
      ws.on('error',()=>{log({code:'socket'});core.disconnect(c,true);});
      ws.on('close',()=>core.disconnect(c));
      ws.on('message',(data,binary)=>{try{if(binary)throw Error('binary');core.receive(c,JSON.parse(data.toString()));}catch{log({code:'message'});core.disconnect(c,true);}});
    });
  });
  const timer=setInterval(()=>{try{if(memory()>=limits.memory){log({code:'memory_limit'});core.stop();server.close();clearInterval(timer);return;}core.tick();}catch(error){if(error?.code==='SQLITE_BUSY'){log({code:'store_busy'});return;}log({code:'store'});core.stop();server.close();clearInterval(timer);}},1000);timer.unref();
  return {server,core,close:async()=>{clearInterval(timer);core.stop();for(const ws of wss.clients)ws.terminate();await new Promise(resolve=>server.close(resolve));wss.close();}};
}
