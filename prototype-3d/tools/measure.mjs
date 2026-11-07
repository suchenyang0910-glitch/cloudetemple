import { readdir, readFile, stat } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import { dirname, extname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const allowed = new Set(['.html', '.css', '.js', '.webp']);
const excluded = new Set(['node_modules', 'tools', 'tests', 'evidence', 'reference-pack', 'source']);
const rows = [];
async function walk(folder) {
  for (const name of await readdir(folder)) {
    if (excluded.has(name)) continue;
    const path = join(folder, name); const info = await stat(path);
    if (info.isDirectory()) await walk(path);
    else if (allowed.has(extname(name))) { const data = await readFile(path); rows.push({ file: relative(root, path), raw: data.length, gzip: gzipSync(data).length }); }
  }
}
await walk(root);
rows.sort((a, b) => b.raw - a.raw);
const total = rows.reduce((sum, row) => sum + row.raw, 0);
const gzip = rows.reduce((sum, row) => sum + row.gzip, 0);
console.table(rows);
console.log(JSON.stringify({ total, gzip, budget: 10 * 1024 * 1024, pass: total <= 10 * 1024 * 1024 }));
if (total > 10 * 1024 * 1024) process.exitCode = 1;
