import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
const root=fileURLToPath(new URL('../dist/',import.meta.url));
const release=execFileSync('git',['rev-parse','--short=12','HEAD'],{cwd:fileURLToPath(new URL('../',import.meta.url))}).toString().trim();
if(!/^[a-f0-9]{12}$/.test(release))throw Error('Invalid release');
const names=(await fs.readdir(root)).filter(n=>/^[a-z0-9-]+\.(js|css)$/.test(n));
const rewrite=text=>names.reduce((s,n)=>{
 const versioned=n.replace(/\.(js|css)$/,`.${release}.$1`);
 return s.replaceAll('/'+n,'/'+versioned).replaceAll('"'+n+'"','"'+versioned+'"').replaceAll("'"+n+"'","'"+versioned+"'");
},text).replaceAll('__CT_RELEASE__',release);
for(const name of names)await fs.writeFile(path.join(root,name.replace(/\.(js|css)$/,`.${release}.$1`)),rewrite(await fs.readFile(path.join(root,name),'utf8')));
for(const name of (await fs.readdir(root)).filter(n=>n.endsWith('.html')))await fs.writeFile(path.join(root,name),rewrite(await fs.readFile(path.join(root,name),'utf8')));
const dest=path.join(root,'assets','releases',release);await fs.mkdir(dest,{recursive:true});
for(const name of ['audio','processed-v1'])await fs.cp(path.join(root,'assets',name),path.join(dest,name),{recursive:true});
await fs.writeFile(path.join(root,'release.json'),JSON.stringify({release})+'\n');
console.log('Versioned static release '+release);
