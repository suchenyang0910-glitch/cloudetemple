import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import Database from "better-sqlite3";
import { openFamilyStore } from "./family-store.mjs";

export const REQUIRED_FAMILY_TABLES = [
  "tablets",
  "tablet_members",
  "invites",
  "offerings",
];

export function inspectFamilySchema(db) {
  const found = new Set(
    db
      .prepare("SELECT name FROM sqlite_master WHERE type='table'")
      .all()
      .map(({ name }) => name),
  );
  const present = REQUIRED_FAMILY_TABLES.filter((name) => found.has(name));
  return {
    integrity: db.pragma("integrity_check", { simple: true }),
    required: REQUIRED_FAMILY_TABLES.length,
    present: present.length,
    missing: REQUIRED_FAMILY_TABLES.filter((name) => !found.has(name)),
  };
}

export function migrateFamilySchema(db) {
  db.transaction(() => openFamilyStore(db, { demo: false }))();
  return inspectFamilySchema(db);
}

function main() {
  const [mode, input] = process.argv.slice(2);
  if (!["--check", "--apply"].includes(mode) || !input) {
    throw new Error("usage: node migrate-family-schema.mjs --check|--apply <existing-db-path>");
  }
  const file = resolve(input);
  if (!existsSync(file)) throw new Error("database file does not exist");
  const db = new Database(file);
  try {
    db.pragma("busy_timeout = 5000");
    const result = mode === "--apply" ? migrateFamilySchema(db) : inspectFamilySchema(db);
    process.stdout.write(`${JSON.stringify({ mode: mode.slice(2), ...result })}\n`);
    if (result.integrity !== "ok" || result.present !== result.required) process.exitCode = 2;
  } finally {
    db.close();
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] || "").href) main();
