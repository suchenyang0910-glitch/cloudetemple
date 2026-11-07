async (page) => {
  const output = "E:/cloudtemple-worktrees/admin-v1-staging/screenshots/admin-v1";
  const counters = Array.from({ length: 30 }, (_, index) => {
    const day = new Date(Date.UTC(2026, 9, 8 + index)).toISOString().slice(0, 10);
    return [
      { day, metric: "enter", dimension: "", value: 8 + (index % 7) * 2 },
      { day, metric: "share", dimension: "", value: 2 + (index % 4) },
      { day, metric: "activity_complete", dimension: "sit", value: 3 + (index % 5) },
    ];
  }).flat();
  const body = {
    ok: true,
    data: {
      overview: { counters },
      referrals: {
        identities: 68,
        bindings: 19,
        k: 0.28,
        channels: [
          { key: "zalo", value: 9, subjects: 9 },
          { key: "copy", value: 6, subjects: 6 },
          { key: "facebook", status: "insufficient" },
        ],
        activities: [
          { key: "sit", value: 8, subjects: 8 },
          { key: "bow", value: 6, subjects: 6 },
          { key: "recommend", status: "insufficient" },
        ],
        tree: {
          status: "ok",
          nodes: ["A-001", "A-002", "A-003", "A-004", "A-005", "A-006"].map((id) => ({ id })),
          edges: [
            { from: "A-001", to: "A-002" },
            { from: "A-001", to: "A-003" },
            { from: "A-002", to: "A-004" },
            { from: "A-003", to: "A-005" },
            { from: "A-005", to: "A-006" },
          ],
        },
      },
      family: { tablets: 12, members: 31, invites: 9, accepted: 6, averageMembers: 2.58, inviteAcceptance: 0.667, reminderReturn: 0.58 },
      deliveries: [{ key: "sent", value: 18, subjects: 12 }, { key: "failed", status: "insufficient" }],
      operations: { release: "candidate-local", api: "ok", backupAt: "2026-11-06 02:10 UTC", backupCheck: "ok", certificateExpires: "2031-11-06", diskFreeBytes: 12884901888, errors: [{ category: "mail_failed", count: 2, at: "2026-11-06T03:20:00Z" }] },
      features: { family: true, beadGuruRule: "turn-back", guideNoindex: true, mailProvider: "resend", telegram: false },
    },
  };
  await page.route("**/api/summary", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) }));
  await page.emulateMedia({ reducedMotion: "reduce" });
  const sections = ["overview", "referrals", "family", "delivery", "operations", "features"];
  for (const size of [{ name: "desktop", width: 1440, height: 1000 }, { name: "mobile", width: 393, height: 659 }]) {
    await page.setViewportSize({ width: size.width, height: size.height });
    await page.goto("http://127.0.0.1:8788/admin.html");
    await page.locator("#dashboard").waitFor({ state: "visible" });
    for (const id of sections) await page.locator("#" + id).screenshot({ path: `${output}/${size.name}-${id}.png` });
    await page.screenshot({ path: `${output}/${size.name}-full.png`, fullPage: true });
  }
  const overflow = await page.evaluate(() => ({ scrollWidth: document.documentElement.scrollWidth, innerWidth, containsEmail: document.body.innerText.includes("example.com") }));
  return { screenshots: 14, overflow };
}
