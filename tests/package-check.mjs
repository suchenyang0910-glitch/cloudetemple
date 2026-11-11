import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const root=new URL('../dist/',import.meta.url),{release}=JSON.parse(await fs.readFile(new URL('release.json',root)));
const home=await fs.readFile(new URL('index.html',root),'utf8');assert(home.includes('property="og:image"')&&home.includes('class="home-content"')&&home.includes('application/ld+json'),'home metadata and prerendered copy');assert(!/<script(?![^>]*(?:src=|type="application\/ld\+json"))[^>]*>/i.test(home),'no executable inline script under strict CSP');
const about=await fs.readFile(new URL('gioi-thieu.html',root),'utf8');assert(about.includes('Hồ Ngọc Đức công bố')&&about.includes('calrules.html'),'lunar algorithm attribution');
const files=await fs.readdir(root),pattern=new RegExp(`\\.${release}\\.(js|css)$`),versioned=files.filter(n=>pattern.test(n));
await fs.access(new URL('404.html',root));
for(const name of ['morning','festival'])assert(versioned.includes(`${name}.${release}.js`),`${name} module packaged and versioned`);
const analyticsName=versioned.find(n=>n.startsWith('analytics.')),analyticsText=await fs.readFile(new URL(analyticsName,root),'utf8');assert(analyticsText.includes('campaign_content')&&analyticsText.includes("endsWith('_a_'+name)"),'anonymous activity attribution allowlist');
assert(files.filter(n=>/\.(js|css)$/.test(n)).every(n=>pattern.test(n)),'only current hashed JS/CSS');
assert.deepEqual(await fs.readdir(new URL('assets/',root)),['releases','share']);
assert.deepEqual(await fs.readdir(new URL('assets/releases/',root)),[release]);
for(const kind of ['wood','spacer','guru'])await fs.access(new URL(`assets/releases/${release}/processed-v1/img/bead-${kind}-v2.webp`,root));
await fs.access(new URL(`assets/releases/${release}/processed-v1/img/share-qr.png`,root));
for(const id of ['short-light','curly-dark','curly-medium','bun-light','bun-dark','ponytail-medium'])for(const frame of [1,2,3])await fs.access(new URL(`assets/releases/${release}/processed-v1/img/visitor-${id}-mo-${frame}-v3.webp`,root));
for(const name of ['hall-cushion-v2.webp','mo-low-table-v2.webp','mo-v6.webp'])await fs.access(new URL(`assets/releases/${release}/processed-v1/img/${name}`,root));
await assert.rejects(fs.access(new URL(`assets/releases/${release}/processed-v1/img/mo-mallet.webp`,root)),'mallet must be integrated into visitor frames');
for(const id of ['short-light','curly-dark','curly-medium','bun-light','bun-dark','ponytail-medium'])for(const frame of [1,2,3])await fs.access(new URL(`assets/releases/${release}/processed-v1/img/visitor-${id}-beads-side-${frame}-v1.webp`,root));
for(const id of ['short-light','curly-dark','curly-medium','bun-light','bun-dark','ponytail-medium'])await fs.access(new URL(`assets/releases/${release}/processed-v1/img/visitor-${id}-stand.webp`,root));
for(const id of ['short-light','curly-dark','curly-medium','bun-light','bun-dark','ponytail-medium'])for(const pose of ['sit','beads']){
 await fs.access(new URL(`assets/releases/${release}/processed-v1/img/visitor-${id}-${pose}-nocushion.webp`,root));
 await assert.rejects(fs.access(new URL(`assets/releases/${release}/processed-v1/img/visitor-${id}-${pose}.webp`,root)),`${id} ${pose} original excluded from package`);
}
for(const pace of ['4-6','4-4','5-7'])for(const ext of ['mp3','m4a'])await fs.access(new URL(`assets/releases/${release}/audio/breath-${pace}.${ext}`,root));
await assert.rejects(fs.access(new URL(`assets/releases/${release}/processed-v1/img/mo.webp`,root)),'old combined wooden fish removed');
for(const name of ['og-share-vi.webp','og-share-en.webp']){const file=new URL(`assets/share/${name}`,root);assert((await fs.stat(file)).size<=200000,name+' max 200KB')}
const festivalNames=['flower-dao.svg','flower-mai.svg','lantern.svg','moon.svg','petal-dao.svg','petal-mai.svg','pot-dao.svg','pot-mai.svg'];
for(const name of festivalNames)await fs.access(new URL(`assets/releases/${release}/festival/${name}`,root));
for(const route of ['huong-dan/thap-huong','huong-dan/le-phat','huong-dan/lan-chuoi','huong-dan/go-mo','huong-dan/ngoi-yen','cau-hoi-thuong-gap'])for(const prefix of ['','en/']){const html=await fs.readFile(new URL(prefix+route+'/index.html',root),'utf8');assert(html.includes('name="robots" content="noindex,follow"'),prefix+route+' noindex');assert(!html.includes('待核'),prefix+route+' hides review markers');assert(!/<p>[htap]<\/p>/.test(html),prefix+route+' no orphan marker');assert(html.includes('application/ld+json'),prefix+route+' structured data')}
for(const name of ['sitemap.xml','robots.txt','llms.txt'])await fs.access(new URL(name,root));
const sitemap=await fs.readFile(new URL('sitemap.xml',root),'utf8');assert(sitemap.includes('xmlns:xhtml=')&&sitemap.includes('hreflang="en"'),'sitemap hreflang');
const robots=await fs.readFile(new URL('robots.txt',root),'utf8');for(const bot of ['GPTBot','ClaudeBot','PerplexityBot','Google-Extended'])assert(robots.includes('User-agent: '+bot),bot+' allowed');
for(const name of files.filter(n=>n.endsWith('.html'))){const text=await fs.readFile(new URL(name,root),'utf8');for(const match of text.matchAll(/(?:src|href)=["']([^"']+\.(?:js|css))["']/g)){if(match[1].startsWith('http'))continue;assert(pattern.test(match[1]),name+': '+match[1]);await fs.access(new URL(match[1].replace(/^\//,''),root));}}
for(const name of versioned.filter(n=>n.endsWith('.js'))){const text=await fs.readFile(new URL(name,root),'utf8');for(const match of text.matchAll(/(?:from\s+|import\s*)['"]\.\/([^'"]+\.js)['"]/g)){assert(pattern.test(match[1]),name+': '+match[1]);await fs.access(new URL(match[1].replace(/^\//,''),root));}}
const css=await fs.readFile(new URL(`styles.${release}.css`,root),'utf8');
assert(!css.includes('fonts.googleapis.com')&&!css.includes('fonts.gstatic.com'));
assert(!css.includes('assets/festival/'),'festival assets are never referenced without a release hash');
for(const name of festivalNames)assert(css.includes(`assets/releases/${release}/festival/${name}`),name+' uses release-hashed URL');
const fontURLs=[...css.matchAll(/url\((assets\/[^)]+\.woff2)\)/g)].map(m=>m[1]);assert.equal(fontURLs.length,6);
for(const url of fontURLs){assert(url.includes(`/releases/${release}/fonts/`));await fs.access(new URL(url,root));}
assert((await fs.readFile(new URL(`assets/releases/${release}/fonts/OFL-v1.txt`,root),'utf8')).includes('SIL OPEN FONT LICENSE'));
const familyAppName=versioned.find(n=>n.startsWith('family.')&&n.endsWith('.js'));
const familyVisibleText=(await Promise.all(['family.html',familyAppName,`family-i18n.${release}.js`,`family-consent.${release}.js`].map(name=>fs.readFile(new URL(name,root),'utf8')))).join('\n');
assert(!/chờ người bản ngữ|待母语|native[- ]speaker review/i.test(familyVisibleText),'family UI has no pending native-language review marker');
const mobile=JSON.parse(await fs.readFile(new URL(`assets/releases/${release}/processed-v1/mobile/measurements.json`,root)));
assert.equal(mobile.length,12);assert(mobile.every(x=>x.mobile<=120000&&x.width===720));
if(process.argv.includes('--production')){
 assert(!files.some(n=>/^audio-debug(\.|$)/.test(n)));
 assert(!files.some(n=>/^(calendar-presale|dev-outbox)(\.|$)/.test(n)),'production excludes presale and outbox');
 for(const name of ['family.html',`family.${release}.js`,`family.${release}.css`,`family-analytics.${release}.js`,`family-i18n.${release}.js`,`family-consent.${release}.js`])await fs.access(new URL(name,root));
 await fs.access(new URL(`assets/releases/${release}/family`,root));
 for(const name of files){const item=new URL(name,root);if((await fs.stat(item)).isFile())assert(!(await fs.readFile(item)).includes(Buffer.from('debug_mode')),name+' contains debug_mode');}
 const analytics=versioned.find(n=>n.startsWith('analytics.'));
 assert(analytics,'production analytics module');
 assert((await fs.readFile(new URL(analytics,root),'utf8')).includes('const debug={}'),'production analytics has no debug fields');
 assert((await fs.readFile(new URL(`config.${release}.js`,root),'utf8')).includes("'pass-through'"),'production guru rule');
 assert(versioned.includes(`preload.${release}.js`),'scene preload is external and versioned');
 for(const excluded of ['admin','presence','calendar-presale'])assert(!versioned.some(n=>n.startsWith(excluded+'.')),excluded+' excluded from production');
 const app=versioned.find(n=>n.startsWith('app.')&&n.endsWith('.js'));
 assert(app,'production app module');
 const appSource=await fs.readFile(new URL(app,root),'utf8');
 assert(appSource.includes("apiURL('/family/status')"),'family entry follows server status');
 assert(appSource.includes("telegramStartParam()==='family'")&&appSource.includes("/family.html?telegram=1"),'Telegram family start parameter opens the family login page');
 assert(!appSource.includes('__CT_FAMILY_ENABLED__'),'family entry is not fixed at build time');
 const familySource=await fs.readFile(new URL(`family.${release}.js`,root),'utf8');assert(familySource.includes('apiURL("/family" + path)')&&familySource.includes('credentials: "include"'),'family API uses credentialed API origin');
 assert((await fs.readFile(new URL(app,root),'utf8')).match(/const referralsEnabled\s*=\s*["']0["']\s*===\s*["']1["']/),'production referrals disabled');
 assert((await fs.readFile(new URL(app,root),'utf8')).match(/const presenceEnabled\s*=\s*["']0["']\s*===\s*["']1["']/),'production presence disabled');
}
if(process.argv.includes('--staging')){
 const analytics=versioned.find(n=>n.startsWith('analytics.'));
 assert(analytics,'staging analytics module');
 assert((await fs.readFile(new URL(analytics,root),'utf8')).includes('debug_mode:true'),'staging debug_mode');
 assert((await fs.readFile(new URL(`config.${release}.js`,root),'utf8')).includes("'turn-back'"),'staging guru rule');
  for(const name of ['family.html','calendar-presale.html','dev/outbox.html'])await fs.access(new URL(name,root));
 const outboxHTML=await fs.readFile(new URL('dev/outbox.html',root),'utf8');
 assert(outboxHTML.includes(`dev-outbox.${release}.js`),'staging outbox references hashed script');
 const familyApp=versioned.find(n=>n.startsWith('family.')&&n.endsWith('.js'));
 assert(familyApp,'staging family app');
 assert(!/(?:familyEvent|gtag\()/.test(await fs.readFile(new URL(familyApp,root),'utf8')),'family events stay out of GA4');
 assert(versioned.some(n=>n.startsWith('family-i18n.')&&n.endsWith('.js')),'staging family copy dictionary');
  const familyConsent=versioned.find(n=>n.startsWith('family-consent.')&&n.endsWith('.js'));assert(familyConsent,'staging family consent copy');
  const familyConsentText=await fs.readFile(new URL(familyConsent,root),'utf8');assert(familyConsentText.includes('v2 · 2026-11-07')&&!familyConsentText.includes('Chờ người bản ngữ xác nhận'),'native-language review marker removed');assert(familyConsentText.includes('公开上线前需律师确认'),'internal legal review marker retained');
 const familyVisibleText=(await Promise.all(['family.html',familyApp,`family-i18n.${release}.js`,familyConsent].map(name=>fs.readFile(new URL(name,root),'utf8')))).join('\n');
 assert(!/chờ người bản ngữ|待母语|native[- ]speaker review/i.test(familyVisibleText),'family UI has no pending native-language review marker');
  assert(versioned.some(n=>n.startsWith('calendar-presale.')&&n.endsWith('.js')),'staging calendar presale app');
  const presale=await fs.readFile(new URL('calendar-presale.html',root),'utf8');assert(presale.includes('noindex,nofollow')&&presale.includes('Sắp mở')===false,'staging presale is private and runtime-configured');
 const appSource=await fs.readFile(new URL(versioned.find(n=>n.startsWith('app.')),root),'utf8');
 assert(appSource.includes("apiURL('/family/status')")&&!appSource.includes('__CT_FAMILY_ENABLED__'));
 assert(appSource.includes("telegramStartParam()==='family'")&&appSource.includes("/family.html?telegram=1"),'Telegram family start parameter opens the family login page');
 assert((await fs.readFile(new URL(versioned.find(n=>n.startsWith('app.')),root),'utf8')).match(/const referralsEnabled\s*=\s*["']1["']\s*===\s*["']1["']/));
 assert((await fs.readFile(new URL(versioned.find(n=>n.startsWith('app.')),root),'utf8')).match(/const presenceEnabled\s*=\s*["']1["']\s*===\s*["']1["']/));
 for(const name of ['admin.html','admin.css','presence.css','admin.js'])await fs.access(new URL(name.replace(/\.(css|js)$/,`.${release}.$1`),root));
 for(const prefix of ['admin.'])for(const ext of ['js','css'])assert(versioned.some(n=>n.startsWith(prefix)&&n.endsWith('.'+ext)),'staging admin '+ext);
 const admin=await fs.readFile(new URL('admin.html',root),'utf8');assert(admin.includes('noindex,nofollow')&&admin.includes(`admin.${release}.js`)&&admin.includes(`admin.${release}.css`),'admin is private and versioned');
}
assert((await fs.readFile(new URL('index.html',root),'utf8')).includes('id="ga-choice"'),'analytics consent rendered');
const manifest=JSON.parse(await fs.readFile(new URL(`../deploy/package-${release}.json`,root)));
let bytes=0;for(const item of manifest.files){const data=await fs.readFile(new URL(item.path,root));assert.equal(data.length,item.bytes);assert.equal(createHash('sha256').update(data).digest('hex'),item.sha256);bytes+=data.length;}
assert.equal(bytes,manifest.totalBytes);assert.equal(manifest.fileCount,manifest.files.length);
console.log(JSON.stringify({passed:true,release,versioned,mobileImages:mobile.length}));
