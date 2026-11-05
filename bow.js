export function bowFrame(elapsed,reduced=false){
 const t=Math.max(0,elapsed);
 let progress=0;
 if(t<1200)progress=2*(t/1200)**2;
 else if(t<2000)progress=2;
 else if(t<3200)progress=2*(1-(1-(t-2000)/1200)**2);
 else return {from:1,to:1,mix:1};
 const rising=t>=2000,base=Math.min(1,Math.floor(progress)),mix=progress-base;
 const from=rising?3-base:1+base,to=rising?2-base:2+base;
 if(reduced)return {from:mix<.5?from:to,to:mix<.5?from:to,mix:1};
 return {from,to,mix};
}
