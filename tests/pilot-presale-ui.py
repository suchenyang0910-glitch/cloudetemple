from pathlib import Path
import json
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "screenshots" / "pilot-presale-20261107"
OUT.mkdir(parents=True, exist_ok=True)
BASE = "http://127.0.0.1:8788"

with sync_playwright() as playwright:
    browser = playwright.chromium.launch(headless=True)
    for width, height in [(375, 548), (393, 659)]:
        page = browser.new_page(viewport={"width": width, "height": height})
        errors = []
        page.on("pageerror", lambda error: errors.append(str(error)))

        def family_api(route):
            path = urlparse(route.request.url).path
            body = {"ok": True}
            if path.endswith("/session"):
                body = {"ok": True, "authenticated": True, "csrf": "csrf-test"}
            elif path.endswith("/tablets"):
                body = {"ok": True, "tablets": []}
            elif path.endswith("/consent") and route.request.method == "GET":
                body = {"ok": True, "accepted": False, "version": "pilot-2026-11-07-v2"}
            elif path.endswith("/consent"):
                body = {"ok": True, "consent": {"version": "pilot-2026-11-07-v2"}}
            elif path.endswith("/presale/config"):
                body = {"ok": True, "open": False}
            else:
                route.fulfill(status=404, content_type="application/json", body=json.dumps({"ok": False}))
                return
            route.fulfill(status=200, content_type="application/json", body=json.dumps(body))

        page.route("**/api/family/**", family_api)
        page.goto(BASE + "/family.html")
        page.locator("#new").click()
        page.locator(".consent").wait_for()
        consent_text = page.locator(".consent").inner_text()
        assert "v2" in page.locator(".review").inner_text()
        assert "chờ người bản ngữ" not in consent_text.lower()
        assert "公开上线前需律师确认" not in consent_text
        assert "leishen8806@gmail.com" in consent_text
        assert page.locator("#consent-continue").is_disabled()
        page.screenshot(path=str(OUT / f"{width}x{height}-consent.png"), full_page=True)
        page.locator("#consent-agree").check()
        page.locator("#consent-continue").click()
        page.locator("#tablet-form").wait_for()

        page.goto(BASE + "/calendar-presale.html")
        page.get_by_text("Sắp mở", exact=False).wait_for()
        assert page.locator("#order").is_hidden()
        assert page.locator("#interest").is_visible()
        page.screenshot(path=str(OUT / f"{width}x{height}-presale-closed.png"), full_page=True)
        assert page.evaluate("document.documentElement.scrollWidth <= innerWidth")
        assert not errors, errors
        page.close()
    browser.close()

print({"passed": True, "screenshots": len(list(OUT.glob("*.png"))), "productionEntry": "not added"})
