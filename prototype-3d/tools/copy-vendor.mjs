import { copyFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
await mkdir(resolve(root, 'vendor'), { recursive: true });
await copyFile(resolve(root, 'node_modules/three/build/three.module.js'), resolve(root, 'vendor/three.module.min.js'));
await copyFile(resolve(root, 'node_modules/three/build/three.core.js'), resolve(root, 'vendor/three.core.js'));
await copyFile(resolve(root, 'node_modules/three/LICENSE'), resolve(root, 'vendor/THREE-LICENSE.txt'));
console.log('Vendored three.js 0.187.0');
