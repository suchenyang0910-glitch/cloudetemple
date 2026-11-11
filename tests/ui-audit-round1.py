import os
import subprocess
import time
from pathlib import Path

from playwright.sync_api import sync_playwright


ROOT = Path(__file__).resolve().parents[1]
BASE = os.environ.get("CT_BASE", "http://127.0.0.1:8897").rstrip("/")
OUT = ROOT / "screenshots" / "ui-audit-round1" / os.environ.get("CT_EVIDENCE_NAME", "local")
OUT.mkdir(parents=True, exist_ok=True)
server = None

if "CT_BASE" not in os.environ:
    server = subprocess.Popen(
        ["python", "-m", "http.server", "8897", "-d", str(ROOT / "dist")],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    time.sleep(0.4)

try:
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch()
        credentials = None
        if os.environ.get("CT_BASIC_USER") and os.environ.get("CT_BASIC_PASS"):
            credentials = {
                "username": os.environ["CT_BASIC_USER"],
                "password": os.environ["CT_BASIC_PASS"],
            }
        context = browser.new_context(
            viewport={"width": 390, "height": 844},
            device_scale_factor=1,
            http_credentials=credentials,
        )
        page = context.new_page()

        for slug, name in (
            ("gioi-thieu.html", "legal-about"),
            ("quyen-rieng-tu.html", "legal-privacy"),
            ("dieu-khoan.html", "legal-terms"),
        ):
            response = page.goto(f"{BASE}/{slug}")
            assert response and response.ok, (slug, response.status if response else None)
            body = page.locator("body").inner_text()
            assert "待越南母语者审核" not in body
            assert "Vietnamese copy pending native review" not in body
            page.screenshot(path=OUT / f"390x844-{name}.png")

        page.goto(f"{BASE}/")
        page.evaluate(
            "localStorage.clear();"
            "localStorage.setItem('ct-analytics',JSON.stringify('no'));"
            "localStorage.setItem('ct-morning-seen',JSON.stringify(true));"
        )
        page.reload()
        page.locator("[data-action=enter]").wait_for()
        page.locator("#sound-hint").wait_for(state="visible")
        page.locator("#boot").wait_for(state="detached")
        hint = page.evaluate(
            """()=>{const heading=document.querySelector('.scene-heading').getBoundingClientRect();
            const visible=['audio-status','sound-hint'].map(id=>document.getElementById(id))
              .filter(e=>e&&getComputedStyle(e).display!=='none'&&e.textContent.trim());
            return {count:visible.length,overlap:visible.some(e=>{const r=e.getBoundingClientRect();
              return r.left<heading.right&&r.right>heading.left&&r.top<heading.bottom&&r.bottom>heading.top;})};}"""
        )
        assert hint == {"count": 1, "overlap": False}, hint
        page.screenshot(path=OUT / "390x844-entry.png")
        page.wait_for_timeout(3200)
        assert page.locator("#sound-hint").is_hidden()

        page.locator("[data-action=enter]").click()
        page.locator("[data-action=continue]").click()
        page.locator("[data-action=incense]").wait_for()
        if page.locator("#ga-choice").count():
            page.locator("#ga-choice").evaluate("el=>el.hidden=true")
        page.locator("#sound-hint").wait_for(state="hidden", timeout=6000)
        for _ in range(60):
            if not page.locator("#audio-status").inner_text().strip():
                break
            page.wait_for_timeout(100)
        assert not page.locator("#audio-status").inner_text().strip()
        page.locator("[data-action=more]").click()
        assert "Thử nghiệm theo lời mời" in page.locator("#more-menu").inner_text()
        page.screenshot(path=OUT / "390x844-more-menu.png")
        page.locator("#memorial").click()
        assert "thử nghiệm theo lời mời" in page.locator("#modal").inner_text().lower()
        page.screenshot(path=OUT / "390x844-memorial-modal.png")

        context.close()
        browser.close()
    print({"passed": True, "base": BASE, "screenshots": len(list(OUT.glob("*.png")))})
finally:
    if server:
        server.terminate()
        server.wait(timeout=5)
