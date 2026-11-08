async (page) => {
  const output = "E:/cloudtemple-worktrees/admin-v1-staging/screenshots/admin-v1";
  let mode = "loading";
  const empty = { ok: true, data: { overview: { counters: [] }, referrals: { identities: 0, bindings: 0, k: null, channels: [], activities: [], tree: { status: "insufficient", nodes: [], edges: [] } }, family: { tablets: 0, members: 0, invites: 0, accepted: 0, averageMembers: null, inviteAcceptance: null, reminderReturn: null }, deliveries: [], operations: { release: "", api: "unknown", backupAt: "", backupCheck: "unknown", certificateExpires: "", diskFreeBytes: null, daily: null, errors: [] }, features: { family: false, beadGuruRule: "turn-back", guideNoindex: true, mailProvider: "outbox", telegram: false } } };
  await page.route("**/api/summary", async (route) => {
    if (mode === "loading") return new Promise((resolve) => setTimeout(() => { route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(empty) }); resolve(); }, 1200));
    if (mode === "error") return route.fulfill({ status: 503, contentType: "application/json", body: '{"ok":false,"error":"unavailable"}' });
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(empty) });
  });
  for (const size of [{ name: "desktop", width: 1440, height: 1000 }, { name: "mobile", width: 393, height: 659 }]) {
    await page.setViewportSize({ width: size.width, height: size.height });
    mode = "loading"; await page.goto("http://127.0.0.1:8788/admin.html"); await page.locator("#loading").screenshot({ path: `${output}/${size.name}-loading.png` }); await page.waitForTimeout(1300);
    mode = "empty"; await page.reload(); await page.locator("#dashboard").waitFor({ state: "visible" }); await page.screenshot({ path: `${output}/${size.name}-empty.png`, fullPage: true });
    mode = "error"; await page.reload(); await page.locator("#error").waitFor({ state: "visible" }); await page.locator("#error").screenshot({ path: `${output}/${size.name}-error.png` });
  }
  return { screenshots: 6 };
}
