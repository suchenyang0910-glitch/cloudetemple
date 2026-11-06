import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';

const port = 4184;
const root = new URL('..', import.meta.url);
const server = spawn(process.execPath, ['tools/serve.mjs'], { cwd: root, env: { ...process.env, PORT: String(port) }, stdio: 'ignore' });
await new Promise(resolve => setTimeout(resolve, 500));
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const evidence = new URL('../evidence/', import.meta.url);
await mkdir(evidence, { recursive: true });
try {
  for (const style of ['soft', 'ink']) {
    const page = await browser.newPage({ viewport: { width: 393, height: 659 } });
    await page.goto(`http://127.0.0.1:${port}/?style=${style}&locals=1`, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => window.__CHUAMAY_READY__ === true);
    await page.waitForTimeout(1600);
    await page.screenshot({ path: new URL(`compare-${style}-393x659.png`, evidence).pathname.slice(1) });
    await page.close();
  }
} finally {
  await browser.close();
  server.kill();
}
