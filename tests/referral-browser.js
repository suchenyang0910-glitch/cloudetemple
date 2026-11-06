async (page) => {
  const errors = [], requests = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route("**/api/**", async (route) => {
    const request = route.request(), body = request.postDataJSON?.() || {};
    requests.push({ path: new URL(request.url()).pathname, body });
    const path = new URL(request.url()).pathname;
    const data = path.endsWith("/identity") ? { ok: true, code: "abcd2343" } : path.endsWith("/bind") ? { ok: true, status: "bound" } : path.endsWith("/me") ? { ok: true, data: { direct: 2, second: 1, channels: [] } } : { ok: true };
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(data) });
  });
  const results = [];
  for (const size of [{ width: 375, height: 548 }, { width: 393, height: 659 }]) {
    await page.setViewportSize(size);
    await page.goto("http://127.0.0.1:8789/");
    await page.evaluate(() => { localStorage.clear(); localStorage.setItem("ct-analytics", "yes"); });
    await page.goto("http://127.0.0.1:8789/?r=abcd2342&s=zalo&a=sit");
    await page.locator("#ga-choice").evaluate((element) => { element.hidden = true; });
    await page.locator('[data-action="enter"]').click();
    await page.locator('[data-action="continue"]').click();
    await page.waitForFunction(() => document.body.dataset.view === "sit");
    await page.locator('[data-action="home"]').first().click();
    await page.locator('[data-action="incense"]').waitFor();
    for (const action of ["incense", "bow", "sit", "mo", "beads"]) {
      await page.locator(`[data-action="${action}"]`).first().click();
      await page.locator('[data-action="home"]').first().click();
    }
    await page.locator('[data-action="more"]').click();
    await page.locator('[data-action="referral-stats"]').click();
    await page.locator("#referral-result").filter({ hasText: "2" }).waitFor();
    results.push(await page.evaluate(() => ({ width: innerWidth, scrollWidth: document.documentElement.scrollWidth, scrollHeight: document.documentElement.scrollHeight, innerHeight, id: localStorage.getItem("ct-referral-id"), code: localStorage.getItem("ct-referral-code") })));
    await page.locator("#close-modal").click();
  }
  if (errors.length) throw Error(errors.join("\n"));
  if (requests.some((request) => /email|full.?name|death|token/i.test(JSON.stringify(request.body)))) throw Error("PII field in referral request");
  return { passed: results.every((item) => item.width === item.scrollWidth && item.scrollHeight === item.innerHeight && /^[0-9a-f-]{36}$/i.test(item.id) && item.code === "abcd2343"), results, requestPaths: [...new Set(requests.map((request) => request.path))] };
}
