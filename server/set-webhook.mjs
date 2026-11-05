import {config} from './security.mjs';
const settings=config(process.env),url=process.argv[2];
if(!url||!['https://staging.chuamay.org/api/telegram/webhook','https://api.chuamay.org/telegram/webhook'].includes(url))throw Error('Expected staging or API webhook URL');
if(url.includes('api.chuamay.org')&&process.argv[3]!=='approved')throw Error('Production bot requires explicit confirmation');
const r=await fetch(`https://api.telegram.org/bot${settings.token}/setWebhook`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({url,secret_token:settings.webhookSecret,allowed_updates:['message','callback_query']})});
const data=await r.json();if(!data.ok){console.error('Webhook setup failed, status '+r.status);process.exit(1);}console.log('Webhook configured');
