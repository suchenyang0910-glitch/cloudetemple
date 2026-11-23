import {readFileSync} from 'node:fs';
import {createHash,randomInt} from 'node:crypto';
import {normalizeName} from './town-names.mjs';
import draft from './town-name-pool.json' with {type:'json'};

export function townNamePolicy(pool,{reviewed=false}={}){
  const rows=pool.names.map(row=>({id:row.id,name:normalizeName(row.vi)}));
  if(rows.length<7||rows.some(row=>!Number.isSafeInteger(row.id))||new Set(rows.map(r=>r.id)).size!==rows.length||new Set(rows.map(r=>r.name)).size!==rows.length)throw Error('name_pool');
  const byId=new Map(rows.map(r=>[r.id,r.name])),names=new Set(rows.map(r=>r.name));
  const normalize=value=>{const name=normalizeName(value);if(!names.has(name))throw Error('name_candidate');return name;};
  return {reviewed,normalize,
    candidate:id=>{if(!byId.has(id))throw Error('name_candidate');return byId.get(id);},
    random:excluded=>{const available=rows.filter(r=>r.name!==excluded);return available[randomInt(available.length)].name;},
    choices(preferred){const first=rows.find(r=>r.name===preferred),remaining=rows.filter(r=>r!==first),selected=first?[first]:[];while(selected.length<7)selected.push(remaining.splice(randomInt(remaining.length),1)[0]);return {preferred:selected[0],alternatives:selected.slice(1),review:reviewed?'reviewed':'draft-native-review-pending'};},
  };
}
export function loadTownNamePolicy(file,sha256){
  if(!file||! /^[a-f0-9]{64}$/i.test(sha256||''))throw Error('reviewed_name_pool_required');
  const bytes=readFileSync(file);
  if(createHash('sha256').update(bytes).digest('hex')!==sha256.toLowerCase())throw Error('name_pool_hash');
  const pool=JSON.parse(bytes.toString('utf8'));
  if(pool.reviewed!==true||pool.version!==1)throw Error('reviewed_name_pool_required');
  return townNamePolicy(pool,{reviewed:true});
}
// The draft stays visibly unreviewed and cannot start production.
export const draftTownNames=townNamePolicy({names:draft.names.filter(row=>{try{normalizeName(row.vi);return true;}catch{return false;}})});
