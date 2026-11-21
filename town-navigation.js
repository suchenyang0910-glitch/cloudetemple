export const townEnabled='__CT_TOWN_ENABLED__'==='1';
const positionKey='ct-town-return-v1',blockedKey='ct-town-blocked-v1';
export function canEnterTown(){
  if(!townEnabled)return false;
  try{return sessionStorage.getItem(blockedKey)!=='1';}catch{return false;}
}
export function readTownReturn(){
  try{
    const p=JSON.parse(sessionStorage.getItem(positionKey));
    if(!p||!['x','z','yaw','pitch','distance'].every(k=>Number.isFinite(p[k])))return null;
    if(Math.abs(p.x)>94||p.z< -76||p.z>76||Math.abs(p.yaw)>10000||p.pitch<.16||p.pitch>1.3||p.distance<8||p.distance>30)return null;
    return p;
  }catch{return null;}
}
export function enterHall(position){
  try{sessionStorage.setItem(positionKey,JSON.stringify(position));}catch{failTown();return;}
  location.assign('/?town=home');
}
export function failTown(){
  try{sessionStorage.removeItem(positionKey);sessionStorage.setItem(blockedKey,'1');}catch{}
  location.replace('/?town=failed');
}
export function consumeTownHome(){
  const url=new URL(location.href),mode=url.searchParams.get('town');
  if(mode!=='home'&&mode!=='failed')return '';
  url.searchParams.delete('town');history.replaceState(history.state,'',url.pathname+url.search+url.hash);
  return mode;
}
export function townLink(){
  return canEnterTown()?`<a class="calendar-entry" id="town-entry" href="/town.html">${readTownReturn()?'Trở lại thị trấn':'Vào thị trấn'}</a>`:'';
}
