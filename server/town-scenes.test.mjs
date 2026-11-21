import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,mkdtempSync,unlinkSync,rmdirSync} from 'node:fs';
import {join} from 'node:path';
import {loadTownScenes} from './town-scenes.mjs';

const fixture=new URL('./town-seats.TEST.json',import.meta.url);
function withReportedLientri(run){
  // Synthetic contract fixture, not C's unaccepted v43 coordinates.
  const data=JSON.parse(readFileSync(fixture,'utf8'));
  data.scenes.lientri.seats.slice(8).forEach(seat=>seat.kind='lamp');
  mkdirSync(new URL('../_archive/',import.meta.url),{recursive:true});
  const dir=mkdtempSync(new URL('../_archive/town-scenes-',import.meta.url));
  const file=join(dir,'reported-lientri.TEST.json');
  try{writeFileSync(file,JSON.stringify(data));run(file,data);}finally{unlinkSync(file);rmdirSync(dir);}
}

test('lientri keeps explicit cap 12 with eight exclusive seats and four lamps',()=>{
  withReportedLientri((file,data)=>{
    assert.equal(data.test,true);
    assert.equal(data.scenes.lientri.cap,12);
    assert.equal(data.scenes.lientri.seats.filter(s=>s.kind==='sit').length,8);
    assert.equal(data.scenes.lientri.seats.filter(s=>s.kind==='lamp').length,4);
    const loaded=loadTownScenes(file,{allowTest:true}).lientri;
    assert.equal(loaded.cap,12);
    assert.equal(Object.keys(loaded.seats).length,8);
    assert(Object.values(loaded.seats).every(s=>s.kind==='sit'));
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

test('explicit cap may be lower than total positions; town can have exclusive seats',()=>{
  withReportedLientri((file,data)=>{
    const hall=data.scenes.chuamay;
    for(let i=0;i<8;i++)hall.seats.push({id:'extra-'+i,kind:i<4?'mo':'incense',x:1,z:1,yaw:0});
    data.scenes.town.seats[0].kind='sit';
    writeFileSync(file,JSON.stringify(data));
    const loaded=loadTownScenes(file,{allowTest:true});
    assert.equal(hall.seats.length,24);
    assert.equal(loaded.chuamay.cap,16);
    assert.equal(Object.keys(loaded.chuamay.seats).length,20);
    assert.equal(loaded.town.cap,20);
    assert.equal(Object.keys(loaded.town.seats).length,1);
  });
});

test('invalid capacity, insufficient positions and duplicate ids identify scene and rule',()=>{
  for(const cap of [0,21,1.5,'12'])withReportedLientri((file,data)=>{
    data.scenes.lientri.cap=cap;writeFileSync(file,JSON.stringify(data));
    assert.throws(()=>loadTownScenes(file,{allowTest:true}),/^Error: scene_cap:lientri$/);
  });
  withReportedLientri((file,data)=>{
    data.scenes.lientri.seats.pop();writeFileSync(file,JSON.stringify(data));
    assert.throws(()=>loadTownScenes(file,{allowTest:true}),/^Error: scene_positions:lientri$/);
  });
  withReportedLientri((file,data)=>{
    data.scenes.lientri.seats[11].id=data.scenes.lientri.seats[0].id;
    writeFileSync(file,JSON.stringify(data));
    assert.throws(()=>loadTownScenes(file,{allowTest:true}),/^Error: seat_duplicate:lientri$/);
  });
});

test('strict JSON rejects bare decimal numbers, BOM, comments and trailing commas',()=>{
  for(const change of [s=>s.replace('6.2','-.7'),s=>s.replace('6.2','.7'),s=>'\ufeff'+s,s=>'/*comment*/'+s,s=>s.slice(0,-1)+',}'])withReportedLientri((file)=>{
    writeFileSync(file,change(readFileSync(file,'utf8')));
    assert.throws(()=>loadTownScenes(file,{allowTest:true}),SyntaxError);
  });
});
