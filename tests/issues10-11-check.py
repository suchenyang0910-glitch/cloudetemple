from datetime import datetime
from pathlib import Path
import json
import sys

from playwright.sync_api import sync_playwright


base = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:8788"
root = Path(__file__).resolve().parents[1]
out = root / "screenshots" / "issues10-11"
out.mkdir(parents=True, exist_ok=True)
results = []


with sync_playwright() as pw:
    browser = pw.chromium.launch(headless=True)
    for width, height in ((375, 548), (393, 659)):
        context = browser.new_context(
            viewport={"width": width, "height": height},
            timezone_id="Asia/Ho_Chi_Minh",
        )
        page = context.new_page()
        page.add_init_script(
            "localStorage.setItem('ct-muted','true');"
            "localStorage.setItem('ct-analytics','no');"
            "localStorage.setItem('ct-visitor',JSON.stringify('bun-light'));"
        )
        page.clock.install(time=datetime.fromisoformat("2026-11-06T10:00:00+07:00"))
        page.goto(base)
        if page.locator("#ga-choice:visible").count():
            page.locator("#ga-choice").evaluate("element=>element.hidden=true")

        def click(action):
            page.locator(f'[data-action="{action}"]:visible').first.click()

        def settled(view):
            page.wait_for_function("view => document.body.dataset.view === view && document.querySelector('#app')?.getAttribute('aria-busy')==='false'", arg=view)
            page.locator("#loading").wait_for(state="hidden")
            page.clock.run_for(400)
            page.evaluate("document.getAnimations().filter(animation=>animation.effect.getTiming().iterations!==Infinity).forEach(animation=>animation.finish())")

        click("enter")
        settled("choose")
        click("continue")
        settled("home")
        click("incense")
        settled("incense")
        click("light")
        page.clock.fast_forward(61000)
        assert page.locator('[data-action="share"]').is_visible()
        click("home")
        settled("home")
        click("bow")
        settled("bow")
        click("bow-once")
        page.clock.run_for(3700)
        assert page.locator("#bow-count").inner_text() == "1 / 3"
        click("home")
        settled("home")
        click("mo")
        settled("mo")
        module_url = page.locator('script[src*="app."]').get_attribute("src") or "/app.js"
        resource_url = module_url.replace("app.", "resources.")
        image_status = page.evaluate("async src=>Object.fromEntries((await import(new URL(src,location.href))).imageStatus)", resource_url)
        assert image_status["scene-vn-hall-side-day.webp"]["path"] in ("fetch-blob", "native-img"), image_status
        assert image_status["visitor-bun-light-mo-1-v1.webp"]["path"] in ("fetch-blob", "native-img"), image_status
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
        page.screenshot(path=str(out / f"{width}x{height}-mo-day.png"))
        before = int(page.locator("#daily-wood").inner_text().split(":")[-1].strip())
        for _ in range(5):
            click("wood")
        page.clock.run_for(1200)
        after = int(page.locator("#daily-wood").inner_text().split(":")[-1].strip())
        assert after - before == 5, "rapid taps must count once each"
        assert page.evaluate("window.__woodSounds") == 5, "rapid taps must sound once each"
        click("wood-auto")
        page.clock.run_for(2250)
        click("wood-auto")
        page.clock.run_for(500)
        auto_after = int(page.locator("#daily-wood").inner_text().split(":")[-1].strip())
        assert auto_after - after == 2, "auto wood must tap once per second"
        assert page.evaluate("window.__woodSounds") == 7, "auto taps must sound on landing"
        assert not page.evaluate("document.documentElement.scrollHeight>innerHeight||document.documentElement.scrollWidth>innerWidth")

        click("home")
        settled("home")
        click("sit")
        settled("sit")
        page.evaluate(
            """async src => {
              const mod = await import(new URL(src, location.href));
              window.__breathPatterns = [];
              mod.audio.breathing = pattern => { window.__breathPatterns.push(pattern); };
            }""",
            module_url,
        )
        click("sit-start")
        assert page.evaluate("window.__breathPatterns.at(-1)") == "4-6"
        assert page.locator("#stage-note").inner_text() == "Hít vào…"
        page.clock.run_for(4100)
        assert page.locator("#stage-note").inner_text() == "Thở ra…"
        for pattern in ("4-4", "5-7"):
            page.locator(f'[data-breath="{pattern}"]').click()
            assert page.evaluate("window.__breathPatterns.at(-1)") == pattern
            assert page.locator(f'[data-breath="{pattern}"]').get_attribute("aria-pressed") == "true"
        page.screenshot(path=str(out / f"{width}x{height}-sit-5-7-day.png"))
        click("breath-toggle")
        assert page.locator("#stage-note").inner_text() == ""
        assert not page.evaluate("document.documentElement.scrollHeight>innerHeight||document.documentElement.scrollWidth>innerWidth")
        assert page.locator("#controls").evaluate("e=>e.getBoundingClientRect().bottom<=innerHeight+.5")
        click("breath-toggle")
        click("pause")
        assert page.locator("#stage-note").inner_text() == ""
        click("pause")
        assert page.locator("#stage-note").inner_text() == "Hít vào…"
        click("finish")
        page.clock.run_for(1900)
        assert page.locator('[data-action="share"]').count() == 0, "breathing must fade before the completion bell"
        page.clock.run_for(200)
        assert page.locator('[data-action="share"]').is_visible()
        click("home")
        settled("home")
        click("beads")
        settled("beads")
        click("bead")
        page.clock.run_for(300)
        assert page.locator("#bead-count").inner_text().startswith("1 / 108")
        click("home")
        settled("home")
        if page.locator('[data-action="leave"]:visible').count() == 0:
            click("more")
        click("leave")
        settled("leave")
        assert page.locator('[data-action="reenter"]').is_visible()
        results.append({
            "size": [width, height],
            "rapidWood": 5,
            "autoWood": 2,
            "breathPatterns": ["4-6", "4-4", "5-7"],
            "noOverflow": True,
        })
        context.close()

    context = browser.new_context(viewport={"width": 375, "height": 548})
    page = context.new_page()
    page.emulate_media(reduced_motion="reduce")
    page.add_init_script("localStorage.setItem('ct-muted','true');localStorage.setItem('ct-analytics','no');localStorage.setItem('ct-visitor',JSON.stringify('bun-light'))")
    page.clock.install(time=datetime.fromisoformat("2026-11-06T10:00:00+07:00"))
    page.goto(base)
    if page.locator("#ga-choice:visible").count():
        page.locator("#ga-choice").evaluate("element=>element.hidden=true")
    for action, view in (("enter", "choose"), ("continue", "home"), ("sit", "sit")):
        page.locator(f'[data-action="{action}"]:visible').first.click()
        page.wait_for_function("view=>document.body.dataset.view===view&&document.querySelector('#app').getAttribute('aria-busy')==='false'", arg=view)
        page.evaluate("document.getAnimations().filter(animation=>animation.effect.getTiming().iterations!==Infinity).forEach(animation=>animation.finish())")
    page.locator('[data-action="sit-start"]').click()
    first = page.locator("#scene").evaluate("canvas=>canvas.toDataURL()")
    page.clock.run_for(2000)
    second = page.locator("#scene").evaluate("canvas=>canvas.toDataURL()")
    assert first == second, "reduced motion must keep the visitor still"
    assert page.locator("#stage-note").inner_text() == "Hít vào…", "text guidance remains available"
    context.close()
    browser.close()

(out / "results.json").write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding="utf-8")
print(json.dumps({"passed": True, "results": results}, ensure_ascii=False))
