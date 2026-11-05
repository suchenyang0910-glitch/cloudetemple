export const apiURL=path=>['h5.chuamay.org','miniapp.chuamay.org'].includes(location.hostname)?'https://api.chuamay.org'+path:'/api'+path;
let app=null,back=null;
export async function initTelegram(onBack,onSettings){
  if(location.hostname!=='miniapp.chuamay.org'&&!(location.hostname==='staging.chuamay.org'&&new URLSearchParams(location.search).get('telegram')==='1'))return;
  try{
    await new Promise((resolve,reject)=>{const s=document.createElement('script');s.src='https://telegram.org/js/telegram-web-app.js';s.onload=resolve;s.onerror=reject;document.head.append(s);});
    const sdk=window.Telegram?.WebApp;if(!sdk)return;sdk.ready();sdk.expand();
    if(!sdk.initData)return;app=sdk;back=onBack;app.BackButton.onClick(()=>back?.());
    document.body.classList.add('telegram');
    app.disableVerticalSwipes?.();app.SettingsButton?.onClick(onSettings);app.SettingsButton?.show();
    const viewport=()=>{
      if(app.viewportStableHeight>0)document.body.style.setProperty('--app-height',app.viewportStableHeight+'px');
      for(const side of ['top','bottom','left','right'])document.body.style.setProperty('--safe-'+side,((app.safeAreaInset?.[side]||0)+(app.contentSafeAreaInset?.[side]||0))+'px');
    };
    for(const event of ['viewportChanged','safeAreaChanged','contentSafeAreaChanged'])app.onEvent(event,viewport);
    viewport();
  }catch{/* Keep the web interface when the Telegram bridge is unavailable. */}
}
export const inTelegram=()=>!!app;
export const initData=()=>app?.initData||'';
export function telegramBack(show){if(app)app.BackButton[show?'show':'hide']();}
export function haptic(kind){if(!app)return false;try{app.HapticFeedback?.impactOccurred(kind);}catch{}return true;}
export function telegramShare(text){if(!app)return false;app.openTelegramLink('https://t.me/share/url?url='+encodeURIComponent(location.origin)+'&text='+encodeURIComponent(text));return true;}

export function telegramAppearance(period,running){
  if(!app)return;
  const color={dawn:'#eee8dc',day:'#eee8dc',dusk:'#705b49',night:'#282a27'}[period];
  app.setHeaderColor?.(color);app.setBackgroundColor?.(color);app.setBottomBarColor?.(color);
  app[running?'enableClosingConfirmation':'disableClosingConfirmation']?.();
}
