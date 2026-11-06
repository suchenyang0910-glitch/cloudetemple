import { spawn, spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { chromium } from 'playwright';

const root = resolve(new URL('..', import.meta.url).pathname.slice(1));
const port = 4182;
const server = spawn(process.execPath, ['tools/serve.mjs'], { cwd: root, env: { ...process.env, PORT: String(port) }, stdio: 'ignore' });
await new Promise(resolve => setTimeout(resolve, 500));
const frames = await mkdtemp(join(tmpdir(), 'chuamay-3d-frames-'));
const evidence = resolve(root, 'evidence');
await mkdir(evidence, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });

try {
  const page = await browser.newPage({ viewport: { width: 393, height: 659 } });
  await page.goto(`http://127.0.0.1:${port}/?style=soft&locals=1`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.__CHUAMAY_READY__ === true);
  const started = Date.now();
  for (let frame = 0; frame < 150; frame += 1) {
    if (frame === 8) await page.keyboard.down('ArrowUp');
    if (frame === 39) await page.keyboard.up('ArrowUp');
    if (frame === 48) await page.getByRole('button', { name: 'Mực nét' }).click();
    if (frame === 82) await page.keyboard.press('p');
    if (frame === 106) await page.keyboard.press('b');
    await page.screenshot({ path: join(frames, `frame-${String(frame).padStart(3, '0')}.png`) });
    const due = started + (frame + 1) * 200;
    if (Date.now() < due) await page.waitForTimeout(due - Date.now());
  }
  const output = resolve(evidence, 'walk-30s.mp4');
  const encoded = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-framerate', '5', '-i', join(frames, 'frame-%03d.png'), '-vf', 'pad=ceil(iw/2)*2:ceil(ih/2)*2', '-c:v', 'libx264', '-crf', '23', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', output], { stdio: 'inherit' });
  if (encoded.status !== 0) throw new Error(`ffmpeg failed with ${encoded.status}`);
  console.log(output);
} finally {
  await browser.close();
  server.kill();
  await rm(frames, { recursive: true, force: true });
}
