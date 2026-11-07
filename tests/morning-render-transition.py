from __future__ import annotations

import subprocess
import time
from pathlib import Path

from playwright.sync_api import sync_playwright


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "screenshots" / "morning-render-transition"
PORT = 8896


def settled(page, view):
    page.wait_for_function(
        "view=>document.body.dataset.view===view&&document.querySelector('#app').getAttribute('aria-busy')==='false'",
        arg=view,
    )
    page.locator("#loading").wait_for(state="hidden")
    page.clock.run_for(500)
    page.evaluate("document.getAnimations().filter(a=>a.effect.getTiming().iterations!==Infinity).forEach(a=>a.finish())")
    page.clock.run_for(120)
    assert page.locator("#scene-old").count() == 0


OUT.mkdir(parents=True, exist_ok=True)
server = subprocess.Popen(
    ["python", "-m", "http.server", str(PORT), "-d", str(ROOT / "dist")],
    stdout=subprocess.DEVNULL,
    stderr=subprocess.DEVNULL,
)
try:
    time.sleep(.4)
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 393, "height": 659}, device_scale_factor=1)
        page.clock.install()
        page.goto(f"http://127.0.0.1:{PORT}/")
        page.evaluate("localStorage.setItem('ct-analytics','no');localStorage.setItem('ct-muted','true');localStorage.removeItem('ct-morning-seen')")
        page.reload()
        page.locator("#ga-choice").evaluate("element=>element.hidden=true")
        page.locator("[data-action=enter]").click()
        settled(page, "choose")
        page.locator("[data-action=continue]").click()
        settled(page, "morning")
        assert page.locator("#scene").get_attribute("data-pose") == "stand"
        page.screenshot(path=OUT / "01-bell-393x659.png")

        page.locator("[data-action=morning-start]").click()
        page.clock.run_for(3400)
        settled(page, "incense")
        page.screenshot(path=OUT / "02-incense-393x659.png")

        page.locator("[data-action=morning-skip-step]").click()
        settled(page, "bow")
        page.screenshot(path=OUT / "03-bow-393x659.png")

        page.locator("[data-action=auto]").click()
        page.clock.run_for(12_000)
        settled(page, "sit")
        assert page.locator("#scene").get_attribute("data-pose") == "sit"
        assert page.locator("#heading").inner_text() == "Ngồi yên"
        page.screenshot(path=OUT / "04-sit-after-auto-bow-393x659.png")
        browser.close()
finally:
    server.terminate()
    server.wait(timeout=5)

print({"passed": True, "screenshots": 4, "viewport": "393x659"})
