import argparse
import json
import subprocess
import time
from pathlib import Path

from playwright.sync_api import sync_playwright


ROOT = Path(__file__).resolve().parents[1]
BASE = "http://127.0.0.1:8905"
OUT = ROOT / "review" / "ui-audit-round4-fix"


def click(page, action):
    page.locator(f'[data-action="{action}"]:visible').click()


def enter_home(page):
    page.goto(BASE)
    page.locator("#boot").wait_for(state="detached")
    click(page, "enter")
    click(page, "continue")
    page.wait_for_function(
        "document.querySelector('[data-action=incense]')||document.querySelector('[data-action=morning-start]')"
    )
    if page.locator('[data-action="morning-start"]').is_visible():
        click(page, "morning-skip")
    page.locator('[data-action="incense"]').wait_for()
    page.locator("#ga-choice").evaluate("e=>{e.hidden=true;e.style.pointerEvents='none'}")


def boxes(page, selector):
    return page.locator(selector).evaluate_all(
        "els=>els.filter(e=>e.getClientRects().length).map(e=>{const r=e.getBoundingClientRect();return {text:e.textContent.trim(),x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:r.width,height:r.height,scrollWidth:e.scrollWidth,clientWidth:e.clientWidth}})"
    )


parser = argparse.ArgumentParser()
parser.add_argument("--label", choices=("before", "after"), required=True)
args = parser.parse_args()
folder = OUT / args.label
folder.mkdir(parents=True, exist_ok=True)
server = subprocess.Popen(
    ["python", "-m", "http.server", "8905", "-d", str(ROOT / "dist")],
    stdout=subprocess.DEVNULL,
    stderr=subprocess.DEVNULL,
)
time.sleep(0.5)
results = []

try:
    with sync_playwright() as p:
        browser = p.chromium.launch()
        for width, height in ((390, 844), (360, 640)):
            context = browser.new_context(viewport={"width": width, "height": height})
            context.add_init_script(
                """()=>{localStorage.setItem('ct-muted','true');localStorage.setItem('ct-analytics','no');localStorage.setItem('ct-sound-hint-seen',JSON.stringify(true));localStorage.setItem('ct-morning-seen',JSON.stringify(true));localStorage.setItem('ct-visitor',JSON.stringify('bun-light'))}"""
            )
            page = context.new_page()
            page.set_default_timeout(10000)
            errors = []
            page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
            enter_home(page)

            panels = {}
            bow_text = ""
            bow_buttons = []
            sit_buttons = []
            for action in ("incense", "bow", "sit", "mo", "beads"):
                click(page, action)
                page.locator("#loading").wait_for(state="hidden")
                page.wait_for_timeout(700)
                panels[action] = round(page.locator("#controls").bounding_box()["height"])
                if action == "bow":
                    bow_text = page.locator("#controls").inner_text()
                    bow_buttons = boxes(page, ".bow-actions button,.bow-back button")
                    page.screenshot(path=folder / f"{width}x{height}-bow.png")
                if action == "sit":
                    click(page, "sit-options")
                    page.wait_for_timeout(100)
                    page.screenshot(path=folder / f"{width}x{height}-sit-options.png")
                    sit_buttons = boxes(page, ".sit-options button")
                    click(page, "sit-options")
                click(page, "home")

            result = {
                "size": f"{width}x{height}",
                "panels": panels,
                "panel_delta": max(panels.values()) - min(panels.values()),
                "bow_text": bow_text,
                "bow_buttons": bow_buttons,
                "sit_buttons": sit_buttons,
                "errors": errors,
            }
            if args.label == "after":
                assert "<>" not in bow_text, bow_text
                assert result["panel_delta"] <= 8, panels
                assert all(b["scrollWidth"] <= b["clientWidth"] + 1 for b in bow_buttons), bow_buttons
                assert all(b["x"] >= 0 and b["right"] <= width + 0.5 for b in sit_buttons), sit_buttons
                rows = {}
                for button in sit_buttons:
                    rows.setdefault(round(button["y"]), []).append(button)
                for row in rows.values():
                    row.sort(key=lambda button: button["x"])
                    assert all(row[i + 1]["x"] - row[i]["right"] >= 7.5 for i in range(len(row) - 1)), row
            results.append(result)
            context.close()
        browser.close()
finally:
    server.terminate()
    server.wait(timeout=5)

(folder / "metrics.json").write_text(
    json.dumps(results, ensure_ascii=False, indent=2), encoding="utf-8"
)
print(json.dumps({"passed": True, "label": args.label, "results": results}, ensure_ascii=False))
