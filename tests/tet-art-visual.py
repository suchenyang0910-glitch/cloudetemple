from datetime import datetime, timezone
from pathlib import Path
from playwright.sync_api import sync_playwright
import subprocess, time

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "screenshots" / "tet-art-staging"
OUT.mkdir(parents=True, exist_ok=True)
PORT = 8902
BASE = f"http://localhost:{PORT}"
DATES = ["2027-01-30", "2027-02-05", "2027-02-06", "2027-02-20"]

server = subprocess.Popen(["python", "-m", "http.server", str(PORT), "-d", str(ROOT / "dist")], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

def enter(page, date):
    page.goto(f"{BASE}/?festival-date={date}")
    page.evaluate("localStorage.clear();localStorage.setItem('ct-analytics','no');localStorage.setItem('ct-morning-seen','true');localStorage.setItem('ct-visitor','bun-light')")
    page.reload()
    page.locator("[data-action=enter]").click()
    page.locator("[data-action=continue]").click()
    page.locator("[data-action=incense]").wait_for()
    page.locator("#ga-choice").evaluate("el=>el.hidden=true")
    page.wait_for_timeout(400)

def visible_art(page):
    return page.evaluate("""()=>[...document.querySelectorAll('#festival-layer>*')].filter(e=>getComputedStyle(e).display!=='none').map(e=>({className:e.className,animation:getComputedStyle(e).animationName,background:getComputedStyle(e).backgroundImage,rect:e.getBoundingClientRect()}))""")

try:
    time.sleep(.4)
    with sync_playwright() as p:
        browser = p.chromium.launch()
        for date in DATES:
            context = browser.new_context(viewport={"width": 393, "height": 659}, timezone_id="Asia/Bangkok")
            page = context.new_page()
            page.clock.set_fixed_time(datetime(2026, 11, 5, 5, tzinfo=timezone.utc))
            enter(page, date)
            assert page.locator("body").get_attribute("data-period") == "day"
            assert page.locator("body").get_attribute("data-festival")
            assert page.locator("#festival-layer").evaluate("e=>getComputedStyle(e).pointerEvents") == "none"
            assert int(page.locator("#festival-layer").evaluate("e=>getComputedStyle(e).zIndex")) < int(page.locator("#controls").evaluate("e=>getComputedStyle(e).zIndex"))
            art = visible_art(page)
            assert all(item["rect"]["width"] > 0 and item["rect"]["height"] > 0 for item in art), art
            page.screenshot(path=OUT / f"{date}-hall-front-day.png")

            page.locator("[data-action=incense]").click()
            page.locator("[data-action=light]").wait_for()
            page.wait_for_timeout(400)
            page.screenshot(path=OUT / f"{date}-hall-side-day.png")

            page.locator("[data-action=home]").click()
            page.locator("[data-action=sit]").wait_for()
            page.locator("[data-action=sit]").click()
            page.locator("[data-action=sit-start]").wait_for()
            page.wait_for_timeout(400)
            assert page.locator(".fes-moon").evaluate("e=>getComputedStyle(e).display") == "none"
            page.screenshot(path=OUT / f"{date}-courtyard-day.png")
            context.close()

        context = browser.new_context(viewport={"width": 393, "height": 659}, timezone_id="Asia/Bangkok")
        page = context.new_page()
        page.clock.set_fixed_time(datetime(2026, 11, 5, 15, tzinfo=timezone.utc))
        enter(page, "2027-02-20")
        page.locator("[data-action=sit]").click()
        page.locator("[data-action=sit-start]").wait_for()
        page.wait_for_timeout(400)
        assert page.locator("body").get_attribute("data-period") == "night"
        assert page.locator(".fes-moon").evaluate("e=>getComputedStyle(e).display") == "block"
        moon = page.locator(".fes-moon").bounding_box()
        assert moon and moon["width"] > 0 and moon["height"] > 0
        page.screenshot(path=OUT / "2027-02-20-courtyard-night.png")
        page.locator("[data-action=home]").click()
        page.locator("[data-action=beads]").wait_for()
        page.locator("[data-action=beads]").click()
        page.locator(".beads-area").wait_for()
        assert page.locator(".fes-moon").evaluate("e=>getComputedStyle(e).display") == "none"
        context.close()

        context = browser.new_context(viewport={"width": 393, "height": 659}, timezone_id="Asia/Bangkok", reduced_motion="reduce")
        page = context.new_page()
        page.clock.set_fixed_time(datetime(2026, 11, 5, 5, tzinfo=timezone.utc))
        enter(page, "2027-02-06")
        art = visible_art(page)
        assert art and all(item["animation"] == "none" for item in art), art
        flowers = page.locator(".fes-fl")
        mai = [flowers.nth(i).evaluate("e=>getComputedStyle(e).backgroundImage") for i in range(2)]
        assert mai[0] == mai[1] and "flower-mai.svg" in mai[0]
        page.locator("#flower-toggle-btn").evaluate("e=>e.click()")
        dao = [flowers.nth(i).evaluate("e=>getComputedStyle(e).backgroundImage") for i in range(2)]
        assert dao[0] == dao[1] and "flower-dao.svg" in dao[0]
        page.screenshot(path=OUT / "2027-02-06-hall-front-hoa-dao-reduced.png")
        context.close()
        browser.close()
    print({"passed": True, "screenshots": len(list(OUT.glob("*.png"))), "dates": DATES, "size": "393x659"})
finally:
    server.terminate()
    server.wait(timeout=5)
