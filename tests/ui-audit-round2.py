import json
import os
import subprocess
import time
from pathlib import Path

from playwright.sync_api import sync_playwright


ROOT = Path(__file__).resolve().parents[1]
BASE = os.environ.get("CT_BASE", "http://127.0.0.1:8899").rstrip("/")
LOCAL_STATIC = "CT_BASE" not in os.environ
OUT = ROOT / "screenshots" / "ui-audit-round2" / os.environ.get("CT_EVIDENCE_NAME", "local")
OUT.mkdir(parents=True, exist_ok=True)
SIZES = ((390, 844), (360, 640))
server = None


def assert_layout(page, name, allow_document_scroll=False):
    metrics = page.evaluate(
        """()=>{
          const root=document.scrollingElement;
          const visible=e=>e.getClientRects().length&&getComputedStyle(e).visibility!=='hidden';
          const buttons=[...document.querySelectorAll('button,[role=button]')].filter(visible).map(e=>{
            const r=e.getBoundingClientRect();
            return {id:e.id,primary:e.classList.contains('primary'),font:parseFloat(getComputedStyle(e).fontSize),text:(e.textContent||e.getAttribute('aria-label')||'').trim(),x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:r.width,height:r.height,clipped:e.scrollWidth>e.clientWidth+1||e.scrollHeight>e.clientHeight+1};
          });
          const small=[...document.querySelectorAll('body *')].filter(e=>visible(e)&&!e.closest('.sr-only,[aria-hidden=true],svg')&&[...e.childNodes].some(n=>n.nodeType===Node.TEXT_NODE&&n.textContent.trim())).map(e=>({tag:e.tagName,cls:e.className||'',text:e.textContent.trim().slice(0,60),size:parseFloat(getComputedStyle(e).fontSize)})).filter(x=>x.size<13-.01);
          const type=[...document.querySelectorAll('body *')].filter(e=>visible(e)&&!e.closest('.sr-only,[aria-hidden=true],svg')&&[...e.childNodes].some(n=>n.nodeType===Node.TEXT_NODE&&n.textContent.trim())).map(e=>({tag:e.tagName,id:e.id,cls:typeof e.className==='string'?e.className:'',text:e.textContent.trim().slice(0,60),size:parseFloat(getComputedStyle(e).fontSize)}));
          const sizes=type.map(e=>e.size);
          return {scrollWidth:root.scrollWidth,scrollHeight:root.scrollHeight,width:innerWidth,height:innerHeight,buttons,small,sizes,type};
        }"""
    )
    assert metrics["scrollWidth"] <= metrics["width"] + 1, (name, metrics)
    if not allow_document_scroll:
        assert metrics["scrollHeight"] <= metrics["height"] + 1, (name, metrics)
    assert not metrics["small"], (name, metrics["small"])
    allowed = {13, 15, 17, 20, 24, 44}
    assert not [item for item in metrics["type"] if item["size"] not in allowed], (name, metrics["type"])
    bad = [
        b
        for b in metrics["buttons"]
        if b["width"] < 44
        or b["height"] < 44
        or b["x"] < -1
        or b["right"] > metrics["width"] + 1
        or (not allow_document_scroll and (b["y"] < -1 or b["bottom"] > metrics["height"] + 1))
        or (b["clipped"] and b["id"] != "bead-control")
        or (b["primary"] and b["font"] != 17)
    ]
    assert not bad, (name, bad)
    return metrics


def settle(page):
    page.locator("#loading").wait_for(state="hidden")
    page.locator("#boot").wait_for(state="detached")
    page.wait_for_timeout(450)


def click(page, action):
    page.locator(f'[data-action="{action}"]:visible').first.click()


def prepare_context(browser, width, height, morning_seen=True):
    credentials = None
    if os.environ.get("CT_BASIC_USER") and os.environ.get("CT_BASIC_PASS"):
        credentials = {"username": os.environ["CT_BASIC_USER"], "password": os.environ["CT_BASIC_PASS"]}
    context = browser.new_context(
        viewport={"width": width, "height": height},
        timezone_id="Asia/Ho_Chi_Minh",
        http_credentials=credentials,
    )
    context.add_init_script(
        f"""()=>{{
          const seen={str(morning_seen).lower()};
          localStorage.setItem('ct-muted','true');
          localStorage.setItem('ct-analytics','no');
          localStorage.setItem('ct-sound-hint-seen',JSON.stringify(true));
          localStorage.setItem('ct-visitor',JSON.stringify('bun-light'));
          if(seen)localStorage.setItem('ct-morning-seen',JSON.stringify(true));
          else localStorage.removeItem('ct-morning-seen');
        }}"""
    )
    return context


