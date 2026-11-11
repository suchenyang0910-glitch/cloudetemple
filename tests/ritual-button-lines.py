import argparse
import json
import subprocess
import time
from pathlib import Path

from playwright.sync_api import sync_playwright


ROOT = Path(__file__).resolve().parents[1]
BASE = "http://127.0.0.1:8911"


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


def button_lines(page):
    return page.locator("#controls button:visible").evaluate_all(
        """buttons=>buttons.map(button=>{
          const walker=document.createTreeWalker(button,NodeFilter.SHOW_TEXT);
          const tops=[];let node;
          while(node=walker.nextNode()){
            if(!node.textContent.trim())continue;
            const range=document.createRange();range.selectNodeContents(node);
            for(const rect of range.getClientRects())if(rect.width&&rect.height)tops.push(Math.round(rect.top*2)/2);
          }
          return {action:button.dataset.action||'',text:button.innerText.trim(),lines:new Set(tops).size};
        })"""
    )


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", default=str(ROOT / "review" / "ui-audit-round4-fix2"))
    args = parser.parse_args()
    output = Path(args.output)
    output.mkdir(parents=True, exist_ok=True)
    server = subprocess.Popen(
        ["python", "-m", "http.server", "8911", "-d", str(ROOT / "dist")],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    time.sleep(0.5)
    rows = []

    try:
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch()
            for width, height in ((390, 844), (360, 640)):
                context = browser.new_context(
                    viewport={"width": width, "height": height}, reduced_motion="reduce"
                )
                context.add_init_script(
                    """()=>{localStorage.setItem('ct-muted','true');localStorage.setItem('ct-analytics','no');localStorage.setItem('ct-sound-hint-seen',JSON.stringify(true));localStorage.setItem('ct-morning-seen',JSON.stringify(true));localStorage.setItem('ct-visitor',JSON.stringify('bun-light'))}"""
                )
                page = context.new_page()
                page.set_default_timeout(12000)
                enter_home(page)

                panels = {}

                def sample(view, state):
                    buttons = button_lines(page)
                    assert buttons and all(button["lines"] == 1 for button in buttons), (view, state, buttons)
                    panels.setdefault(view, round(page.locator("#controls").bounding_box()["height"]))
                    page.screenshot(path=output / f"{width}x{height}-{view}-{state}.png")
                    rows.append(
                        {
                            "size": f"{width}x{height}",
                            "view": view,
                            "state": state,
                            "panel_height": round(page.locator("#controls").bounding_box()["height"]),
                            "buttons": buttons,
                        }
                    )

                click(page, "incense")
                page.locator("#loading").wait_for(state="hidden")
                sample("incense", "walking")
                page.wait_for_timeout(1100)
                sample("incense", "ready-light")
                click(page, "light")
                sample("incense", "lighting")
                page.wait_for_timeout(950)
                sample("incense", "ready-bow")
                click(page, "light")
                sample("incense", "bowing")
                page.wait_for_timeout(1950)
                sample("incense", "ready-plant")
                click(page, "light")
                sample("incense", "planting")
                page.wait_for_timeout(950)
                sample("incense", "standing")
                click(page, "home")

                click(page, "bow")
                page.locator("#loading").wait_for(state="hidden")
                sample("bow", "idle")
                click(page, "bow-once")
                sample("bow", "running")
                page.wait_for_timeout(3350)
                sample("bow", "between")
                click(page, "home")

                click(page, "sit")
                page.locator("#loading").wait_for(state="hidden")
                sample("sit", "idle")
                click(page, "sit-options")
                sample("sit", "options")
                click(page, "sit-options")
                click(page, "sit-start")
                sample("sit", "running")
                click(page, "pause")
                sample("sit", "paused")
                click(page, "pause")
                sample("sit", "resumed")
                click(page, "home")

                click(page, "mo")
                page.locator("#loading").wait_for(state="hidden")
                sample("mo", "idle")
                click(page, "wood-auto")
                sample("mo", "auto")
                click(page, "wood-auto")
                click(page, "home")

                click(page, "beads")
                page.locator("#loading").wait_for(state="hidden")
                sample("beads", "right")
                click(page, "bead-hand")
                sample("beads", "left")

                assert max(panels.values()) - min(panels.values()) <= 8, panels
                context.close()
            browser.close()
    finally:
        server.terminate()
        server.wait(timeout=5)

    (output / "metrics.json").write_text(
        json.dumps(rows, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    print(json.dumps({"passed": True, "states": len(rows), "output": str(output)}, ensure_ascii=False))


if __name__ == "__main__":
    main()
