import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const root=new URL('../dist/',import.meta.url),{release}=JSON.parse(await fs.readFile(new URL('release.json',root)));
const files=await fs.readdir(root),pattern=new RegExp(`\\.${release}\\.(js|css)$`),versioned=files.filter(n=>pattern.test(n));
for(const name of files.filter(n=>n.endsWith('.html'))){const text=await fs.readFile(new URL(name,root),'utf8');for(const match of text.matchAll(/(?:src|href)=["']([^"']+\.(?:js|css))["']/g)){if(match[1].startsWith('http'))continue;assert(pattern.test(match[1]),name+': '+match[1]);await fs.access(new URL(match[1].replace(/^\//,''),root));}}
for(const name of versioned.filter(n=>n.endsWith('.js'))){const text=await fs.readFile(new URL(name,root),'utf8');for(const match of text.matchAll(/(?:from\s+|import\s*)['"]\.\/([^'"]+\.js)['"]/g)){assert(pattern.test(match[1]),name+': '+match[1]);await fs.access(new URL(match[1].replace(/^\//,''),root));}}
const mobile=JSON.parse(await fs.readFile(new URL(`assets/releases/${release}/processed-v1/mobile/measurements.json`,root)));
assert.equal(mobile.length,12);assert(mobile.every(x=>x.mobile<=120000&&x.width===720));
if(process.argv.includes('--production'))assert(!files.some(n=>/^audio-debug(\.|$)/.test(n)));
console.log(JSON.stringify({passed:true,release,versioned,mobileImages:mobile.length}));
