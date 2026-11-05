const cooldowns=new Map();
const reply=(status,error=null,headers={})=>new Response(JSON.stringify(error?{ok:false,error}:{ok:true}),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store',...headers}});
async function digest(secret,value){const enc=new TextEncoder(),key=await crypto.subtle.importKey('raw',enc.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);return Array.from(new Uint8Array(await crypto.subtle.sign('HMAC',key,enc.encode(value))),x=>x.toString(16).padStart(2,'0')).join('');}
async function limitedJSON(request){
  const reader=request.body?.getReader();if(!reader)throw new Error('body');let size=0,parts=[];
  try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>4096){await reader.cancel();throw new Error('large');}parts.push(value);}}finally{reader.releaseLock();}
  const bytes=new Uint8Array(size);let offset=0;for(const part of parts){bytes.set(part,offset);offset+=part.length;}return JSON.parse(new TextDecoder().decode(bytes));
}
export async function onRequest({request,env}){
  if(request.method!=='POST')return reply(405,'method',{'Allow':'POST'});
  const origin=request.headers.get('Origin');if(origin&&origin!==new URL(request.url).origin)return reply(403,'origin');
  if(!request.headers.get('Content-Type')?.toLowerCase().startsWith('application/json'))return reply(415,'content_type');
  if(!env.WAITLIST||typeof env.WAITLIST_SECRET!=='string'||env.WAITLIST_SECRET.length<32)return reply(503,'unavailable');
  let body;try{body=await limitedJSON(request);}catch{return reply(400,'body');}
  if(!body||typeof body!=='object'||Array.isArray(body))return reply(400,'invalid');
  const email=typeof body.email==='string'?body.email.trim().toLowerCase():'',date=typeof body.consentAt==='string'?Date.parse(body.consentAt):NaN,now=Date.now();
  if(email.length>254||!/^[^\s@<>]+@[^\s@<>.]+(?:\.[^\s@<>.]+)+$/.test(email)||!['vi','en'].includes(body.language)||body.consent!==true||!Number.isFinite(date)||date<now-600000||date>now+120000)return reply(400,'invalid');
  const ip=request.headers.get('CF-Connecting-IP');if(!ip)return reply(503,'unavailable');
  try{
    const rateKey='rate:'+await digest(env.WAITLIST_SECRET,ip),emailKey='email:'+await digest(env.WAITLIST_SECRET,email);
    for(const [key,expiry] of cooldowns)if(expiry<=now)cooldowns.delete(key);
    if(cooldowns.has(rateKey))return reply(429,'rate_limit',{'Retry-After':'60'});
    if(cooldowns.size>=10000)return reply(503,'busy');
    cooldowns.set(rateKey,now+60000);
    try{
      // shortcut: KV rate limits are eventually consistent; add an edge rate-limit rule before public launch.
      if(await env.WAITLIST.get(rateKey))return reply(429,'rate_limit',{'Retry-After':'60'});
      // Write the registration first so a failed registration cannot leave a rate-limit key.
      await env.WAITLIST.put(emailKey,JSON.stringify({email,language:body.language,consentAt:new Date(date).toISOString(),receivedAt:new Date(now).toISOString(),consentVersion:'launch-90d-v1'}),{expirationTtl:90*86400});
      await env.WAITLIST.put(rateKey,'1',{expirationTtl:60});
    }catch(error){cooldowns.delete(rateKey);throw error;}
    return reply(201);
  }catch{return reply(503,'unavailable');}
}
