import http from 'node:http';
import {loadCalendar,lookupFestival,festivalToday,festivalMidnightMs} from './festival.mjs';
import {equal,hash,clientIP,validateInitData} from './security.mjs';
import {botCopy} from './bot-copy.mjs';
export function createServer(settings,store,send=async(method,body)=>{const r=await fetch(`https://api.telegram.org/bot${settings.token}/${method}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(10000)});if(!r.ok||!(await r.json()).ok)throw Error('telegram unavailable');},family=async()=>false,observe=()=>{}){
  const calendar=loadCalendar();
  let weatherCache={data:null,exp:0};
  const cooldown=new Map(),updates=new Map();
  return http.createServer(async(req,res)=>{
    res.once('finish',()=>{try{observe(res.statusCode);}catch{}});
    const reply=(status,error,data={})=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(error?{ok:false,error}:{ok:true,...data}));};
    try{
      const route=new URL(req.url,'http://localhost').pathname,origin=req.headers.origin;
      if(route==='/healthz'&&req.method==='GET')return reply(200,null,settings.telegramEnabled===false?{telegram:'disabled'}:{});
      if(route==='/api/weather/hcmc'&&req.method==='GET'){const now=Date.now();if(!weatherCache.data||now>=weatherCache.exp){try{const wr=await fetch('https://api.open-meteo.com/v1/forecast?latitude=10.8231&longitude=106.6297&current=precipitation,weather_code&timezone=Asia%2FHo_Chi_Minh',{signal:AbortSignal.timeout(5000)});const wj=await wr.json();const code=wj.current?.weather_code??0;const raining=[51,53,55,56,57,61,63,65,66,67,80,81,82,95,96,99].includes(code)||(wj.current?.precipitation??0)>0;weatherCache={data:{raining},exp:now+15*60*1000};}catch{weatherCache={data:{raining:false},exp:now+60*1000};}}const wttl=Math.max(60,Math.floor((weatherCache.exp-Date.now())/1000));res.writeHead(200,{'Content-Type':'application/json','Cache-Control':`public, max-age=${wttl}`,'Access-Control-Allow-Origin':'*'});res.end(JSON.stringify({raining:weatherCache.data.raining,valid_until:new Date(weatherCache.exp).toISOString()}));return;}
      if(route==='/api/festival/current'&&req.method==='GET'){const entry=lookupFestival(calendar,festivalToday());const exp=festivalMidnightMs();const ttl=Math.max(60,Math.floor((exp-Date.now())/1000));res.writeHead(200,{'Content-Type':'application/json','Cache-Control':`public, max-age=${ttl}`,'Access-Control-Allow-Origin':'*'});res.end(JSON.stringify({festival:entry?.festival??null,temple_highlight:entry?.temple??null,valid_until:new Date(exp).toISOString()}));return;}
      if(origin&&!settings.origins?.has(origin))return reply(403,'origin');
      if(origin){res.setHeader('Access-Control-Allow-Origin',origin);res.setHeader('Vary','Origin');}
      if(settings.telegramEnabled===false&&route.startsWith('/telegram/'))return reply(503,'telegram_disabled');
      if(req.method==='OPTIONS'){if(!origin)return reply(403,'origin');res.setHeader('Access-Control-Allow-Methods','GET, POST, PATCH, PUT, DELETE, OPTIONS');res.setHeader('Access-Control-Allow-Headers','Content-Type, X-CSRF-Token, Idempotency-Key');return reply(204);}
      if(await family(req,res,route))return;
      if(!['/waitlist','/telegram/remind','/telegram/webhook'].includes(route))return reply(404,'route');
      if(req.method!=='POST'){res.setHeader('Allow','POST');return reply(405,'method');}
      if(route==='/telegram/webhook'){if(!equal(req.headers['x-telegram-bot-api-secret-token'],settings.webhookSecret))return reply(401,'secret');}
      else if(!origin&&req.headers['sec-fetch-site']!=='same-origin')return reply(403,'origin');
      if(!/^application\/json(?:\s*;|$)/i.test(req.headers['content-type']||''))return reply(415,'content_type');
      const chunks=[];let size=0;for await(const part of req){size+=part.length;if(size>(route==='/waitlist'?4096:16384))return reply(400,'body');chunks.push(part);}
      let body;try{body=JSON.parse(Buffer.concat(chunks));}catch{return reply(400,'body');}
      if(!body||typeof body!=='object'||Array.isArray(body))return reply(400,'invalid');
      const now=Date.now(),consent=Date.parse(body.consentAt);
      const validConsent=body.consent===true&&typeof body.consentAt==='string'&&Number.isFinite(consent)&&consent>=now-600000&&consent<=now+120000;
      if(route==='/waitlist'){
        const email=typeof body.email==='string'?body.email.trim().toLowerCase():'';
        if(!validConsent||email.length>254||!/^[^\s@<>]+@[^\s@<>.]+(?:\.[^\s@<>.]+)+$/.test(email)||!['vi','en'].includes(body.language))return reply(400,'invalid');
        const ipKey=hash(settings.hashSecret,clientIP(req,settings.trustLocal));
        for(const [key,expiry] of cooldown)if(expiry<=now)cooldown.delete(key);
        if(cooldown.get(ipKey)>now){res.setHeader('Retry-After','60');return reply(429,'rate_limit');}
        const saved=store.register({ipKey,emailKey:hash(settings.hashSecret,email),email,language:body.language,consentAt:new Date(consent).toISOString()},now);
        if(!saved){res.setHeader('Retry-After','60');return reply(429,'rate_limit');}
        if(cooldown.size<10000)cooldown.set(ipKey,now+60000);
        return reply(201);
      }
      if(route==='/telegram/remind'){
        if(!validConsent)return reply(400,'consent');let user;try{user=validateInitData(body.initData,settings.token);}catch{return reply(401,'init_data');}
        store.remind(user,new Date(consent).toISOString());return reply(201);
      }
      if(!Number.isSafeInteger(body.update_id))return reply(400,'update');
      for(const [id,entry] of updates)if(entry.expires<=now)updates.delete(id);
      if(updates.has(body.update_id))return reply(updates.get(body.update_id).done?200:503);
      if(updates.size>=10000)return reply(503,'busy');updates.set(body.update_id,{expires:now+86400000,done:false});
      try{
        const callback=body.callback_query,from=callback?.from||body.message?.from;
        if(!Number.isSafeInteger(from?.id)||from.id<=0){updates.delete(body.update_id);return reply(400,'user');}
        const language=from.language_code?.startsWith('vi')?'vi':'en',copy=botCopy[language];
        if(callback?.data==='delete-data'){
          store.remove(from.id);await send('answerCallbackQuery',{callback_query_id:callback.id,text:copy.deleted});
        }else if(body.message?.chat?.type==='private'&&body.message.chat.id===from.id){
          const command=body.message.text?.match(/^\/(start|help|privacy)(?:@[\w]+)?(?:\s|$)/)?.[1];
          if(command){const keyboard=command==='privacy'?[[{text:copy.remove,callback_data:'delete-data'}]]:[[{text:copy.enter,web_app:{url:settings.mini}}]];
            await send('sendMessage',{chat_id:from.id,text:copy[command],reply_markup:{inline_keyboard:keyboard}});}
        }
        updates.set(body.update_id,{expires:now+86400000,done:true});return reply(200);
      }catch(error){updates.delete(body.update_id);throw error;}
    }catch{return reply(503,'unavailable');}
  });
}
