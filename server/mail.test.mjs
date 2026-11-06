import test from 'node:test';
import assert from 'node:assert/strict';
import {sendMail} from './mail.mjs';

test('Resend requests identify the application and request JSON',async()=>{
  const original=globalThis.fetch;
  let request;
  globalThis.fetch=async(url,options)=>(request={url,options},{ok:true});
  try{
    await sendMail({mailProvider:'resend',resendKey:'test-key',mailFrom:'Chua May <test@example.com>'},{},{to:'recipient@example.com',subject:'Test',text:'Test',html:'<p>Test</p>'});
  }finally{globalThis.fetch=original;}
  assert.equal(request.url,'https://api.resend.com/emails');
  assert.equal(request.options.headers['User-Agent'],'ChuaMay/1.0');
  assert.equal(request.options.headers.Accept,'application/json');
});
