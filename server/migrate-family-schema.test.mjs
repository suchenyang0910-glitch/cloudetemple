import test from "node:test";
import assert from "node:assert/strict";
import Database from "better-sqlite3";
import {
  inspectFamilySchema,
  migrateFamilySchema,
  REQUIRED_FAMILY_TABLES,
} from "./migrate-family-schema.mjs";

test("family schema migration is complete, idempotent, and preserves existing data", () => {
  const db = new Database(":memory:");
  try {
    db.exec("CREATE TABLE existing_marker(value TEXT NOT NULL); INSERT INTO existing_marker VALUES('kept')");
    assert.equal(inspectFamilySchema(db).present, 0);

    const first = migrateFamilySchema(db);
    const second = migrateFamilySchema(db);

    assert.deepEqual(first, {
      integrity: "ok",
      required: REQUIRED_FAMILY_TABLES.length,
      present: REQUIRED_FAMILY_TABLES.length,
      missing: [],
    });
    assert.deepEqual(second, first);
    assert.equal(db.prepare("SELECT value FROM existing_marker").pluck().get(), "kept");
  } finally {
    db.close();
  }
});
