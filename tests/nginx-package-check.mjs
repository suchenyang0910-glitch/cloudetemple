import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';

const project=fileURLToPath(new URL('../',import.meta.url)),archive=path.join(project,'_archive');
await fs.mkdir(archive,{recursive:true});
const preview=await fs.mkdtemp(path.join(archive,'nginx-package-'));
try{
  execFileSync(process.execPath,[path.join(project,'deploy/render-nginx.mjs'),preview]);
  const baseline={h5:'',miniapp:'',api:'',staging:''};
  for(const host of ['h5','miniapp','api','staging']){
    const bytes=await fs.readFile(path.join(preview,host+'.conf'));
    baseline[host]=bytes;
    const generated=bytes.toString('utf8');
    const committed=await fs.readFile(path.join(project,'deploy/generated-nginx',host+'.conf'),'utf8');
    assert.equal(generated,committed.replace(/\r\n/g,'\n'),host+' template matches generator (checkout EOL normalized)');
    if(host!=='staging'){
      assert(!generated.includes('/town-ws')&&!generated.includes('wss://staging.chuamay.org'),host+' excludes staging realtime');
      continue;
    }
    const routes=[...generated.matchAll(/location = \/town-ws \{([^}]+)\}/g)];
    assert.equal(routes.length,1,'one exact WebSocket route');
    for(const directive of ['auth_basic off;','proxy_pass http://127.0.0.1:8793;','proxy_http_version 1.1;','proxy_set_header Upgrade $http_upgrade;','proxy_set_header Connection "upgrade";','proxy_set_header Origin $http_origin;','proxy_set_header Host $host;','proxy_set_header X-Chuamay-Peer $http_x_chuamay_peer;','proxy_read_timeout 45s;','proxy_send_timeout 10s;','proxy_buffering off;','access_log off;'])assert(routes[0][1].includes(directive),directive);
    const policies=[...generated.matchAll(/add_header Content-Security-Policy "([^"]+)" always;/g)];
    assert.equal(policies.length,4,'four CSP scopes');
    for(const [,policy] of policies)assert.match(policy,/(?:^|; )connect-src [^;]* wss:\/\/staging\.chuamay\.org;/,'WSS allowed only in connect-src');
    assert(generated.includes('auth_basic "Chua May staging"; auth_basic_user_file /etc/chuamay/staging.htpasswd;'),'site Basic retained');
    const api=generated.match(/location \/api\/ \{([^}]+)\}/)?.[1];
    assert(api&&!api.includes('auth_basic off')&&api.includes('proxy_pass http://127.0.0.1:8791/;'),'API retains Basic inheritance and upstream');
  }
  const pinned=JSON.parse(await fs.readFile(path.join(project,'tests/nginx-baseline.sha256.json'),'utf8'));
  for(const host of Object.keys(baseline))assert.equal(createHash('sha256').update(baseline[host]).digest('hex'),pinned[host],host+' exact pre-change generator bytes');
  execFileSync(process.execPath,[path.join(project,'deploy/render-nginx.mjs'),preview,'--production-town']);
  for(const host of Object.keys(baseline)){
    const bytes=await fs.readFile(path.join(preview,host+'.conf')),text=bytes.toString('utf8');
    if(['api','staging'].includes(host)){assert.deepEqual(bytes,baseline[host],host+' opt-in unchanged');continue;}
    assert.equal((text.match(/location = \/town-ws/g)||[]).length,1);
    for(const directive of ['limit_conn town_clients 4;','limit_conn_status 429;','proxy_pass http://127.0.0.1:8794;','access_log off;','error_log /dev/null crit;'])assert(text.includes(directive),host+directive);
    for(const [,policy] of text.matchAll(/add_header Content-Security-Policy "([^"]+)" always;/g))assert(policy.includes('wss://'+host+'.chuamay.org;'));
    assert(!text.includes('wss://'+(host==='h5'?'miniapp':'h5')+'.chuamay.org'));
    assert.equal((text.match(/limit_conn_zone /g)||[]).length,host==='h5'?1:0,'zone defined once across http includes');
  }
  console.log('Nginx package checks PASS: exact default bytes, staging Basic, opt-in production WS/CSP/source limits');
}finally{
  assert.equal(path.dirname(path.resolve(preview)),path.resolve(archive));
  await fs.rm(preview,{recursive:true});
}
