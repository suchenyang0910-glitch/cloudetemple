import {randomInt} from 'node:crypto';
import pool from './town-name-pool.json' with {type:'json'};
import rules from './town-name-rules.json' with {type:'json'};

const fold = text => text.normalize('NFD').replace(/\p{M}/gu,'').toLowerCase().replaceAll('đ','d');
export function normalizeName(value) {
  if (typeof value !== 'string' || value.length > 200 || /[\p{Cc}\p{Cf}]/u.test(value)) throw Error('name_characters');
  const name = value.normalize('NFKC').normalize('NFC').trim().replace(/ +/g,' ');
  if ([...name].length < 2 || [...name].length > 20 || !/^[\p{Script=Latin} ]+$/u.test(name) || !/\p{L}/u.test(name)) throw Error('name_characters');
  const text = fold(name), compact = text.replaceAll(' ','');
  for (const group of Object.values(rules.groups)) for (const word of group) {
    const term = fold(word);
    if (text.includes(term) || compact.includes(term.replaceAll(' ',''))) throw Error('name_filtered');
  }
  return name;
}
// Draft candidates are filtered again: a replaceable pool never bypasses current rules.
const candidates = pool.names.flatMap(row => {try{return [{id:row.id,name:normalizeName(row.vi)}];}catch{return [];}});
if (candidates.length < 7) throw Error('name_pool_empty');
export function nameChoices(preferredName) {
  const preferred=candidates.find(row=>row.name===preferredName);
  const remaining = candidates.filter(row=>row!==preferred), selected=preferred?[preferred]:[];
  while (selected.length < 7) selected.push(remaining.splice(randomInt(remaining.length),1)[0]);
  return {preferred:selected[0], alternatives:selected.slice(1), review:'draft-native-review-pending'};
}
export function candidateName(id) { const row=candidates.find(row=>row.id===id); if (!row) throw Error('name_candidate'); return row.name; }
export const randomName = excluded => {const available=candidates.filter(row=>row.name!==excluded);return available[randomInt(available.length)].name;};
