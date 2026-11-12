import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import Database from 'better-sqlite3';

const keyMatch = 'v.memorial_id=o.memorial_id AND v.day=o.day AND v.visitor_ref=o.visitor_ref AND v.kind=o.kind';

export function auditPetOfferings(db, now = Date.now()) {
  const {legacyRows, matchedRows} = db.prepare(`
    SELECT count(*) AS legacyRows, count(v.memorial_id) AS matchedRows
    FROM pet_offerings o LEFT JOIN pet_visits v ON ${keyMatch}
  `).get();

  const {changedDailyTotals} = db.prepare(`
    WITH proposed AS (
      SELECT memorial_id, day, visitor_ref, kind FROM pet_visits
      UNION
      SELECT memorial_id, day, visitor_ref, kind FROM pet_offerings
    ), before AS (
      SELECT memorial_id, day, count(DISTINCT visitor_ref) AS visitors,
        count(*) FILTER (WHERE kind='flower') AS flowers,
        count(*) FILTER (WHERE kind='light') AS lights
      FROM pet_visits GROUP BY memorial_id, day
    ), after AS (
      SELECT memorial_id, day, count(DISTINCT visitor_ref) AS visitors,
        count(*) FILTER (WHERE kind='flower') AS flowers,
        count(*) FILTER (WHERE kind='light') AS lights
      FROM proposed GROUP BY memorial_id, day
    )
    SELECT count(*) AS changedDailyTotals FROM after a LEFT JOIN before b USING (memorial_id, day)
    WHERE a.visitors IS NOT b.visitors OR a.flowers IS NOT b.flowers OR a.lights IS NOT b.lights
  `).get();

  // Maintenance uses the stored qualifying timestamp, which the migration never updates.
  // A legacy-only fact lacks a visit timestamp, so it cannot be reconciled automatically.
  const {wallEligible} = db.prepare(`
    SELECT count(*) AS wallEligible FROM pet_memorials WHERE public_status='visible' AND demo=0
    AND coalesce(last_qualifying_visit_at, created_at)<=?
  `).get(now - 365 * 86400000);
  return {legacyRows, rowsToDelete: matchedRows, unmatchedRows: legacyRows - matchedRows,
    changedDailyTotals, wallEligibleBefore: wallEligible, wallEligibleAfter: wallEligible};
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const [file] = process.argv.slice(2);
  if (!file || process.argv.length !== 3) throw Error('Usage: node pet-audit-offerings.mjs <existing-snapshot.sqlite>');
  const db = new Database(file, {readonly: true, fileMustExist: true});
  try {
    const report = db.transaction(() => auditPetOfferings(db))();
    console.log(JSON.stringify(report));
    if (report.unmatchedRows || report.changedDailyTotals) process.exitCode = 2;
  } finally {
    db.close();
  }
}
