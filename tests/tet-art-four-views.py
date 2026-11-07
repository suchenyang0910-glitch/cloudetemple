from datetime import datetime, timezone
from pathlib import Path
from playwright.sync_api import sync_playwright
import os, subprocess, time

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / os.environ.get("CT_SCREENSHOT_DIR", "screenshots/tet-art-staging-416187a")
OUT.mkdir(parents=True, exist_ok=True)
PORT = 8903
BASE = os.environ.get("CT_BASE", f"http://127.0.0.1:{PORT}")
DATES = ["2027-01-30", "2027-02-05", "2027-02-06", "2027-02-20"]

server = None if os.environ.get("CT_BASE") else subprocess.Popen(
    ["python", "-m", "http.server", str(PORT), "-d", str(ROOT / "dist")], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)


def browser_credentials():
    path = os.environ.get("CT_BASIC_AUTH_FILE")
    if not path:
        return None
    raw = Path(path).read_text(encoding="utf-8").strip()
    if ":" in raw:
        username, password = raw.split(":", 1)
        return {"username": username, "password": password}
    return {"username": "reviewer", "password": raw}


def enter(page, date):
    page.goto(f"{BASE}/?festival-date={date}")
    page.evaluate("localStorage.clear();localStorage.setItem('ct-analytics','no');localStorage.setItem('ct-morning-seen','true');localStorage.setItem('ct-visitor','bun-light')")
    page.reload()
    page.locator("[data-action=enter]").click()
    page.locator("[data-action=continue]").click()
    page.locator("[data-action=incense]").wait_for()
    page.locator("#ga-choice").evaluate("el=>el.hidden=true")
    page.wait_for_timeout(700)


def open_view(page, action, ready):
    if page.locator("body").get_attribute("data-view") != "home":
        page.locator("[data-action=home]").click()
        page.locator("[data-action=incense]").wait_for()
    page.locator(f"[data-action={action}]").click()
    page.locator(ready).wait_for()
    page.wait_for_timeout(700)


def visible_art(page):
    return page.evaluate("""()=>[...document.querySelectorAll('#festival-layer>*')]
      .filter(e=>getComputedStyle(e).display!=='none')
      .map(e=>({className:e.className,side:e.dataset.side||'',animation:getComputedStyle(e).animationName,
        background:getComputedStyle(e).backgroundImage,rect:e.getBoundingClientRect()}))""")


def assert_controls_clear(page):
    stacking = page.evaluate("""()=>({
      art:Number(getComputedStyle(document.querySelector('#festival-layer')).zIndex),
      controls:Number(getComputedStyle(document.querySelector('#controls')).zIndex),
      pointer:getComputedStyle(document.querySelector('#festival-layer')).pointerEvents})""")
    assert stacking["art"] < stacking["controls"] and stacking["pointer"] == "none", stacking


def assert_hall_lanterns(page):
    lanterns = page.locator("#festival-layer .fes-l:visible")
    boxes = [lanterns.nth(i).bounding_box() for i in range(lanterns.count())]
    assert all(box and box["x"] >= 0 and box["x"] + box["width"] <= 393 for box in boxes), boxes
    if len(boxes) > 1:
        assert len({round(box["x"]) for box in boxes}) > 1, boxes


try:
    if server:
        time.sleep(.4)
    with sync_playwright() as p:
        browser = p.chromium.launch()
        for date in DATES:
            context = browser.new_context(viewport={"width": 393, "height": 659}, timezone_id="Asia/Bangkok", http_credentials=browser_credentials())
            page = context.new_page()
            page.clock.set_fixed_time(datetime(2026, 11, 5, 5, tzinfo=timezone.utc))
            enter(page, date)
            assert page.locator("body").get_attribute("data-period") == "day"
            page.screenshot(path=OUT / f"{date}-hall-front-day.png")
            assert_controls_clear(page)

            open_view(page, "incense", "[data-action=light]")
            page.screenshot(path=OUT / f"{date}-hall-side-incense-day.png")
            assert_controls_clear(page)
            assert_hall_lanterns(page)

            open_view(page, "mo", "#daily-wood")
            art = visible_art(page)
            assert all(item["className"] != "fes-moon" for item in art)
            assert all(not (item["className"] == "fes-fl" and item["side"] == "l") for item in art)
            assert all(not (item["className"] == "fes-pot" and item["side"] == "l") for item in art)
            page.screenshot(path=OUT / f"{date}-hall-side-mo-day.png")
            assert_controls_clear(page)
            assert_hall_lanterns(page)

            open_view(page, "sit", "[data-action=sit-start]")
            assert page.locator(".fes-moon").evaluate("e=>getComputedStyle(e).display") == "none"
            page.screenshot(path=OUT / f"{date}-courtyard-sit-day.png")
            assert_controls_clear(page)
            context.close()

        context = browser.new_context(viewport={"width": 393, "height": 659}, timezone_id="Asia/Bangkok", http_credentials=browser_credentials())
        page = context.new_page()
        page.clock.set_fixed_time(datetime(2026, 11, 5, 15, tzinfo=timezone.utc))
        enter(page, "2027-02-20")
        open_view(page, "sit", "[data-action=sit-start]")
        assert page.locator("body").get_attribute("data-period") == "night"
        assert page.locator(".fes-moon").evaluate("e=>getComputedStyle(e).display") == "block"
        moon = page.locator(".fes-moon").bounding_box()
        assert moon and 659 * .15 <= moon["y"] <= 659 * .25 + 1, moon
        assert 393 * .10 <= 393 - moon["x"] - moon["width"] <= 393 * .20 + 1, moon
        blockers = [page.locator(selector) for selector in (".scene-heading", "#sound-toggle", "#sound-hint")]
        for blocker in blockers:
            box = blocker.bounding_box() if blocker.is_visible() else None
            assert not box or not (moon["x"] < box["x"] + box["width"] and moon["x"] + moon["width"] > box["x"] and moon["y"] < box["y"] + box["height"] and moon["y"] + moon["height"] > box["y"]), (moon, box)
        page.screenshot(path=OUT / "2027-02-20-courtyard-sit-night.png")
        open_view(page, "mo", "#daily-wood")
        assert page.locator(".fes-moon").evaluate("e=>getComputedStyle(e).display") == "none"
        context.close()

        context = browser.new_context(viewport={"width": 393, "height": 659}, timezone_id="Asia/Bangkok", reduced_motion="reduce", http_credentials=browser_credentials())
        page = context.new_page()
        page.clock.set_fixed_time(datetime(2026, 11, 5, 5, tzinfo=timezone.utc))
        enter(page, "2027-02-06")
        art = visible_art(page)
        assert art and all(item["animation"] == "none" for item in art), art
        flowers = page.locator(".fes-fl")
        pots = page.locator(".fes-pot")
        for selector, expected in ((flowers, "flower-mai.svg"), (pots, "pot-mai.svg")):
            images = [selector.nth(i).evaluate("e=>getComputedStyle(e).backgroundImage") for i in range(2)]
            assert images[0] == images[1] and expected in images[0], images
        page.locator("#flower-toggle-btn").evaluate("e=>e.click()")
        for selector, expected in ((flowers, "flower-dao.svg"), (pots, "pot-dao.svg")):
            images = [selector.nth(i).evaluate("e=>getComputedStyle(e).backgroundImage") for i in range(2)]
            assert images[0] == images[1] and expected in images[0], images
        context.close()
        browser.close()
    print({"passed": True, "screenshots": len(list(OUT.glob("*.png"))), "dates": DATES, "size": "393x659"})
finally:
    if server:
        server.terminate()
        server.wait(timeout=5)
