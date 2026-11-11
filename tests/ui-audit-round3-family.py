from pathlib import Path
from urllib.parse import urlparse
import json
import os

from playwright.sync_api import sync_playwright


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "screenshots" / "ui-audit-round3-family"
OUT.mkdir(parents=True, exist_ok=True)
BASE = os.environ.get("BASE_URL", "http://127.0.0.1:8793")
SIZES = [(390, 844), (360, 640)]


def tablet():
    return {
        "id": "33333333-3333-4333-8333-333333333333",
        "honorific": "Bà ngoại",
        "full_name": "Nguyễn Hoa",
        "death_lunar_day": 12,
        "death_lunar_month": 3,
        "role": "owner",
    }


def metrics(page):
    return page.evaluate(
        """() => {
          const visible = (el) => el.getClientRects().length > 0;
          const root = document.scrollingElement;
          const controls = [...document.querySelectorAll('button,a')]
            .filter(visible).map(el => {
              const r = el.getBoundingClientRect();
              return {tag: el.tagName, width: r.width, height: r.height};
            });
          const fonts = [...document.querySelectorAll('body *')].filter(visible)
            .map(el => parseFloat(getComputedStyle(el).fontSize));
          return {
            scroll: [root.scrollWidth, root.scrollHeight, innerWidth, innerHeight],
            innerScroll: [...document.querySelectorAll('.login,.list')].filter(visible)
              .map(el => [el.scrollWidth, el.clientWidth, el.scrollHeight, el.clientHeight]),
            minFont: Math.min(...fonts),
            minControlHeight: Math.min(...controls.map(x => x.height)),
            minControlWidth: Math.min(...controls.map(x => x.width)),
          };
        }"""
    )


def assert_page(page, name, errors):
    data = metrics(page)
    assert data["scroll"] == [page.viewport_size["width"], page.viewport_size["height"], page.viewport_size["width"], page.viewport_size["height"]], (name, data)
    assert all(width <= client_width + 1 and height <= client_height + 1 for width, client_width, height, client_height in data["innerScroll"]), (name, data)
    assert data["minFont"] >= 13, (name, data)
    assert data["minControlHeight"] >= 44, (name, data)
    assert not errors, (name, errors)
    return data


with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    report = {"mobile": [], "desktop": []}
    for width, height in SIZES:
        state = {"authenticated": False, "tablets": []}
        page = browser.new_page(viewport={"width": width, "height": height})
        errors = []
        page.on("pageerror", lambda error: errors.append(str(error)))

        def family_api(route):
            path = urlparse(route.request.url).path
            body = {"ok": True}
            if path.endswith("/session"):
                body = {"ok": True, "authenticated": state["authenticated"], "csrf": "csrf-test" if state["authenticated"] else ""}
            elif path.endswith("/tablets"):
                body = {"ok": True, "tablets": state["tablets"]}
            elif path.endswith("/auth/email/start"):
                body = {"ok": True}
            elif path.endswith("/auth/email/verify"):
                state["authenticated"] = True
                body = {"ok": True, "csrf": "csrf-test", "tablets": state["tablets"]}
            else:
                body = {"ok": False, "error": "not_found"}
            route.fulfill(status=200 if body.get("ok") else 404, content_type="application/json", body=json.dumps(body))

        page.route("**/api/family/**", family_api)
        base = BASE + "/family.html"

        page.goto(base)
        page.locator("#email-login").wait_for()
        page.screenshot(path=OUT / f"{width}x{height}-01-unauthenticated.png")
        report["mobile"].append({"state": "unauthenticated", "size": [width, height], **assert_page(page, "unauthenticated", errors)})

        page.locator(".google").focus()
        page.screenshot(path=OUT / f"{width}x{height}-02-google.png")
        report["mobile"].append({"state": "google", "size": [width, height], **assert_page(page, "google", errors)})

        page.locator("#email-login input").fill("member@example.test")
        page.locator("#email-login").evaluate("form => form.requestSubmit()")
        page.locator("#code-form").wait_for(state="visible")
        page.screenshot(path=OUT / f"{width}x{height}-03-code.png")
        report["mobile"].append({"state": "code", "size": [width, height], **assert_page(page, "code", errors)})

        state.update(authenticated=True, tablets=[])
        page.goto(base)
        page.locator("#new").wait_for()
        page.screenshot(path=OUT / f"{width}x{height}-04-logged-empty.png")
        report["mobile"].append({"state": "logged-empty", "size": [width, height], **assert_page(page, "logged-empty", errors)})

        state["tablets"] = [tablet()]
        page.goto(base)
        page.locator(".card").wait_for()
        page.screenshot(path=OUT / f"{width}x{height}-05-logged-tablet.png")
        report["mobile"].append({"state": "logged-tablet", "size": [width, height], **assert_page(page, "logged-tablet", errors)})

        state.update(authenticated=False, tablets=[])
        page.goto(base + "?telegram=1")
        page.locator("#email-login").wait_for()
        assert page.locator(".google").count() == 0
        assert page.get_by_text("Mở trong Telegram").count() == 0
        page.screenshot(path=OUT / f"{width}x{height}-06-telegram.png")
        report["mobile"].append({"state": "telegram", "size": [width, height], **assert_page(page, "telegram", errors)})
        page.close()

    page = browser.new_page(viewport={"width": 1440, "height": 900})
    errors = []
    page.on("pageerror", lambda error: errors.append(str(error)))
    page.route("**/api/family/status", lambda route: route.fulfill(status=200, content_type="application/json", body='{"enabled":false}'))
    page.goto(BASE + "/")
    page.locator("#app").wait_for()
    page.screenshot(path=OUT / "1440x900-main-entry.png")
    report["desktop"].append({"page": "main", "appWidth": page.locator("#app").bounding_box()["width"]})

    page.route("**/api/family/**", lambda route: route.fulfill(status=200, content_type="application/json", body='{"ok":true,"authenticated":false,"csrf":""}'))
    page.goto(BASE + "/family.html")
    page.locator("#email-login").wait_for()
    page.screenshot(path=OUT / "1440x900-family.png")
    report["desktop"].append({"page": "family", "appWidth": page.locator("#family-app").bounding_box()["width"]})

    page.goto(BASE + "/quyen-rieng-tu.html")
    page.locator(".legal-page").wait_for()
    page.screenshot(path=OUT / "1440x900-legal.png", full_page=True)
    report["desktop"].append({"page": "legal", "appWidth": page.locator(".legal-page").bounding_box()["width"]})
    assert not errors, errors
    page.close()
    browser.close()

(OUT / "metrics.json").write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
print(json.dumps({"passed": True, "screenshots": len(list(OUT.glob("*.png"))), **report}, ensure_ascii=False))
