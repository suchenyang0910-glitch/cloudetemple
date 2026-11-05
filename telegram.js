export const apiURL=path=>['h5.chuamay.org','miniapp.chuamay.org'].includes(location.hostname)?'https://api.chuamay.org'+path:'/api'+path;
let app=null,back=null;
export async function initTelegram(onBack){
  if(location.hostname!=='miniapp.chuamay.org'&&!(location.hostname==='staging.chuamay.org'&&new URLSearchParams(location.search).get('telegram')==='1'))return;
  try{
    await new Promise((resolve,reject)=>{const s=document.createElement('script');s.src='https://telegram.org/js/telegram-web-app.js';s.onload=resolve;s.onerror=reject;document.head.append(s);});
    const sdk=window.Telegram?.WebApp;if(!sdk)return;sdk.ready();sdk.expand();
    if(!sdk.initData)return;app=sdk;back=onBack;app.BackButton.onClick(()=>back?.());
    document.body.classList.add('telegram');
    const theme=()=>{for(const [key,value] of Object.entries(app.themeParams)){if(/^#[a-f0-9]{6}$/i.test(value))document.body.style.setProperty('--tg-'+key.replaceAll('_','-'),value);}app.setHeaderColor?.('bg_color');app.setBackgroundColor?.(app.themeParams.bg_color||'#eee8dc');};
    app.onEvent('themeChanged',theme);theme();
  }catch{/* Keep the web interface when the Telegram bridge is unavailable. */}
}
export const inTelegram=()=>!!app;
export const initData=()=>app?.initData||'';
export function telegramBack(show){if(app)app.BackButton[show?'show':'hide']();}
export function haptic(kind){if(!app)return false;try{app.HapticFeedback?.impactOccurred(kind);}catch{}return true;}
export function telegramShare(text){if(!app)return false;app.openTelegramLink('https://t.me/share/url?url='+encodeURIComponent(location.origin)+'&text='+encodeURIComponent(text));return true;}
