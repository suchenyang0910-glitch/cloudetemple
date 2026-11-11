import json
import subprocess
import time
from pathlib import Path

from playwright.sync_api import sync_playwright


ROOT = Path(__file__).resolve().parents[1]
BASE = "http://127.0.0.1:8904"
server = subprocess.Popen(["python", "-m", "http.server", "8904", "-d", str(ROOT / "dist")], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(.5)
results = []

try:
    with sync_playwright() as p:
        browser = p.chromium.launch()
        for width, height in ((390, 844), (360, 640)):
            context = browser.new_context(viewport={"width": width, "height": height})
            context.add_init_script("""()=>{localStorage.setItem('ct-muted','true');localStorage.setItem('ct-analytics','no');localStorage.setItem('ct-sound-hint-seen',JSON.stringify(true));localStorage.setItem('ct-morning-seen',JSON.stringify(true));localStorage.setItem('ct-visitor',JSON.stringify('bun-light'))}""")
            page = context.new_page()
            page.set_default_timeout(10000)
            errors = []
            page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
            page.goto(BASE)
            page.locator("#boot").wait_for(state="detached")
            page.locator('[data-action="enter"]').click()
            page.locator('[data-action="continue"]').click()
            page.wait_for_function("document.querySelector('[data-action=incense]')||document.querySelector('[data-action=morning-start]')")
            if page.locator('[data-action="morning-start"]').is_visible():
                page.locator('[data-action="morning-skip"]').click()
            page.locator('[data-action="incense"]').wait_for()
            page.locator("#ga-choice").evaluate("e=>{e.hidden=true;e.style.pointerEvents='none'}")
            assert page.locator(".action-nav button").count() == 5
            assert page.locator("#leave-top").is_visible()
            panels = {}
            for action in ("incense", "bow", "sit", "mo", "beads"):
                print(f"checking {width}x{height} {action}", flush=True)
                page.locator(f'[data-action="{action}"]:visible').click()
                page.locator("#loading").wait_for(state="hidden")
                page.wait_for_timeout(200)
                panels[action] = round(page.locator("#controls").bounding_box()["height"])
                if action == "bow":
                    page.locator('[data-action="bow-once"]').click()
                    page.wait_for_function("document.querySelectorAll('[data-target]').length===0")
                    assert page.locator("[data-target]").count() == 0
                    assert str(page.locator(".bow-target-summary").text_content()).strip().endswith("3")
                elif action == "sit":
                    timer_y = page.locator("#timer").bounding_box()["y"]
                    page.locator('[data-action="sit-start"]').click()
                    page.wait_for_timeout(100)
                    assert abs(page.locator("#timer").bounding_box()["y"] - timer_y) <= 1
                    assert page.locator('#controls [data-action="wood"]').count() == 0
                elif action == "beads":
                    guide = page.locator(".bead-guide").bounding_box()
                    controls = page.locator("#controls").bounding_box()
                    assert guide["y"] >= controls["y"] and guide["y"] + guide["height"] <= controls["y"] + controls["height"]
                page.locator('[data-action="home"]:visible').click()
            assert max(panels.values()) - min(panels.values()) <= 8, panels
            assert not [e for e in errors if "Failed to load resource" not in e], errors
            results.append({"size": f"{width}x{height}", "panels": panels})
            context.close()
        browser.close()
finally:
    server.terminate()
    server.wait(timeout=5)

print(json.dumps({"passed": True, "results": results}, ensure_ascii=False))
