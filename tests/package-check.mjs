import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const root=new URL('../dist/',import.meta.url),{release}=JSON.parse(await fs.readFile(new URL('release.json',root)));
const files=await fs.readdir(root),pattern=new RegExp(`\\.${release}\\.(js|css)$`),versioned=files.filter(n=>pattern.test(n));
assert(files.filter(n=>/\.(js|css)$/.test(n)).every(n=>pattern.test(n)),'only current hashed JS/CSS');
assert.deepEqual(await fs.readdir(new URL('assets/',root)),['releases']);
assert.deepEqual(await fs.readdir(new URL('assets/releases/',root)),[release]);
for(const kind of ['wood','spacer','guru'])await fs.access(new URL(`assets/releases/${release}/processed-v1/img/bead-${kind}-v2.webp`,root));
for(const name of files.filter(n=>n.endsWith('.html'))){const text=await fs.readFile(new URL(name,root),'utf8');for(const match of text.matchAll(/(?:src|href)=["']([^"']+\.(?:js|css))["']/g)){if(match[1].startsWith('http'))continue;assert(pattern.test(match[1]),name+': '+match[1]);await fs.access(new URL(match[1].replace(/^\//,''),root));}}
for(const name of versioned.filter(n=>n.endsWith('.js'))){const text=await fs.readFile(new URL(name,root),'utf8');for(const match of text.matchAll(/(?:from\s+|import\s*)['"]\.\/([^'"]+\.js)['"]/g)){assert(pattern.test(match[1]),name+': '+match[1]);await fs.access(new URL(match[1].replace(/^\//,''),root));}}
const css=await fs.readFile(new URL(`styles.${release}.css`,root),'utf8');
assert(!css.includes('fonts.googleapis.com')&&!css.includes('fonts.gstatic.com'));
const fontURLs=[...css.matchAll(/url\((assets\/[^)]+\.woff2)\)/g)].map(m=>m[1]);assert.equal(fontURLs.length,6);
for(const url of fontURLs){assert(url.includes(`/releases/${release}/fonts/`));await fs.access(new URL(url,root));}
assert((await fs.readFile(new URL(`assets/releases/${release}/fonts/OFL-v1.txt`,root),'utf8')).includes('SIL OPEN FONT LICENSE'));
const mobile=JSON.parse(await fs.readFile(new URL(`assets/releases/${release}/processed-v1/mobile/measurements.json`,root)));
assert.equal(mobile.length,12);assert(mobile.every(x=>x.mobile<=120000&&x.width===720));
if(process.argv.includes('--production')){
 assert(!files.some(n=>/^audio-debug(\.|$)/.test(n)));
 for(const name of files){const item=new URL(name,root);if((await fs.stat(item)).isFile())assert(!(await fs.readFile(item)).includes(Buffer.from('debug_mode')),name+' contains debug_mode');}
 const analytics=versioned.find(n=>n.startsWith('analytics.'));
 assert(analytics,'production analytics module');
 assert((await fs.readFile(new URL(analytics,root),'utf8')).includes('const debug={}'),'production analytics has no debug fields');
}
if(process.argv.includes('--staging')){
 const analytics=versioned.find(n=>n.startsWith('analytics.'));
 assert(analytics,'staging analytics module');
 assert((await fs.readFile(new URL(analytics,root),'utf8')).includes('debug_mode:true'),'staging debug_mode');
}
assert((await fs.readFile(new URL('index.html',root),'utf8')).includes('id="ga-choice"'),'analytics consent rendered');
const manifest=JSON.parse(await fs.readFile(new URL(`../deploy/package-${release}.json`,root)));
let bytes=0;for(const item of manifest.files){const data=await fs.readFile(new URL(item.path,root));assert.equal(data.length,item.bytes);assert.equal(createHash('sha256').update(data).digest('hex'),item.sha256);bytes+=data.length;}
assert.equal(bytes,manifest.totalBytes);assert.equal(manifest.fileCount,manifest.files.length);
console.log(JSON.stringify({passed:true,release,versioned,mobileImages:mobile.length}));
