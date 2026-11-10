from datetime import datetime, timezone
from pathlib import Path
import json
import os

from PIL import Image, ImageChops
from playwright.sync_api import sync_playwright


ROOT = Path(__file__).resolve().parents[1]
BASE = os.environ.get("CT_TEST_BASE", "http://127.0.0.1:8830")
OUT = ROOT / "screenshots" / "mo-mallet-integrated"
OUT.mkdir(parents=True, exist_ok=True)
VISITORS = ["short-light", "curly-dark", "curly-medium", "bun-light", "bun-dark", "ponytail-medium"]


def asset(visitor, frame):
    return ROOT / "assets" / "processed-v1" / "img" / f"visitor-{visitor}-mo-{frame}-v3.webp"


for visitor in VISITORS:
    frames = [Image.open(asset(visitor, frame)).convert("RGBA") for frame in (1, 2, 3)]
    assert all(frame.size == (600, 600) for frame in frames), visitor
    assert ImageChops.difference(frames[0], frames[2]).getbbox() is None, f"{visitor}: landing frames differ"
    changed = ImageChops.difference(frames[0], frames[1]).getbbox()
    assert changed and changed[0] >= 130 and changed[1] >= 230 and changed[2] <= 390 and changed[3] <= 490, (visitor, changed)


def ready(page):
    page.wait_for_function("document.querySelector('#app')?.getAttribute('aria-busy') === 'false'")
    page.wait_for_timeout(350)


def open_mo(page, visitor):
    page.add_init_script(
        f"localStorage.setItem('ct-muted','true');"
        f"localStorage.setItem('ct-analytics','no');"
        f"localStorage.setItem('ct-morning-seen','true');"
        f"localStorage.setItem('ct-sound-hint-seen','true');"
        f"localStorage.setItem('ct-visitor',JSON.stringify('{visitor}'));"
    )
    page.goto(BASE)
    ready(page)
    for action in ("enter", "continue", "mo"):
        page.locator(f'[data-action="{action}"]:visible').first.click()
        ready(page)


tiles = []
checks = []
with sync_playwright() as pw:
    browser = pw.chromium.launch()
    for hour, period in ((10, "day"), (21, "night")):
        for visitor in VISITORS:
            context = browser.new_context(viewport={"width": 393, "height": 659}, timezone_id="UTC")
            page = context.new_page()
            page.clock.set_fixed_time(datetime(2026, 11, 10, hour, tzinfo=timezone.utc))
            requested = []
            page.on("request", lambda request: requested.append(request.url))
            open_mo(page, visitor)
            pose = page.locator("#scene").get_attribute("data-pose")
            assert pose == "mo-1-v3", (visitor, period, pose)
            assert any(f"visitor-{visitor}-mo-1-v3.webp" in url for url in requested), (visitor, period)
            assert not any("mo-mallet.webp" in url for url in requested), (visitor, period)
            target = OUT / f"{visitor}-{period}.png"
            page.screenshot(path=str(target))
            tiles.append(target)
            context.close()

    context = browser.new_context(viewport={"width": 393, "height": 659}, timezone_id="UTC")
    page = context.new_page()
    page.clock.set_fixed_time(datetime(2026, 11, 10, 10, tzinfo=timezone.utc))
    open_mo(page, "short-light")
    module_url = page.locator('script[type="module"][src^="app."]').get_attribute("src") or "/app.js"
    page.evaluate(
        """async src => {
          const mod = await import(new URL(src, location.href));
          window.__woodSounds = 0;
          const strike = mod.audio.strike.bind(mod.audio);
          mod.audio.strike = (name, ...args) => {
            if (name === 'wood') window.__woodSounds++;
            return strike(name, ...args);
          };
        }""",
        module_url,
    )
    before = int(page.locator("#daily-wood").inner_text().split(":")[-1].strip())
    for _ in range(5):
        page.locator('[data-action="wood"]').click()
        page.clock.run_for(150)
    page.clock.run_for(800)
    rapid = int(page.locator("#daily-wood").inner_text().split(":")[-1].strip()) - before
    assert rapid == 5 and page.evaluate("window.__woodSounds") == 5
    page.locator('[data-action="wood-auto"]').click()
    page.clock.run_for(2250)
    page.locator('[data-action="wood-auto"]').click()
    page.clock.run_for(300)
    automatic = int(page.locator("#daily-wood").inner_text().split(":")[-1].strip()) - before - rapid
    assert automatic == 2 and page.evaluate("window.__woodSounds") == 7
    checks.append({"rapidTaps": rapid, "autoTaps": automatic, "woodSounds": 7})
    context.close()

    context = browser.new_context(viewport={"width": 393, "height": 659}, timezone_id="UTC", reduced_motion="reduce")
    page = context.new_page()
    page.clock.set_fixed_time(datetime(2026, 11, 10, 10, tzinfo=timezone.utc))
    open_mo(page, "short-light")
    page.locator('[data-action="wood"]').click()
    page.clock.run_for(20)
    assert page.locator("#scene").get_attribute("data-pose") == "mo-3-v3"
    checks.append({"reducedMotionPose": "mo-3-v3"})
    context.close()

    video_dir = OUT / "video-tmp"
    video_dir.mkdir(exist_ok=True)
    context = browser.new_context(
        viewport={"width": 393, "height": 659},
        timezone_id="UTC",
        record_video_dir=str(video_dir),
        record_video_size={"width": 393, "height": 659},
    )
    page = context.new_page()
    open_mo(page, "short-light")
    for _ in range(5):
        page.locator('[data-action="wood"]').click()
        page.wait_for_timeout(160)
    page.wait_for_timeout(700)
    page.locator('[data-action="wood-auto"]').click()
    page.wait_for_timeout(2300)
    page.locator('[data-action="wood-auto"]').click()
    page.wait_for_timeout(350)
    video = page.video
    context.close()
    video.save_as(OUT / "mo-rapid-auto-393x659.webm")
    video.delete()
    video_dir.rmdir()
    browser.close()

images = [Image.open(path).convert("RGB") for path in tiles]
sheet = Image.new("RGB", (393 * 6, 659 * 2), "white")
for index, image in enumerate(images):
    sheet.paste(image, ((index % 6) * 393, (index // 6) * 659))
sheet.save(OUT / "total-mo-6x-day-night.jpg", quality=88)
(OUT / "checks.json").write_text(json.dumps(checks, ensure_ascii=False, indent=2), encoding="utf-8")
print(json.dumps({"passed": True, "reviewImages": len(tiles), "checks": checks}, ensure_ascii=False))
