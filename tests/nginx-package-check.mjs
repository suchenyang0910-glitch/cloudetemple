import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const project=fileURLToPath(new URL('../',import.meta.url)),archive=path.join(project,'_archive');
await fs.mkdir(archive,{recursive:true});
const preview=await fs.mkdtemp(path.join(archive,'nginx-package-'));
try{
  execFileSync(process.execPath,[path.join(project,'deploy/render-nginx.mjs'),preview]);
  for(const host of ['h5','miniapp','api','staging']){
    const generated=await fs.readFile(path.join(preview,host+'.conf'),'utf8');
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
  console.log('Nginx package checks PASS: four generated templates, staging-only WS/CSP and API Basic');
}finally{
  assert.equal(path.dirname(path.resolve(preview)),path.resolve(archive));
  await fs.rm(preview,{recursive:true});
}
