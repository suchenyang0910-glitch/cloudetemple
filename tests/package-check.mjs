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
const mobile=JSON.parse(await fs.readFile(new URL(`assets/releases/${release}/processed-v1/mobile/measurements.json`,root)));
assert.equal(mobile.length,12);assert(mobile.every(x=>x.mobile<=120000&&x.width===720));
if(process.argv.includes('--production'))assert(!files.some(n=>/^audio-debug(\.|$)/.test(n)));
const manifest=JSON.parse(await fs.readFile(new URL(`../deploy/package-${release}.json`,root)));
let bytes=0;for(const item of manifest.files){const data=await fs.readFile(new URL(item.path,root));assert.equal(data.length,item.bytes);assert.equal(createHash('sha256').update(data).digest('hex'),item.sha256);bytes+=data.length;}
assert.equal(bytes,manifest.totalBytes);assert.equal(manifest.fileCount,manifest.files.length);
console.log(JSON.stringify({passed:true,release,versioned,mobileImages:mobile.length}));
