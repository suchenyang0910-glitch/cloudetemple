export const release='__CT_RELEASE__';
export const assetURL=path=>new URL(`assets/${release.startsWith('__')?'':`releases/${release}/`}${path}`,import.meta.url).href;
export const imageStatus=new Map();
export function imageURL(name){
 const pixels=innerWidth<=720?Math.min(720,Math.ceil(innerWidth*(devicePixelRatio||1))):941;
 return assetURL(`processed-v1/${name.startsWith('scene-')&&pixels<=720?'mobile':'img'}/${name}`);
}
export function placeholder(name,message){
 const c=document.createElement('canvas');c.width=name.startsWith('scene-')?941:600;c.height=name.startsWith('scene-')?1672:900;c.placeholder=true;
 const x=c.getContext('2d');x.fillStyle=({'night':'#282a27','dusk':'#c9b59d','dawn':'#ded6c5'})[document.body.dataset.period]||'#e8dfd0';x.fillRect(0,0,c.width,c.height);x.strokeStyle='#8a7965';x.lineWidth=3;x.strokeRect(c.width*.15,c.height*.4,c.width*.7,c.height*.14);x.fillStyle=document.body.dataset.period==='night'?'#e8dfd0':'#594a38';x.textAlign='center';x.font='24px sans-serif';x.fillText(message,c.width/2,c.height*.48,c.width*.65);return c;
}
let debugPanel,debugOut;
export function enableImageDebug(isTelegram){
 const requested=new URLSearchParams(location.search).get('debug')==='img';
 if(!requested&&!(location.hostname==='miniapp.chuamay.org'&&window.Telegram?.WebApp?.initDataUnsafe?.start_param==='debugimg'))return;
 debugPanel=document.createElement('details');debugPanel.id='img-debug';
 const summary=document.createElement('summary');summary.textContent='Image diagnostics';
 debugOut=document.createElement('pre');const copy=document.createElement('button');copy.textContent='Copy';
 copy.onclick=async()=>{try{await navigator.clipboard.writeText(debugOut.textContent);copy.textContent='Copied';}catch{copy.textContent='Select text to copy';}};
 debugPanel.append(summary,debugOut,copy);document.body.append(debugPanel);
 debugPanel.ontoggle=()=>refreshDebug();debugPanel.dataset.mode=isTelegram?'Telegram':'Web';
}
function refreshDebug(){
 if(debugPanel?.open)debugOut.textContent=[release+' | '+location.origin+' | '+debugPanel.dataset.mode,...Array.from(imageStatus.values(),r=>JSON.stringify(r,null,2))].join('\n');
}
export async function loadImage(name,message){
 const url=imageURL(name),start=performance.now(),row={url,attempt:1,state:'loading',path:null,steps:[]};
 const elapsed=()=>Math.round(performance.now()-start);
 const step=(stage,extra={})=>{row.state=stage;row.ms=elapsed();Object.assign(row,extra);if(debugPanel)row.steps.push({stage,ms:row.ms,...extra});imageStatus.set(name,row);refreshDebug();};
 const controller=new AbortController();let timer,objectURL;
 try{
  step('fetch');timer=setTimeout(()=>controller.abort(),8000);
  const response=await fetch(url,{credentials:'omit',signal:controller.signal});
  step('response',{status:response.status,mime:response.headers.get('content-type')});if(!response.ok)throw Error('HTTP '+response.status);
  step('body');const blob=await response.blob();clearTimeout(timer);
  step('decode');objectURL=URL.createObjectURL(blob);const im=new Image();im.src=objectURL;
  await Promise.race([im.decode(),new Promise((_,reject)=>{timer=setTimeout(()=>reject(new DOMException('Decode timeout','TimeoutError')),8000);})]);
  step('ok',{path:'fetch-blob'});return im;
 }catch(e){step(row.state+'-error',{error:e.name+(controller.signal.aborted?' (8s timeout)':'')});}
 finally{clearTimeout(timer);if(objectURL)URL.revokeObjectURL(objectURL);}
 const im=new Image();row.attempt=2;
 try{
  step('native-load');
  await new Promise((resolve,reject)=>{
   im.onload=resolve;im.onerror=()=>reject(Error('native-error'));
   timer=setTimeout(()=>reject(Error('native-timeout-15s')),15000);im.src=url;
  });
  step('ok',{path:'native-img'});return im;
 }catch(e){im.removeAttribute('src');step('placeholder',{nativeError:e.message,path:'failed'});return placeholder(name,message);}
 finally{clearTimeout(timer);im.onload=im.onerror=null;}
}
