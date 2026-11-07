from pathlib import Path
import os
from playwright.sync_api import sync_playwright

auth_file = Path(os.environ["STAGING_AUTH_FILE"])
raw = auth_file.read_text(encoding="utf-8").strip()
username, password = raw.split(":", 1) if ":" in raw else ("reviewer", raw)
out = Path(__file__).resolve().parents[1] / "screenshots" / "pilot-presale-20261107"

with sync_playwright() as playwright:
    browser = playwright.chromium.launch(headless=True)
    context = browser.new_context(viewport={"width": 393, "height": 659}, http_credentials={"username": username, "password": password})
    page = context.new_page()
    errors = []
    page.on("pageerror", lambda error: errors.append(str(error)))
    page.goto("https://staging.chuamay.org/family.html", wait_until="networkidle")
    assert page.locator("#email-login").is_visible()
    page.screenshot(path=str(out / "staging-393x659-family-login.png"))
    page.goto("https://staging.chuamay.org/calendar-presale.html", wait_until="networkidle")
    page.get_by_text("Sắp mở", exact=False).wait_for()
    assert page.locator("#order").is_hidden()
    page.screenshot(path=str(out / "staging-393x659-presale-closed.png"), full_page=True)
    assert not errors, errors
    browser.close()

print({"passed": True, "pages": ["family-login", "presale-closed"], "secretsPrinted": False})
