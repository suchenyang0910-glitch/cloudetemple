import assert from 'node:assert/strict';
import {incenseConfig as c,incenseVisual,incensePhaseDone} from '../incense.js';

const journey=(phase,phaseStarted=1000)=>({phase,phaseStarted});
assert.equal(incenseVisual(1000,journey('waiting')).footX,c.walkStartX);
assert.equal(incenseVisual(1000+c.walkMs,journey('walking')).footX,c.standX);
assert.equal(incenseVisual(1000,journey('ready-vai')).footX,c.bowX,'visitor steps back before bowing');
assert.equal(incenseVisual(1000+c.vaiStrikeAt,journey('bowing')).footX,c.bowX);
assert.equal(incenseVisual(1000,journey('ready-plant')).footX,c.standX,'visitor steps forward to place incense');
assert.equal(incenseVisual(1000+c.vaiStrikeAt,journey('bowing')).pose,'inc-vai-2');
assert.equal(incenseVisual(1000+c.vaiCycleMs-1,journey('bowing')).pose,'inc-vai-1');
assert.equal(incenseVisual(1000,journey('planting')).footY,1280);
assert.equal(incensePhaseDone(1000+c.startDelay,journey('waiting')),true);
assert.equal(incensePhaseDone(1000+c.vaiCount*c.vaiCycleMs,journey('bowing')),true);
assert.equal(incensePhaseDone(1000+c.reducedHoldMs,journey('lighting'),true),true);
assert.equal(incensePhaseDone(1000+c.reducedVaiMs*c.vaiCount,journey('bowing'),true),true);
console.log('incense motion: ok');
