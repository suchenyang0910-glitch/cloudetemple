import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
const source=await readFile(new URL('./demo.js',import.meta.url),'utf8');
test('pet UI uses the defined account and offerings endpoints',()=>{assert.match(source,/\/auth\/email\/start/);assert.match(source,/\/auth\/email\/verify/);assert.match(source,/\/mine/);assert.match(source,/\/memorials\/\$\{encodeURIComponent\(nearby\.id\)\}\/offerings/);assert.match(source,/offer\('flower'\)/);assert.match(source,/offer\('light'\)/)});
test('build gate defaults closed and preserves empty garden',()=>{assert.match(source,/mount\(false\)/);assert.match(source,/if\(!enabled\)/);assert.match(source,/Chưa có bia tưởng niệm/)});
test('visitor actions do not collect identity and show counts only',()=>{assert.doesNotMatch(source,/prompt\(/);assert.match(source,/Hoa: \$\{memorial\.flowers/);assert.match(source,/Đèn: \$\{memorial\.lights/)});
