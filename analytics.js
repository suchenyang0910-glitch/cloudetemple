// Stage-only. Capture attribution and initialize Telegram before cleaning the launch URL.
const id='G-0EF24Y0Q9M', key='ct-analytics';
const debug={debug_mode:true};
const views='entry choose home incense bow sit mo beads leave memorial'.split(' ');
const activities='incense bow sit mo beads'.split(' ');
const fields={
 activity_start:{activity:activities},activity_complete:{activity:activities,duration_bucket:['<1m','1-3m','3-10m','>10m'],count_bucket:['1','2-26','27-53','54-107','108+']},
 share_open:{activity:activities},share_channel:{channel:['download','system','copy','zalo','facebook','messenger','telegram_forward','telegram_story']},sound_toggle:{state:['on','off']},hand_switch:{hand:['left','right']},
 waitlist_submit:{result:['invalid','rate_limit','success','error']},image_load_failed:{asset_group:['scene','visitor','prop'],path_kind:['fetch-blob','native-img','failed']}
};
export function setupAnalytics(platform,attribution={}){
 const startActivity=activities.find(name=>attribution.startParam?.endsWith('_a_'+name))||'';
 let choice='',frame,send,current=document.body.dataset.view||'entry',landingActivity=activities.includes(attribution.activity)?attribution.activity:startActivity;
 try{choice=localStorage.getItem(key)}catch{}
 const banner=document.querySelector('#ga-choice'),prefs=document.createElement('button');

 prefs.type='button';prefs.className='text-button';document.querySelector('#more-menu footer').prepend(prefs);

 function labels(){const en=document.documentElement.lang==='en';
  banner.firstChild.textContent=en?'Cloud Temple uses anonymous statistics to improve your experience.':'Chùa Mây dùng thống kê ẩn danh để cải thiện trải nghiệm.';
  banner.querySelectorAll('button').forEach((b,i)=>b.textContent=(en?['Agree','Decline']:['Đồng ý','Không'])[i]);
  prefs.textContent=en?'Analytics preferences':'Tùy chọn thống kê';
 }
 labels();new MutationObserver(labels).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});
 const controls=document.querySelector('#controls');
 function position(){banner.style.bottom=(innerHeight-controls.getBoundingClientRect().top+5)+'px'}
 new ResizeObserver(position).observe(controls);window.addEventListener('resize',position);
 prefs.onclick=()=>{document.querySelector('#more-menu').close();banner.hidden=false;position();banner.querySelector('button').focus()};
 const locationSafe=location.origin+'/';
 function view(v){if(!views.includes(v))return;current=v;if(send){send('set',{page_title:v});send('event','page_view',{page_title:v,...(landingActivity?{campaign_content:landingActivity}:{}),...debug});landingActivity='';}}
 function start(){
  if(send)return;
  window['ga-disable-'+id]=false;
  const w=window;w.dataLayer??=[];send=function(){w.dataLayer.push(arguments)};w.gtag=send;
  send('consent','default',{analytics_storage:'denied',ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied'});
  send('consent','update',{analytics_storage:'granted'});
  const raw=attribution.startParam||attribution.source||'',source=raw.startsWith('s_tg_')?'telegram':['zalo','facebook','messenger','system','copy','recommend'].includes(raw)?raw:'';
  send('set',{page_location:locationSafe,page_referrer:locationSafe,page_title:current});
  send('js',new Date());send('config',id,{...debug,send_page_view:false,page_location:locationSafe,page_referrer:locationSafe,allow_google_signals:false,allow_ad_personalization_signals:false,cookie_domain:location.hostname,user_properties:{platform:platform()?'telegram':'web'},...(source?{campaign_source:source,campaign_medium:'referral'}:{})});
  const script=w.document.createElement('script');script.async=true;script.referrerPolicy='no-referrer';script.src='https://www.googletagmanager.com/gtag/js?id='+id;if(!frame){frame=script;w.document.head.append(script)}view(current);
 }
 function choose(allow){choice=allow?'yes':'no';try{localStorage.setItem(key,choice)}catch{}
  banner.hidden=true;if(allow){start();return}
  if(send){window['ga-disable-'+id]=true;send('consent','update',{analytics_storage:'denied'});send=null}
  for(const cookie of document.cookie.split(';')){const n=cookie.split('=')[0].trim();if(['_ga','_ga_0EF24Y0Q9M'].includes(n))for(const domain of ['', '; Domain='+location.hostname,'; Domain=chuamay.org'])document.cookie=n+'=; Max-Age=0; Path=/; Secure'+domain}
 }
 const [yes,no]=banner.querySelectorAll('button');yes.onclick=()=>choose(true);no.onclick=()=>choose(false);
 banner.hidden=['yes','no'].includes(choice);position();if(choice==='yes')start();
 return {view,event(name,p){const rule=fields[name];if(!send||!rule)return;
  const clean={};for(const [k,values] of Object.entries(rule)){if(!values.includes(p[k]))return;clean[k]=p[k]}send('event',name,{...clean,...debug})}};
}
