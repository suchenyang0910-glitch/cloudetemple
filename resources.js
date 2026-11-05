export const release='__CT_RELEASE__';
export const assetURL=path=>new URL(`assets/${release.startsWith('__')?'':`releases/${release}/`}${path}`,import.meta.url).href;
export const imageStatus=new Map();
export function imageURL(name){
 const pixels=innerWidth<=720?Math.min(720,Math.ceil(innerWidth*(devicePixelRatio||1))):941;
 return assetURL(`processed-v1/${name.startsWith('scene-')&&pixels<=720?'mobile':'img'}/${name}`);
}
export function placeholder(name,message){
 const c=document.createElement('canvas');c.width=name.startsWith('scene-')?941:600;c.height=name.startsWith('scene-')?1672:900;c.placeholder=true;
 const x=c.getContext('2d');x.fillStyle='#e8dfd0';x.fillRect(0,0,c.width,c.height);x.strokeStyle='#8a7965';x.lineWidth=3;x.strokeRect(c.width*.15,c.height*.4,c.width*.7,c.height*.14);x.fillStyle='#594a38';x.textAlign='center';x.font='24px sans-serif';x.fillText(message,c.width/2,c.height*.48,c.width*.65);return c;
}
export async function loadImage(name,message){
 const url=imageURL(name);
 for(let attempt=1;attempt<=2;attempt++){
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),8000);let objectURL;
  try{
   imageStatus.set(name,{attempt,state:'loading'});
   const response=await fetch(url,{credentials:'omit',signal:controller.signal,cache:attempt===2?'reload':'default'});
   imageStatus.set(name,{attempt,status:response.status,state:'decode'});if(!response.ok)throw Error(`HTTP ${response.status}`);
   objectURL=URL.createObjectURL(await response.blob());const im=new Image();im.src=objectURL;await im.decode();imageStatus.set(name,{attempt,status:response.status,state:'ok'});return im;
  }catch(e){imageStatus.set(name,{...imageStatus.get(name),state:attempt===2?'placeholder':'retry',error:e.name+': '+e.message});}
  finally{clearTimeout(timer);if(objectURL)URL.revokeObjectURL(objectURL);}
 }
 return placeholder(name,message);
}
