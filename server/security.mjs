import {createHmac,timingSafeEqual} from 'node:crypto';
import {BlockList,isIP} from 'node:net';
import ranges from './cloudflare-ips.json' with {type:'json'};
const cf=new BlockList();for(const range of ranges){const [ip,prefix]=range.split('/');cf.addSubnet(ip,Number(prefix),isIP(ip)===6?'ipv6':'ipv4');}
export const equal=(a,b)=>{const x=Buffer.from(a||''),y=Buffer.from(b||'');return x.length===y.length&&timingSafeEqual(x,y);};
export const hash=(secret,text)=>createHmac('sha256',secret).update(text).digest('hex');
export function clientIP(req,trustLocal){
  const normalize=ip=>ip?.replace(/^::ffff:/,'');
  let peer=normalize(req.socket.remoteAddress);
  if(trustLocal&&['127.0.0.1','::1'].includes(peer))peer=normalize(req.headers['x-chuamay-peer']);
  if(!peer||!isIP(peer))throw Error('peer');
  const forwarded=normalize(req.headers['cf-connecting-ip']);
  return cf.check(peer,isIP(peer)===6?'ipv6':'ipv4')&&forwarded&&isIP(forwarded)?forwarded:peer;
}
export function validateInitData(raw,token,now=Date.now()){
  if(typeof raw!=='string'||raw.length>8192)throw Error('initData');
  const data=new URLSearchParams(raw),seen=new Set();for(const [key] of data){if(seen.has(key))throw Error('duplicate');seen.add(key);}
  const signature=data.get('hash');if(!/^[a-f0-9]{64}$/i.test(signature||''))throw Error('hash');data.delete('hash');
  const check=[...data].sort(([a],[b])=>a<b?-1:a>b?1:0).map(([k,v])=>`${k}=${v}`).join('\n');
  const secret=createHmac('sha256','WebAppData').update(token).digest();
  if(!equal(hash(secret,check),signature.toLowerCase()))throw Error('signature');
  const date=Number(data.get('auth_date'));
  if(!Number.isInteger(date)||date*1000<now-86400000||date*1000>now+120000)throw Error('expired');
  const user=JSON.parse(data.get('user'));if(!Number.isSafeInteger(user?.id)||user.id<=0)throw Error('user');
  return {id:String(user.id),language:user.language_code?.startsWith('vi')?'vi':'en'};
}
export function config(env){
  const flag=env.TELEGRAM_ENABLED??'1';
  if(!['0','1'].includes(flag))throw Error('Invalid TELEGRAM_ENABLED');
  const telegramEnabled=flag==='1';
  const required=telegramEnabled?['TELEGRAM_BOT_TOKEN','TELEGRAM_WEBHOOK_SECRET','HASH_SECRET']:['HASH_SECRET'];
  for(const k of required)if(!env[k]?.trim())throw Error(`Missing ${k}`);
  if(env.HASH_SECRET.length<32||(telegramEnabled&&!/^[A-Za-z0-9_-]{32,256}$/.test(env.TELEGRAM_WEBHOOK_SECRET)))throw Error('Invalid secret configuration');
  const origins=new Set((env.ALLOWED_ORIGINS||'').split(',').map(s=>s.trim()).filter(Boolean));
  for(const origin of origins){let url;try{url=new URL(origin);}catch{throw Error('Invalid ALLOWED_ORIGINS');}if(url.origin!==origin||url.protocol!=='https:'||url.username||url.password)throw Error('Invalid ALLOWED_ORIGINS');}
  const mini=env.MINIAPP_URL||'https://miniapp.chuamay.org';if(!['https://miniapp.chuamay.org','https://staging.chuamay.org'].includes(new URL(mini).origin))throw Error('Invalid Mini App origin');
  const environment=env.CHUAMAY_ENV||'production';if(!['staging','production'].includes(environment))throw Error('Invalid CHUAMAY_ENV');
  const familyFlag=env.FAMILY_ENABLED??(environment==='staging'?'1':'0');if(!['0','1'].includes(familyFlag))throw Error('Invalid FAMILY_ENABLED');
  const familyEnabled=familyFlag==='1';if(environment==='production'&&familyEnabled)throw Error('Family pilot is staging-only');
  const mailProvider=env.MAIL_PROVIDER||(environment==='staging'?'outbox':'disabled');if(!['outbox','resend','ses','disabled'].includes(mailProvider))throw Error('Invalid MAIL_PROVIDER');
  if(environment==='production'&&mailProvider==='outbox')throw Error('Outbox is staging-only');
  const adminFlag=env.ADMIN_ENABLED??'0';if(!['0','1'].includes(adminFlag))throw Error('Invalid ADMIN_ENABLED');
  const adminEnabled=adminFlag==='1';if(environment==='production'&&adminEnabled)throw Error('Admin pilot is staging-only');
  const referralFlag=env.REFERRALS_ENABLED??(environment==='staging'?'1':'0');if(!['0','1'].includes(referralFlag))throw Error('Invalid REFERRALS_ENABLED');const referralsEnabled=referralFlag==='1';
  const presenceFlag=env.PRESENCE_ENABLED??(environment==='staging'?'1':'0');if(!['0','1'].includes(presenceFlag))throw Error('Invalid PRESENCE_ENABLED');const presenceEnabled=presenceFlag==='1';
  const accessTeamDomain=(env.CF_ACCESS_TEAM_DOMAIN||'').trim().toLowerCase(),accessAud=(env.CF_ACCESS_AUD||'').trim(),adminEmails=new Set((env.ADMIN_EMAILS||'').split(',').map(s=>s.trim().toLowerCase()).filter(Boolean));
  if(adminEnabled&&(!/^[a-z0-9-]+\.cloudflareaccess\.com$/.test(accessTeamDomain)||!/^[A-Za-z0-9_-]{8,256}$/.test(accessAud)||adminEmails.size!==1||![...adminEmails].every(email=>/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))))throw Error('Invalid admin access configuration');
  return {telegramEnabled,familyEnabled,referralsEnabled,presenceEnabled,adminEnabled,accessTeamDomain,accessAud,adminEmails,adminOpsPath:env.ADMIN_OPS_STATUS_PATH||'/var/lib/chuamay/staging/admin-ops.json',beadGuruRule:env.BEAD_GURU_RULE||(environment==='staging'?'turn-back':'pass-through'),origins,token:env.TELEGRAM_BOT_TOKEN,webhookSecret:env.TELEGRAM_WEBHOOK_SECRET,hashSecret:env.HASH_SECRET,db:env.DB_PATH||'/var/lib/chuamay/api.sqlite',port:Number(env.PORT||8790),trustLocal:env.TRUST_LOCAL_PROXY==='1',mini,environment,mailProvider,mailFrom:env.MAIL_FROM||'Chùa Mây <no-reply@chuamay.org>',resendKey:env.RESEND_API_KEY,sesRegion:env.SES_REGION,awsAccessKey:env.AWS_ACCESS_KEY_ID,awsSecretKey:env.AWS_SECRET_ACCESS_KEY,googleId:env.GOOGLE_CLIENT_ID,googleSecret:env.GOOGLE_CLIENT_SECRET,googleRedirect:env.GOOGLE_REDIRECT_URI||(environment==='staging'?'https://staging.chuamay.org/api/auth/google/callback':'https://api.chuamay.org/auth/google/callback'),familyUrl:environment==='staging'?'https://staging.chuamay.org/family.html':'https://h5.chuamay.org/family.html',lunarLeapRule:env.LUNAR_LEAP_RULE||'regular-month'};
}
