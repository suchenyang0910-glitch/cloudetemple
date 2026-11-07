import assert from 'node:assert/strict';
import {shareCopy} from '../i18n.js';

assert.deepEqual(shareCopy('incense',20_000),{key:'shareIncenseSecondsText',params:{n:0,s:20,m:1}});
assert.deepEqual(shareCopy('incense',60_000),{key:'shareIncenseMinutesText',params:{n:0,s:60,m:1}});
assert.deepEqual(shareCopy('mo',12_000,37),{key:'shareMoText',params:{n:37,s:12,m:1}});
console.log(JSON.stringify({passed:true,cases:3}));
