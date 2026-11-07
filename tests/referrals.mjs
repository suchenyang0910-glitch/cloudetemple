import test from "node:test";
import assert from "node:assert/strict";
import { createReferrals } from "../referrals.js";

const install = (choice, responses = []) => {
  const values = new Map(choice ? [["ct-analytics", choice]] : []), calls = [];
  globalThis.location = { origin: "https://staging.chuamay.org" };
  globalThis.localStorage = { getItem: (key) => values.get(key) || null, setItem: (key, value) => values.set(key, value), removeItem: (key) => values.delete(key) };
  globalThis.fetch = async (url, options) => { calls.push({ url, body: JSON.parse(options.body), method: options.method }); const data = responses.shift() || { ok: true }; return new Response(JSON.stringify(data), { status: 200, headers: { "Content-Type": "application/json" } }); };
  return { values, calls };
};
const make = (landing, enabled = true) => createReferrals({ apiURL: (path) => "/api" + path, telegramData: () => "", startParam: () => "", landing, enabled });

test("a preview/open alone does not bind and disabled production mode writes nothing", async () => {
  const f = install("yes"); make({ referral: "abcd2342", source: "zalo", activity: "sit" }); await Promise.resolve(); assert.equal(f.calls.length, 0);
  const disabled = make({ referral: "abcd2342", source: "zalo", activity: "sit" }, false); await disabled.sync(); await disabled.enter(); assert.equal(f.calls.length, 0); assert.equal(f.values.has("ct-referral-id"), false);
});

test("declining consent counts the click without creating a persistent identity", async () => {
  const f = install("no", [{ ok: true, status: "anonymous" }]), referral = make({ referral: "abcd2342", source: "zalo", activity: "sit" });
  await referral.enter(); assert.equal(f.calls.length, 1); assert.equal(f.calls[0].url, "/api/referrals/bind"); assert.equal(f.calls[0].body.consent, false); assert.equal("anonymousId" in f.calls[0].body, false); assert.equal(f.values.has("ct-referral-id"), false);
});

test("consenting creates one random identity, persists the code and binds on entry", async () => {
  const f = install("yes", [{ ok: true, code: "abcd2343" }, { ok: true, status: "bound" }]), referral = make({ referral: "abcd2342", source: "copy", activity: "bow" });
  const result = await referral.enter(); assert.equal(result.status, "bound"); assert.match(f.values.get("ct-referral-id"), /^[0-9a-f-]{36}$/i); assert.equal(f.values.get("ct-referral-code"), "abcd2343"); assert.match(referral.link("zalo", "sit"), /[?&]r=abcd2343/); assert.equal(f.calls[1].body.channel, "copy"); assert.equal(f.calls[1].body.activity, "bow");
});
