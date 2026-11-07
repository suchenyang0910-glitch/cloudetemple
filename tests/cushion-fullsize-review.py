from __future__ import annotations

import argparse
import json
from datetime import datetime
from pathlib import Path

from playwright.sync_api import sync_playwright


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "screenshots" / "cushion-fullsize-review"
VISITORS = ("short-light", "curly-dark", "curly-medium", "bun-light", "bun-dark", "ponytail-medium")
PERIODS = {"day": "2026-11-08T10:00:00+07:00", "night": "2026-11-08T21:00:00+07:00"}
ACTIVITIES = ("sit", "beads", "mo")


def settled(page, view):
    page.wait_for_function(
        "view=>document.body.dataset.view===view&&document.querySelector('#app').getAttribute('aria-busy')==='false'",
        arg=view,
    )
    page.locator("#loading").wait_for(state="hidden")
    page.clock.run_for(400)
    page.evaluate("document.getAnimations().filter(a=>a.effect.getTiming().iterations!==Infinity).forEach(a=>a.finish())")


def click(page, action):
    page.locator(f'[data-action="{action}"]:visible').first.click()


parser = argparse.ArgumentParser()
parser.add_argument("base", nargs="?", default="http://127.0.0.1:8788")
parser.add_argument("--auth-file", type=Path)
args = parser.parse_args()
credentials = None
if args.auth_file:
    credentials = {"username": "reviewer", "password": args.auth_file.read_text(encoding="utf-8").strip()}

OUT.mkdir(parents=True, exist_ok=True)
results = []
with sync_playwright() as pw:
    browser = pw.chromium.launch(headless=True)
    for period, when in PERIODS.items():
        for visitor in VISITORS:
            context = browser.new_context(
                viewport={"width": 393, "height": 852},
                timezone_id="Asia/Ho_Chi_Minh",
                user_agent="Telegram-iOS",
                http_credentials=credentials,
            )
            page = context.new_page()
            page.add_init_script(
                f"localStorage.setItem('ct-muted','true');localStorage.setItem('ct-analytics','no');localStorage.setItem('ct-morning-seen','true');localStorage.setItem('ct-visitor',JSON.stringify('{visitor}'));"
            )
            page.clock.install(time=datetime.fromisoformat(when))
            page.goto(args.base + "?telegram=1")
            if page.locator("#ga-choice:visible").count():
                page.locator("#ga-choice").evaluate("e=>e.hidden=true")
            click(page, "enter")
            settled(page, "choose")
            click(page, "continue")
            settled(page, "home")
            app_url = page.locator('script[type="module"][src*="app."]').get_attribute("src") or "/app.js"
            resources_url = app_url.replace("app.", "resources.") if "app." in app_url else "/resources.js"
            for activity in ACTIVITIES:
                click(page, activity)
                settled(page, activity)
                expected = f"visitor-{visitor}-{activity}{'-nocushion' if activity in ('sit', 'beads') else '-1-v1'}.webp"
                loaded = page.evaluate("async ([src,name])=>(await import(new URL(src,location.href))).imageStatus.has(name)", [resources_url, expected])
                assert loaded, expected
                assert page.locator("#scene").get_attribute("data-cushion-policy") == "scene"
                dims = page.evaluate("({w:innerWidth,h:innerHeight,sw:document.documentElement.scrollWidth,sh:document.documentElement.scrollHeight})")
                assert dims["sw"] <= dims["w"] and dims["sh"] <= dims["h"], (activity, visitor, period, dims)
                filename = f"{period}-{visitor}-{activity}-393x852.png"
                page.screenshot(path=str(OUT / filename))
                results.append({"file": filename, "asset": expected, "width": 393, "height": 852})
                click(page, "home")
                settled(page, "home")
            context.close()
    browser.close()

assert len(results) == 36
(OUT / "results.json").write_text(json.dumps({"passed": True, "screenshots": results}, indent=2), encoding="utf-8")
print(json.dumps({"passed": True, "screenshots": len(results), "directory": str(OUT)}))
