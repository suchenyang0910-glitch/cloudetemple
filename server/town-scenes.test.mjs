import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,mkdtempSync,unlinkSync,rmdirSync} from 'node:fs';
import {join} from 'node:path';
import {loadTownScenes} from './town-scenes.mjs';

const fixture=new URL('./town-seats.TEST.json',import.meta.url);
function withReportedLientri(run){
  // Synthetic reproduction of A's report, not C's missing final v43 coordinates.
  const data=JSON.parse(readFileSync(fixture,'utf8'));
  data.scenes.lientri.seats.slice(8).forEach(seat=>seat.kind='lamp');
  mkdirSync(new URL('../_archive/',import.meta.url),{recursive:true});
  const dir=mkdtempSync(new URL('../_archive/town-scenes-',import.meta.url));
  const file=join(dir,'reported-lientri.TEST.json');
  try{writeFileSync(file,JSON.stringify(data));run(file,data);}finally{unlinkSync(file);rmdirSync(dir);}
}

test('reported cap 12 / 8 sit + 4 lamp exposes the current contract conflict',()=>{
  withReportedLientri((file,data)=>{
    assert.equal(data.test,true);
    assert.equal(data.scenes.lientri.cap,12);
    assert.equal(data.scenes.lientri.seats.filter(s=>s.kind==='sit').length,8);
    assert.equal(data.scenes.lientri.seats.filter(s=>s.kind==='lamp').length,4);
    assert.throws(()=>loadTownScenes(file,{allowTest:true}),/^Error: seat_capacity$/);
  });
});

test('reported configuration cannot bypass TEST opt-in or TEST filename',()=>{
  withReportedLientri((file)=>{
    assert.throws(()=>loadTownScenes(file),/^Error: seats_config$/);
    const unmarked=join(file,'..','reported-lientri.json');
    try{writeFileSync(unmarked,readFileSync(file));assert.throws(()=>loadTownScenes(unmarked,{allowTest:true}),/^Error: test_seats_filename$/);}
    finally{unlinkSync(unmarked);}
  });
});

test('nonexclusive lamp points stay outside the arbitration map',()=>{
  withReportedLientri((file,data)=>{
    // Control fixture only; this is not a proposal to lower the product capacity.
    data.scenes.lientri.cap=8;
    writeFileSync(file,JSON.stringify(data));
    const loaded=loadTownScenes(file,{allowTest:true}).lientri;
    assert.equal(loaded.cap,8);
    assert.equal(Object.keys(loaded.seats).length,8);
    assert(Object.values(loaded.seats).every(s=>s.kind==='sit'));
  });
});
