import assert from 'node:assert/strict';
import {createMorning} from '../morning.js';

// helpers
const storage = new Map();
globalThis.localStorage = { getItem: (key) => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value), removeItem: (key) => storage.delete(key), clear: () => storage.clear() };
const makeM = () => { storage.clear(); const events=[]; return {m:createMorning({event:(n,p)=>events.push({n,p})}),events}; };

// 1. shouldShow returns true when localStorage has no entry (simulated by default state)
{const {m}=makeM(); assert.equal(m.shouldShow(),true,'fresh morning shows');}

// 2. start marks active, records event
{const {m,events}=makeM(); m.start(); assert.equal(m.isActive(),true); assert.equal(m.currentStep(),'bell'); assert.deepEqual(events,[{n:'morning_start',p:{}}]);}

// 3. replay marks active, fires morning_start with replay flag
{const {m,events}=makeM(); m.start(); m.end(); m.replay(); assert.equal(m.isActive(),true); assert.ok(events.some(e=>e.n==='morning_start'&&e.p.replay===true),'replay flag set');}

// 4. bellDone advances to incense step, fires morning_step
{const {m,events}=makeM(); m.start(); const next=m.bellDone(); assert.equal(next,'incense'); assert.equal(m.currentStep(),'incense'); assert.ok(events.some(e=>e.n==='morning_step'&&e.p.step==='incense'));}

// 5. advance incense → bow
{const {m,events}=makeM(); m.start(); m.bellDone(); const r=m.advance('incense'); assert.deepEqual(r,{navigate:'bow'}); assert.equal(m.currentStep(),'bow'); assert.ok(events.some(e=>e.n==='morning_step'&&e.p.step==='bow'));}

// 6. advance bow → sit
{const {m}=makeM(); m.start(); m.bellDone(); m.advance('incense'); const r=m.advance('bow'); assert.deepEqual(r,{navigate:'sit'});}

// 7. advance sit → complete, navigate home, inactive
{const {m,events}=makeM(); m.start(); m.bellDone(); m.advance('incense'); m.advance('bow'); const r=m.advance('sit'); assert.deepEqual(r,{navigate:'home'}); assert.equal(m.isActive(),false); assert.ok(events.some(e=>e.n==='morning_complete'));}

// 8. advance when not active returns false
{const {m}=makeM(); const r=m.advance('incense'); assert.equal(r,false);}

// 9. skip on first step (bell) ends sequence, navigate home
{const {m,events}=makeM(); m.start(); const r=m.skip('bell'); assert.deepEqual(r,{navigate:'home'}); assert.equal(m.isActive(),false); assert.ok(events.some(e=>e.n==='morning_skip'&&e.p.step==='bell'));}

// 10. skip 'morning' (full skip from morning view) ends, navigate home
{const {m,events}=makeM(); m.start(); const r=m.skip('morning'); assert.deepEqual(r,{navigate:'home'}); assert.ok(events.some(e=>e.n==='morning_skip'));}

// 11. skip incense step advances to bow
{const {m}=makeM(); m.start(); m.bellDone(); const r=m.skip('incense'); assert.deepEqual(r,{navigate:'bow'});}

// 12. skip bow step advances to sit
{const {m}=makeM(); m.start(); m.bellDone(); m.advance('incense'); const r=m.skip('bow'); assert.deepEqual(r,{navigate:'sit'});}

// 13. end() deactivates without firing event
{const {m,events}=makeM(); m.start(); m.end(); assert.equal(m.isActive(),false); assert.ok(!events.some(e=>e.n==='morning_complete'),'end does not fire complete');}

// 14. currentStep returns null when inactive
{const {m}=makeM(); assert.equal(m.currentStep(),null);}

// 15. old visitors do not repeat the sequence; replay remains available.
{const {m}=makeM(); m.start(); assert.equal(m.shouldShow(),false); m.end(); m.replay(); assert.equal(m.isActive(),true);}

console.log('Morning sequence: all 15 unit assertions passed');
