import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const port = 4183;
const root = new URL('..', import.meta.url);
const server = spawn(process.execPath, ['tools/serve.mjs'], { cwd: root, env: { ...process.env, PORT: String(port) }, stdio: 'ignore' });
await new Promise(resolve => setTimeout(resolve, 500));
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const profiles = [
  { name: 'iphone15-chromium-proxy', viewport: { width: 393, height: 659 }, cpu: 2, ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148' },
  { name: 'mid-android-4x-cpu', viewport: { width: 360, height: 740 }, cpu: 4, ua: 'Mozilla/5.0 (Linux; Android 13; Redmi Note 11) AppleWebKit/537.36 Chrome/126 Mobile Safari/537.36' }
];
const report = [];

try {
  for (const profile of profiles) {
    const context = await browser.newContext({ viewport: profile.viewport, userAgent: profile.ua });
    const page = await context.newPage();
    const cdp = await context.newCDPSession(page);
    await cdp.send('Network.enable');
    await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 80, downloadThroughput: 500 * 1024, uploadThroughput: 125 * 1024, connectionType: 'cellular4g' });
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: profile.cpu });
    const started = performance.now();
    await page.goto(`http://127.0.0.1:${port}/?style=soft&locals=1`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.__CHUAMAY_READY__ === true, null, { timeout: 30000 });
    const readyMs = performance.now() - started;
    await page.waitForTimeout(6500);
    const measured = await page.evaluate(() => ({ metrics: window.__CHUAMAY_METRICS__, state: window.__CHUAMAY_STATE__ }));
    report.push({ ...profile, network: '4 Mbps down / 1 Mbps up / 80 ms RTT', readyMs, ...measured });
    await context.close();
  }
  const evidence = new URL('../evidence/', import.meta.url);
  await mkdir(evidence, { recursive: true });
  await writeFile(new URL('emulated-4g-report.json', evidence), `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report, null, 2));
} finally {
  await browser.close();
  server.kill();
}
