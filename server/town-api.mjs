import {randomBytes} from 'node:crypto';
import {hash,equal,clientIP,validateInitData} from './security.mjs';
import {draftTownNames} from './town-name-policy.mjs';

export const townPrefix='/api/pet-garden/town';
const guestCookie='ct_town_name',uuid=/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i;
const cookies=req=>Object.fromEntries((req.headers.cookie||'').split(/;\s*/).map(v=>v.split(/=(.*)/s)).filter(v=>v[0]));
const reject=(code,status=400)=>{throw Object.assign(Error(code),{status});};
async function body(req){if(!/^application\/json(?:\s*;|$)/i.test(req.headers['content-type']||''))reject('content_type',415);
  const chunks=[];let n=0;for await(const chunk of req.iterator({destroyOnReturn:false})){n+=chunk.length;if(n>2048)reject('body',413);chunks.push(chunk);}
  let value;try{value=JSON.parse(Buffer.concat(chunks));}catch{reject('body');}if(!value||typeof value!=='object'||Array.isArray(value))reject('body');return value;
}
const json=(res,status,data)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(data));return true;};
export function createTownAccountReader(db,clock=Date.now){return {
  sessionUser(token,scope){return db.prepare('SELECT s.user_id,s.csrf_hash FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.scope=? AND s.expires_at>? AND u.deleted_at IS NULL').get(token,scope,clock());},
  identityUser(provider,subject){return db.prepare('SELECT u.id FROM users u JOIN identities i ON i.user_id=u.id WHERE i.provider=? AND i.subject=? AND u.deleted_at IS NULL').get(provider,subject);}
};}
export function createTownApi(settings,store,{family,access,clock=Date.now,adminOrigin='https://adminchy-staging.chuamay.org',names=draftTownNames}={}){
  if(settings.environment!=='staging'&&!(settings.environment==='production'&&store.isolated&&names.reviewed))throw Error('town_staging_only');
  const sign=value=>hash(settings.hashSecret,'town-cookie:'+value);
  function guest(req){try{const raw=cookies(req)[guestCookie];if(!raw||raw.length>600)return null;const [encoded,signature,extra]=raw.split('.');if(extra||!equal(sign(encoded),signature))return null;const data=JSON.parse(Buffer.from(encoded,'base64url'));return /^[a-f0-9]{32}$/.test(data.id)&&typeof data.name==='string'&&data.exp>clock()?data:null;}catch{return null;}}
  function setGuest(res,id,name){const data=Buffer.from(JSON.stringify({id,name,exp:clock()+365*86400000})).toString('base64url');res.setHeader('Set-Cookie',`${guestCookie}=${data}.${sign(data)}; Path=${townPrefix}; HttpOnly; Secure; SameSite=Strict; Max-Age=31536000`);}
  function identify(req,requireCsrf=true){
    const jar=cookies(req),authorization=req.headers.authorization;
    if(authorization&&!/^Basic /i.test(authorization)){
      if(!authorization.startsWith('Telegram ')||!settings.telegramEnabled)reject('identity',401);
      let account;try{const user=validateInitData(authorization.slice(9),settings.token,clock());account=family?.identityUser('telegram',hash(settings.hashSecret,user.id));}catch{reject('identity',401);}
      if(!account)reject('existing_login_required',401);return {ref:'user:'+account.id,userId:account.id};
    }
    for(const [cookie,scope] of [['ct_pet_session','pet'],['ct_session','family']]){
      if(!jar[cookie])continue;const user=family?.sessionUser(hash(settings.hashSecret,jar[cookie]),scope);
      if(!user)reject('identity',401);
      const csrf=hash(settings.hashSecret,'town-csrf:'+jar[cookie]);
      if(requireCsrf&&!equal(req.headers['x-csrf-token'],csrf)&&!equal(hash(settings.hashSecret,req.headers['x-csrf-token']||''),user.csrf_hash))reject('csrf',403);
      return {ref:'user:'+user.user_id,userId:user.user_id,csrf};
    }
    const saved=guest(req),id=saved?.id||randomBytes(16).toString('hex');return {ref:'guest:'+id,id,saved};
  }
  return async(req,res,route)=>{
    const admin=route.startsWith('/admin/town/');if(!admin&&!route.startsWith(townPrefix+'/'))return false;
    try{
      if(admin){
        let email;try{if(settings.adminEnabled)email=await access?.validate(req.headers['cf-access-jwt-assertion']);}catch{}
        if(!email)return json(res,403,{error:'forbidden'});
        if(route==='/admin/town/reviews'&&req.method==='GET')return json(res,200,{items:store.reviews()});
        if(route!=='/admin/town/review'||req.method!=='POST')reject('route',404);
        if(req.headers.origin!==adminOrigin||(req.headers['sec-fetch-site']&&req.headers['sec-fetch-site']!=='same-origin'))reject('origin',403);
        const input=await body(req);
        if(!uuid.test(input.id)||!uuid.test(input.requestId)||!['allow','reset'].includes(input.action)||input.confirmed!==true)reject('confirmation');
        const result=store.moderate({...input,actor:hash(settings.hashSecret,'town-admin:'+email),now:clock()});return json(res,200,{result});
      }
      if(route===townPrefix+'/csrf'&&req.method==='GET'){
        if(req.headers.origin?!settings.origins.has(req.headers.origin):req.headers['sec-fetch-site']!=='same-origin')reject('origin',403);
        return json(res,200,{csrf:identify(req,false).csrf||null});
      }
      if(req.method!=='POST')reject('method',405);
      const origin=req.headers.origin;if(!settings.origins.has(origin))reject('origin',403);
      const input=await body(req),now=clock();
      const ip=hash(settings.hashSecret,'town-rate:'+clientIP(req,settings.trustLocal));if(!store.limit(ip,now,60))reject('rate',429);
      const who=identify(req);if(!store.limit('subject:'+who.ref,now,30))reject('rate',429);
      // Only this signed town cookie may supply the initial account name; an existing account wins.
      const oldGuest=guest(req),cookieName=oldGuest&&(store.get('guest:'+oldGuest.id)?.name||oldGuest.name);
      let profile=store.ensure(who.ref,who.userId,who.saved?.name||cookieName,now);
      if(who.id)setGuest(res,who.id,profile.name);
      const action=route.slice(townPrefix.length+1);
      if(action==='profile')return json(res,200,{name:profile.name,lockedUntil:profile.locked_until,...names.choices(profile.name)});
      if(action==='choices')return json(res,200,names.choices());
      if(action==='name'){
        if(Object.hasOwn(input,'name')||!Number.isSafeInteger(input.candidateId))reject('name_candidate');
        profile=store.save(who.ref,names.candidate(input.candidateId),now,{candidate:true});
        if(who.id)setGuest(res,who.id,profile.name);return json(res,200,{name:profile.name,lockedUntil:profile.locked_until});
      }
      if(action==='ticket')return json(res,200,{ticket:store.issue(who.ref,origin,now),expiresIn:30,protocol:1});
      if(action==='report')return json(res,200,store.report(who.ref,input.actor,now));
      reject('route',404);
    }catch(e){const known=/^(name_|report_|ticket|identity|csrf|origin|rate|body|method|route|confirmation|content_type|existing_login|required|review|request_conflict|busy)/.test(e.message);return json(res,e.status||(e.message==='name_rate'?429:known?400:503),{error:known?e.message:'unavailable'});}
  };
}
