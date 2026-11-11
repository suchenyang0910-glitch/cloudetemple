// Static server rooted at the REPO ROOT so town-3d can reach ../index.html and ../prototype-3d/*.
import { createServer } from 'node:http';
import { createReadStream, statSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = normalize(fileURLToPath(new URL('../..', import.meta.url)));
const port = Number(process.env.PORT || 4180);
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };

createServer((request, response) => {
  const pathname = decodeURIComponent(new URL(request.url, `http://${request.headers.host}`).pathname);
  const relative = pathname === '/' || pathname === '/town-3d/' ? 'town-3d/index.html' : pathname.replace(/^\/+/, '');
  const candidate = normalize(join(root, relative));
  if (!candidate.startsWith(root)) { response.writeHead(403).end('Forbidden'); return; }
  try {
    if (!statSync(candidate).isFile()) throw new Error('not-file');
    response.writeHead(200, { 'content-type': types[extname(candidate)] || 'application/octet-stream', 'cache-control': 'no-store' });
    createReadStream(candidate).pipe(response);
  } catch { response.writeHead(404).end('Not found'); }
}).listen(port, '127.0.0.1', () => console.log(`Town 3D: http://127.0.0.1:${port}/town-3d/`));
