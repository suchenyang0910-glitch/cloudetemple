import {readdir, readFile, stat, writeFile} from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const baseArg=process.argv.find(arg=>arg.startsWith('--base='));
const previewBase=baseArg?.slice(7)||'';
if(previewBase&&!/^\/(?:[A-Za-z0-9._-]+\/)+$/.test(previewBase))throw new Error('Expected --base=/path/');
const dist=path.join(root,'site','dist');
const output=previewBase?path.join(dist,previewBase.slice(1,-1)):dist;

async function files(dir){const entries=await readdir(dir,{withFileTypes:true});return(await Promise.all(entries.map(entry=>entry.isDirectory()?files(path.join(dir,entry.name)):[path.join(dir,entry.name)]))).flat();}
const all=await files(output),html=all.filter(file=>file.endsWith('.html')&&path.basename(file)!=='404.html');
const titles=new Set(),descriptions=new Set(),report=[];
const cssBytes=(await stat(path.join(output,'assets','site.css'))).size;
const css=await readFile(path.join(output,'assets','site.css'),'utf8');
if(previewBase){assert(css.includes(`url('${previewBase}assets/`),'preview CSS assets are not base-prefixed');assert(!css.includes("url('/assets/"),'preview CSS keeps root asset URLs');}
const fontBytes=(await stat(path.join(output,'assets','BeVietnam-latin.woff2'))).size+(await stat(path.join(output,'assets','BeVietnam-vietnamese.woff2'))).size;
const localPath=target=>previewBase&&target.startsWith(previewBase)?target.slice(previewBase.length-1):target;

for(const file of html){
  const text=await readFile(file,'utf8'),relative=path.relative(output,file).replaceAll('\\','/'),title=(text.match(/<title>([^<]+)<\/title>/)||[])[1],description=(text.match(/<meta name="description" content="([^"]+)"/ )||[])[1];
  assert(title,`${relative}: missing title`);assert(description,`${relative}: missing description`);assert(title.length<=60,`${relative}: title over 60 chars`);assert(description.length<=155,`${relative}: description over 155 chars`);assert(!titles.has(title),`${relative}: duplicate title`);assert(!descriptions.has(description),`${relative}: duplicate description`);titles.add(title);descriptions.add(description);
  assert.equal((text.match(/<h1[ >]/g)||[]).length,1,`${relative}: expected one H1`);assert(/<html lang="(vi|en)"/.test(text),`${relative}: missing language`);for(const lang of ['vi','en','x-default'])assert(text.includes(`hreflang="${lang}"`),`${relative}: missing ${lang} hreflang`);
  const pathname=relative==='index.html'?'/' : `/${relative.replace(/\/index\.html$/,'/')}`;assert(text.includes(`<link rel="canonical" href="https://chuamay.org${pathname}">`),`${relative}: canonical changed`);
  if(previewBase)assert(text.includes('<meta name="robots" content="noindex">'),`${relative}: preview missing noindex`);else assert(!text.includes('<meta name="robots" content="noindex">'),`${relative}: production unexpectedly noindex`);
  const structured=[...text.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map(block=>JSON.parse(block[1])),faq=structured.find(item=>item['@type']==='FAQPage');if(faq)assert.equal(faq.mainEntity.length,(text.match(/<h2>/g)||[]).length,`${relative}: FAQPage question count differs from visible questions`);
  for(const href of text.matchAll(/(?:href|src)="(\/[^"\s]+)"/g)){const target=localPath(href[1].split(/[?#]/)[0]);if(target==='/')continue;const candidate=target.endsWith('/')?path.join(output,target.slice(1),'index.html'):path.join(output,target.slice(1));assert(await stat(candidate).then(()=>true,()=>false),`${relative}: dead local link ${href[1]}`);}
  if(previewBase)for(const href of text.matchAll(/(?:href|src)="(\/[^"\s]+)"/g))assert(href[1].startsWith(previewBase),`${relative}: unprefixed preview link ${href[1]}`);
  const hero=text.includes(`${previewBase.slice(0,-1)}/assets/images/home.webp`)?(await stat(path.join(output,'assets','images','home.webp'))).size:0,initialBytes=(await stat(file)).size+cssBytes+fontBytes+hero;assert(initialBytes<=300*1024,`${relative}: initial ${initialBytes} exceeds 300KB`);report.push({page:relative==='index.html'?'/' : `/${relative.replace(/\/index\.html$/,'/')}`,initialBytes,clientJavaScriptBytes:0,clientInteraction:'0ms client JavaScript; no client-side hydration'});
}
const sitemap=await readFile(path.join(output,'sitemap.xml'),'utf8');for(const file of html){const relative=path.relative(output,file).replaceAll('\\','/'),pathname=relative==='index.html'?'/' : `/${relative.replace(/\/index\.html$/,'/')}`;assert(sitemap.includes(`https://chuamay.org${pathname}`),`sitemap missing ${pathname}`);}
const result={passed:true,pages:html.length,previewBase:previewBase||null,performance:report};await writeFile(path.join(output,'validation.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2));
