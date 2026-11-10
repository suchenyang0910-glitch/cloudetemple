import assert from 'node:assert/strict';
import {access,readFile} from 'node:fs/promises';

const app=await readFile(new URL('../app.js',import.meta.url),'utf8');
assert.match(app,/left:false,direction:state\.beadDirection/,'hand switch keeps the strand on the right');
assert.match(app,/scene-vn-hall-side-floor-\$\{period\}/,'wooden fish and beads use the cushion-free hall');
assert.match(app,/sitOptionsOpen/,'quiet sitting has a collapsed options state');
for(const id of ['short-light','curly-dark','curly-medium','bun-light','bun-dark','ponytail-medium'])await access(new URL(`../assets/processed-v1/img/visitor-${id}-mo-base-v2.webp`,import.meta.url));
for(const period of ['dawn','day','dusk','night']){
 await access(new URL(`../assets/processed-v1/img/scene-vn-hall-side-floor-${period}.webp`,import.meta.url));
 await access(new URL(`../assets/processed-v1/mobile/scene-vn-hall-side-floor-${period}.webp`,import.meta.url));
}
console.log('four fixes: art, fixed beads lane, incense positions and sitting options passed');
