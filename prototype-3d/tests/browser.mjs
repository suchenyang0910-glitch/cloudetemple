import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const port = Number(process.env.PORT || 4181);
const origin = `http://127.0.0.1:${port}`;
const server = spawn(process.execPath, ['tools/serve.mjs'], { cwd: new URL('..', import.meta.url), env: { ...process.env, PORT: String(port) }, stdio: 'ignore' });
await new Promise(resolve => setTimeout(resolve, 500));
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const evidence = new URL('../evidence/hd2d/', import.meta.url);
await mkdir(evidence, { recursive: true });
const report = [];

try {
  const viewports = [{ width: 375, height: 548 }, { width: 393, height: 659 }]
    .filter(viewport => !process.env.VIEWPORT_WIDTH || viewport.width === Number(process.env.VIEWPORT_WIDTH));
  for (const viewport of viewports) {
    const page = await browser.newPage({ viewport, reducedMotion: 'no-preference' });
    const errors = [];
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    await page.goto(`${origin}/?locals=1`, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => window.__CHUAMAY_READY__ === true);
    await page.waitForTimeout(2500);
    const initial = await page.evaluate(() => ({
      metrics: window.__CHUAMAY_METRICS__, state: window.__CHUAMAY_STATE__,
      scroll: { width: document.documentElement.scrollWidth, height: document.documentElement.scrollHeight, innerWidth, innerHeight },
      resources: performance.getEntriesByType('resource').map(entry => ({ name: entry.name, transferSize: entry.transferSize }))
    }));
    assert.equal(initial.scroll.width, viewport.width);
    assert.equal(initial.scroll.height, viewport.height);
    assert.equal(initial.state.style, 'hd2d');
    assert.equal(initial.state.locals, 2);
    assert.ok(initial.metrics.bytes < 10 * 1024 * 1024, `first load ${initial.metrics.bytes} exceeds budget`);
    assert.ok(initial.metrics.fps >= 30, `emulated FPS ${initial.metrics.fps} below target`);
    assert.ok(initial.resources.every(item => new URL(item.name).origin === origin), 'external runtime request found');
    await page.screenshot({ path: new URL(`courtyard-${viewport.width}x${viewport.height}.png`, evidence).pathname.slice(1) });

    await page.keyboard.down('ArrowUp');
    await page.waitForTimeout(6500);
    await page.keyboard.up('ArrowUp');
    await page.waitForTimeout(500);
    const near = await page.evaluate(() => window.__CHUAMAY_STATE__);
    assert.equal(near.zone, 'incense');
    await page.screenshot({ path: new URL(`hall-front-${viewport.width}x${viewport.height}.png`, evidence).pathname.slice(1) });

    await page.getByRole('button', { name: 'Thắp hương' }).click();
    await page.waitForTimeout(900);
    const incense = await page.evaluate(() => ({ state: window.__CHUAMAY_STATE__, hint: getComputedStyle(document.querySelector('#walk-hint')).display }));
    assert.equal(incense.state.action, 'palms');
    assert.equal(incense.state.visitorView, 'side');
    assert.equal(incense.state.visitorFlip, true);
    assert.equal(incense.hint, 'none');
    await page.screenshot({ path: new URL(`incense-${viewport.width}x${viewport.height}.png`, evidence).pathname.slice(1) });

    await page.keyboard.press('b');
    await page.waitForTimeout(1850);
    const bow = await page.evaluate(() => window.__CHUAMAY_STATE__);
    assert.equal(bow.action, 'bow');
    assert.equal(bow.visitorView, 'side');
    assert.equal(bow.visitorFlip, true);
    await page.screenshot({ path: new URL(`bow-mid-${viewport.width}x${viewport.height}.png`, evidence).pathname.slice(1) });

    await page.keyboard.press('c');
    await page.waitForTimeout(1100);
    const sit = await page.evaluate(() => window.__CHUAMAY_STATE__);
    assert.equal(sit.action, 'sit');
    assert.equal(sit.visitorView, 'side');
    assert.equal(sit.visitorFlip, true);
    await page.screenshot({ path: new URL(`sit-side-${viewport.width}x${viewport.height}.png`, evidence).pathname.slice(1) });

    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'FPS' }).click();
    await page.getByRole('button', { name: 'Xuất JSON' }).click();
    const download = await downloadPromise;
    assert.match(download.suggestedFilename(), /^chuamay-hd2d-metrics-.+\.json$/);
    assert.deepEqual(errors, []);
    report.push({ viewport, initial: initial.metrics, afterWalk: near, externalRequests: 0 });
    await page.close();
  }
  await writeFile(new URL(process.env.VIEWPORT_WIDTH ? `browser-report-${process.env.VIEWPORT_WIDTH}.json` : 'browser-report.json', evidence), `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report, null, 2));
} finally {
  await browser.close();
  server.kill();
}
