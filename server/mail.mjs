import {createHash,createHmac} from 'node:crypto';
const sha=value=>createHash('sha256').update(value).digest('hex');
const hmac=(key,value,encoding)=>createHmac('sha256',key).update(value).digest(encoding);
export async function sendMail(settings,family,message){
  if(settings.mailProvider==='outbox'){const {putOutbox}=await import('./outbox-staging.mjs');putOutbox(family.db,message);return;}
  if(settings.mailProvider==='resend'){
    if(!settings.resendKey)throw Error('mail_not_configured');
    const r=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${settings.resendKey}`,'Content-Type':'application/json'},body:JSON.stringify({from:settings.mailFrom,to:[message.to],subject:message.subject,text:message.text,html:message.html})});
    if(!r.ok)throw Error('mail_unavailable');return;
  }
  if(settings.mailProvider==='ses'){
    const {sesRegion:region,awsAccessKey:id,awsSecretKey:secret}=settings;if(!region||!id||!secret)throw Error('mail_not_configured');
    const host=`email.${region}.amazonaws.com`,path='/v2/email/outbound-emails',date=new Date(),amz=date.toISOString().replace(/[:-]|\.\d{3}/g,''),day=amz.slice(0,8);
    const body=JSON.stringify({FromEmailAddress:settings.mailFrom,Destination:{ToAddresses:[message.to]},Content:{Simple:{Subject:{Data:message.subject,Charset:'UTF-8'},Body:{Text:{Data:message.text,Charset:'UTF-8'},Html:{Data:message.html,Charset:'UTF-8'}}}}});
    const headers=`content-type:application/json\nhost:${host}\nx-amz-date:${amz}\n`,signed='content-type;host;x-amz-date',canonical=`POST\n${path}\n\n${headers}\n${signed}\n${sha(body)}`,scope=`${day}/${region}/ses/aws4_request`,string=`AWS4-HMAC-SHA256\n${amz}\n${scope}\n${sha(canonical)}`;
    const kDate=hmac(`AWS4${secret}`,day),kRegion=hmac(kDate,region),kService=hmac(kRegion,'ses'),key=hmac(kService,'aws4_request'),signature=hmac(key,string,'hex');
    const authorization=`AWS4-HMAC-SHA256 Credential=${id}/${scope}, SignedHeaders=${signed}, Signature=${signature}`;
    const r=await fetch(`https://${host}${path}`,{method:'POST',headers:{'Content-Type':'application/json','X-Amz-Date':amz,Authorization:authorization},body});if(!r.ok)throw Error('mail_unavailable');return;
  }
  throw Error('mail_disabled');
}
