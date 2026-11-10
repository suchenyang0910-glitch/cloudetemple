import { existsSync } from "node:fs";
import { resolve } from "node:path";
import Database from "better-sqlite3";
import { identityDuplicateSummary } from "./family-store.mjs";

const input = process.argv[2];
if (!input) throw Error("usage: node check-family-identity-duplicates.mjs <db-path>");
const file = resolve(input);
if (!existsSync(file)) throw Error("database file does not exist");
const db = new Database(file, { readonly: true });
try {
  process.stdout.write(`${JSON.stringify(identityDuplicateSummary(db))}\n`);
} finally {
  db.close();
}