if "CT_BASE" not in os.environ:
    server = subprocess.Popen(
        ["python", "-m", "http.server", "8899", "-d", str(ROOT / "dist")],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    time.sleep(0.5)

results = []
try:
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch()
        for width, height in SIZES:
            context = prepare_context(browser, width, height)
            page = context.new_page()
            errors = []
            page.on("console", lambda message: errors.append(message.text) if message.type == "error" else None)

            def shot(name, allow_document_scroll=False):
                metrics = assert_layout(page, name, allow_document_scroll)
                if width == 390:
                    page.screenshot(path=OUT / f"390x844-{name}.png")
                results.append({"size": f"{width}x{height}", "page": name, **{k: metrics[k] for k in ("scrollWidth", "scrollHeight", "width", "height")}})

            page.goto(f"{BASE}/")
            page.locator('[data-action="enter"]').wait_for()
            settle(page)
            shot("entry")
            click(page, "enter")
            page.locator('[data-action="continue"]').wait_for()
            shot("choose")
            click(page, "continue")
            page.wait_for_function("document.querySelector('[data-action=incense]')||document.querySelector('[data-action=morning-start]')")
            if page.locator('[data-action="morning-start"]').is_visible():
                click(page, "morning-skip")
            page.locator('[data-action="incense"]').wait_for()
            settle(page)
            page.locator("#ga-choice").evaluate("el=>{el.hidden=true;el.style.pointerEvents='none'}")
            shot("home")

            click(page, "more")
            shot("more-menu")
            page.locator("#memorial").click()
            shot("memorial-modal")
            page.locator("#close-modal").click()
            if page.locator("#more-menu").evaluate("e=>e.open"):
                page.locator("#more-menu").evaluate("e=>e.close()")

            for action in ("incense", "bow", "mo", "sit", "beads"):
                click(page, action)
                settle(page)
                shot(action)
                if action == "sit":
                    click(page, "sit-options")
                    shot("sit-options")
                click(page, "home")
                settle(page)

            click(page, "leave")
            settle(page)
            shot("leave")
            unexpected = [error for error in errors if not (LOCAL_STATIC and "Failed to load resource" in error)]
            assert not unexpected, unexpected
            context.close()

            morning_context = prepare_context(browser, width, height, morning_seen=False)
            morning_page = morning_context.new_page()
            morning_errors = []
            morning_page.on("console", lambda message: morning_errors.append(message.text) if message.type == "error" else None)
            morning_page.goto(f"{BASE}/")
            morning_page.locator('[data-action="enter"]').click()
            morning_page.locator('[data-action="continue"]').click()
            morning_page.locator('[data-action="morning-start"]').wait_for()
            morning_page.locator("#ga-choice").evaluate("el=>{el.hidden=true;el.style.pointerEvents='none'}")
            metrics = assert_layout(morning_page, "morning")
            results.append({"size": f"{width}x{height}", "page": "morning", **{k: metrics[k] for k in ("scrollWidth", "scrollHeight", "width", "height")}})
            if width == 390:
                morning_page.screenshot(path=OUT / "390x844-morning.png")
            unexpected = [error for error in morning_errors if not (LOCAL_STATIC and "Failed to load resource" in error)]
            assert not unexpected, unexpected
            morning_context.close()

            legal_context = prepare_context(browser, width, height)
            legal_page = legal_context.new_page()
            legal_errors = []
            legal_page.on("console", lambda message: legal_errors.append(message.text) if message.type == "error" else None)
            for slug, name in (
                ("gioi-thieu.html", "legal-about"),
                ("quyen-rieng-tu.html", "legal-privacy"),
                ("dieu-khoan.html", "legal-terms"),
            ):
                response = legal_page.goto(f"{BASE}/{slug}")
                assert response and response.ok, (slug, response.status if response else None)
                shot_page = legal_page
                metrics = assert_layout(shot_page, name, allow_document_scroll=True)
                if width == 390:
                    shot_page.screenshot(path=OUT / f"390x844-{name}.png")
                results.append({"size": f"{width}x{height}", "page": name, "documentScroll": True, **{k: metrics[k] for k in ("scrollWidth", "scrollHeight", "width", "height")}})
            unexpected = [error for error in legal_errors if not (LOCAL_STATIC and "Failed to load resource" in error)]
            assert not unexpected, unexpected
            legal_context.close()
        browser.close()
finally:
    if server:
        server.terminate()
        server.wait(timeout=5)

(OUT / "results.json").write_text(json.dumps({"passed": True, "base": BASE, "results": results}, ensure_ascii=False, indent=2), encoding="utf-8")
print(json.dumps({"passed": True, "base": BASE, "screenshots": len(list(OUT.glob('*.png'))), "checks": len(results)}, ensure_ascii=False))
