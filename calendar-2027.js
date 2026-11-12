import {initTelegram,inTelegram,telegramBack,telegramShare} from './telegram.js';

const image=document.querySelector('#calendar-image'),label=document.querySelector('#calendar-label'),monthLabel=document.querySelector('#month-label'),overview=document.querySelector('#overview'),previous=document.querySelector('#previous'),next=document.querySelector('#next'),save=document.querySelector('#save'),share=document.querySelector('#share'),status=document.querySelector('#calendar-status');
const now=new Date(),initial=now.getFullYear()<2027?1:now.getMonth()+1;
let month=initial,all=false;
const period=hour=>hour>=5&&hour<8?'dawn':hour>=8&&hour<17?'day':hour>=17&&hour<19?'dusk':'night';
const name=()=>all?'calendar-2027-overview.webp':`calendar-2027-${String(month).padStart(2,'0')}.webp`;
const path=()=>`assets/calendar-2027/${name()}`;
function render(){
 const src=path();image.src=src;save.href=src;save.download=name();label.textContent=all?'Cả năm':`${String(month).padStart(2,'0')} / 2027`;image.alt=label.textContent;monthLabel.textContent=label.textContent;overview.setAttribute('aria-pressed',String(all));previous.disabled=all||month===1;next.disabled=all||month===12;status.textContent='';
}
previous.onclick=()=>{if(month>1){all=false;month--;render();}};
next.onclick=()=>{if(month<12){all=false;month++;render();}};
overview.onclick=()=>{all=!all;render();};
save.onclick=e=>{if(!inTelegram())return;e.preventDefault();open(new URL(path(),location.href),'_blank','noopener');status.textContent='Nhấn giữ ảnh để lưu';};
share.onclick=async()=>{
 try{
  const response=await fetch(path(),{credentials:'omit'});if(!response.ok)throw Error('image');const blob=await response.blob(),file=new File([blob],name(),{type:'image/webp'});
  if(navigator.share&&navigator.canShare?.({files:[file]})){await navigator.share({files:[file],title:'Lịch 2027'});return;}
  if(inTelegram()&&telegramShare(`Lịch 2027 · ${new URL(path(),location.href)}`,'calendar2027'))return;
  open(new URL(path(),location.href),'_blank','noopener');
 }catch(error){if(error.name!=='AbortError')open(new URL(path(),location.href),'_blank','noopener');}
};
document.body.dataset.period=period(now.getHours());
await initTelegram(()=>history.length>1?history.back():location.assign('/'),()=>{});telegramBack(true);render();
