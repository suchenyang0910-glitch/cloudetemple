import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import Database from 'better-sqlite3';
import {auditPetOfferings} from './pet-audit-offerings.mjs';

export function migratePetOfferings(db) {
  return db.transaction(() => {
    const report = auditPetOfferings(db);
    if (report.unmatchedRows || report.changedDailyTotals) throw Error('Pet offering audit failed');
    const {changes} = db.prepare('DELETE FROM pet_offerings').run();
    if (changes !== report.rowsToDelete) throw Error('Unexpected pet offering deletion count');
    return {deleted: changes};
  }).immediate();
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const [mode, file] = process.argv.slice(2);
  if (mode !== '--apply' || !file || process.argv.length !== 4) {
    throw Error('Usage: node pet-migrate-offerings.mjs --apply <reviewed-existing-db.sqlite>');
  }
  const db = new Database(file, {fileMustExist: true});
  try {
    console.log(JSON.stringify(migratePetOfferings(db)));
  } finally {
    db.close();
  }
}
