import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
const root=fileURLToPath(new URL('../dist/',import.meta.url));
const release=execFileSync('git',['rev-parse','--short=12','HEAD'],{cwd:fileURLToPath(new URL('../',import.meta.url))}).toString().trim();
if(!/^[a-f0-9]{12}$/.test(release))throw Error('Invalid release');
const names=(await fs.readdir(root)).filter(n=>/^[a-z0-9-]+\.(js|css)$/.test(n));
const rewrite=text=>names.reduce((s,n)=>{
 const versioned=n.replace(/\.(js|css)$/,`.${release}.$1`);
 return s.replaceAll('/'+n,'/'+versioned).replaceAll('"'+n+'"','"'+versioned+'"').replaceAll("'"+n+"'","'"+versioned+"'");
},text).replaceAll('__CT_RELEASE__',release).replaceAll('assets/fonts/','assets/releases/'+release+'/fonts/');
for(const name of names)await fs.writeFile(path.join(root,name.replace(/\.(js|css)$/,`.${release}.$1`)),rewrite(await fs.readFile(path.join(root,name),'utf8')));
for(const name of (await fs.readdir(root)).filter(n=>n.endsWith('.html')))await fs.writeFile(path.join(root,name),rewrite(await fs.readFile(path.join(root,name),'utf8')));
const dest=path.join(root,'assets','releases',release);await fs.mkdir(dest,{recursive:true});
for(const name of ['audio','processed-v1','fonts'])await fs.rename(path.join(root,'assets',name),path.join(dest,name));
const archive=path.resolve(root,'../_archive',`inputs-${release}-${Date.now()}`);
await fs.mkdir(archive,{recursive:true});
for(const name of names)await fs.rename(path.join(root,name),path.join(archive,name));
await fs.writeFile(path.join(root,'release.json'),JSON.stringify({release})+'\n');
const files=[];
async function inventory(dir){for(const item of await fs.readdir(dir,{withFileTypes:true})){const full=path.join(dir,item.name);if(item.isDirectory())await inventory(full);else{const data=await fs.readFile(full);files.push({path:path.relative(root,full).replaceAll('\\','/'),bytes:data.length,sha256:createHash('sha256').update(data).digest('hex')});}}}
await inventory(root);files.sort((a,b)=>a.path.localeCompare(b.path));
await fs.writeFile(path.resolve(root,`../deploy/package-${release}.json`),JSON.stringify({release,fileCount:files.length,totalBytes:files.reduce((n,f)=>n+f.bytes,0),files},null,2)+'\n');
console.log('Versioned static release '+release);
