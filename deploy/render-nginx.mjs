import fs from 'node:fs/promises';
const destination=process.argv[2];if(!destination)throw Error('Output directory required');await fs.mkdir(destination,{recursive:true});
const csp="default-src 'self'; script-src 'self' https://static.cloudflareinsights.com SCRIPT; style-src 'self' 'unsafe-inline'; font-src 'self'; img-src 'self' data: blob:; connect-src 'self' https://cloudflareinsights.com https://api.chuamay.org; media-src 'self' blob:; object-src 'none'; base-uri 'self'; frame-ancestors FRAME; form-action 'self'";
for(const [host,port,env,mini,api] of [['h5',8800,'production',false,false],['miniapp',8801,'production',true,false],['api',8802,'production',false,true],['staging',8803,'staging',true,false]]){
  const headers=`add_header X-Content-Type-Options nosniff always;
  add_header Referrer-Policy strict-origin-when-cross-origin always;
  add_header Permissions-Policy "camera=(), microphone=(), geolocation=()" always;
  add_header Strict-Transport-Security "max-age=31536000" always;
  ${host==='miniapp'?'':'add_header X-Frame-Options DENY always;'}
  add_header Content-Security-Policy "${csp.replace('SCRIPT',mini?'https://telegram.org':'').replace('FRAME',host==='miniapp'?'https://web.telegram.org':"'none'")}" always;`;
  const proxy=`proxy_pass http://127.0.0.1:${env==='staging'?8791:8790};
      proxy_set_header X-Chuamay-Peer $http_x_chuamay_peer;
      proxy_set_header CF-Connecting-IP $http_cf_connecting_ip;`;
  const locationHeaders=headers+(host==='staging'?'\n  add_header X-Robots-Tag noindex always;':'');
  await fs.writeFile(`${destination}/${host}.conf`,`server {
  listen 127.0.0.1:${port};
  server_name ${host}.chuamay.org;
  root /opt/chuamay/${env}/current/dist;
  ${headers}
  ${host==='staging'?'auth_basic "Chua May staging"; auth_basic_user_file /etc/chuamay/staging.htpasswd;\n  add_header X-Robots-Tag noindex always;':''}
  ${api?`location / { ${proxy} }`:`location / { ${locationHeaders} add_header Cache-Control "no-cache" always; try_files $uri $uri.html $uri/ =404; }
  location ^~ /assets/ { auth_basic off; ${locationHeaders} add_header Cache-Control "public, max-age=31536000, immutable"; types { image/webp webp; image/png png; application/json json; text/plain txt md; audio/mp4 m4a; audio/mpeg mp3; font/woff2 woff2; } try_files $uri =404; }
  location ~ "^/[a-z0-9-]+\\.[a-f0-9]{12}\\.(js|css)$" { auth_basic off; ${locationHeaders} add_header Cache-Control "public, max-age=31536000, immutable"; try_files $uri =404; }`}
  ${host==='staging'?`location /api/ { ${proxy.replace('8791;','8791/;')} }
  # Telegram cannot supply browser Basic Auth; this one route uses the webhook secret instead.
  location = /api/telegram/webhook { auth_basic off; ${proxy.replace('8791;','8791/telegram/webhook;')} }`:''}
}\n`);
}
