import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';

const port = 4184;
const root = new URL('..', import.meta.url);
const server = spawn(process.execPath, ['tools/serve.mjs'], { cwd: root, env: { ...process.env, PORT: String(port) }, stdio: 'ignore' });
await new Promise(resolve => setTimeout(resolve, 500));
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const evidence = new URL('../evidence/hd2d/', import.meta.url);
await mkdir(evidence, { recursive: true });
try {
  const page = await browser.newPage({ viewport: { width: 393, height: 659 } });
  await page.goto(`http://127.0.0.1:${port}/?locals=1`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.__CHUAMAY_READY__ === true);
  await page.waitForTimeout(1800);
  await page.screenshot({ path: new URL('hd2d-393x659.png', evidence).pathname.slice(1) });
} finally {
  await browser.close();
  server.kill();
}
