import test from "node:test";
import assert from "node:assert/strict";

globalThis.location = { hostname: "staging.chuamay.org", search: "?telegram=1&startapp=family" };
const { telegramStartParam } = await import("../telegram.js");

test("staging family start parameter is accepted without exposing it on production web", () => {
  assert.equal(telegramStartParam(), "family");
  globalThis.location = { hostname: "miniapp.chuamay.org", search: "?startapp=family" };
  assert.equal(telegramStartParam(), "");
});
