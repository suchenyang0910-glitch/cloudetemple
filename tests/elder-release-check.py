from datetime import datetime
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread
import json, sys
from playwright.sync_api import expect, sync_playwright

ROOT = Path(__file__).resolve().parents[1]
PHASE = sys.argv[1] if len(sys.argv) > 1 else "after"
OUT = ROOT / "screenshots" / "release-20261108-elder" / PHASE
OUT.mkdir(parents=True, exist_ok=True)
SIZES = [(375, 548), (393, 659), (393, 852)]


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT / "dist"), **kwargs)

    def end_headers(self):
        if PHASE == "after":
            self.send_header("Content-Security-Policy", "default-src 'self'; script-src 'self' https://www.googletagmanager.com; style-src 'self' 'unsafe-inline'; font-src 'self'; img-src 'self' data: blob:; connect-src 'self' https://www.google-analytics.com https://region1.google-analytics.com; media-src 'self' blob:; object-src 'none'; base-uri 'self'")
        super().end_headers()

    def log_message(self, *_):
        pass


server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
Thread(target=server.serve_forever, daemon=True).start()
base = f"http://{'staging.chuamay.org' if PHASE == 'after' else '127.0.0.1'}:{server.server_port}"
results = []


def visible_layout(page):
    return page.evaluate("""()=>{
      const root=document.scrollingElement,buttons=[...document.querySelectorAll('#controls button')].filter(e=>e.getClientRects().length);
      return {scroll:[root.scrollWidth,root.scrollHeight,innerWidth,innerHeight],overflow:buttons.filter(e=>{const r=e.getBoundingClientRect();return r.left<0||r.right>innerWidth||r.top<0||r.bottom>innerHeight||e.scrollWidth>e.clientWidth||e.scrollHeight>e.clientHeight}).map(e=>e.textContent.trim()),heading:parseFloat(getComputedStyle(document.querySelector('.scene-heading h1')).fontSize)};
    }""")


with sync_playwright() as pw:
    browser = pw.chromium.launch(args=["--host-resolver-rules=MAP staging.chuamay.org 127.0.0.1"])
    for width, height in SIZES:
        context = browser.new_context(viewport={"width": width, "height": height}, timezone_id="Asia/Ho_Chi_Minh")
        page = context.new_page()
        console_errors = []
        collects = []
        collect_requests = []
        page.on("console", lambda m: console_errors.append(m.text) if m.type == "error" else None)
        page.on("response", lambda r: collects.append((r.status, r.url)) if "google-analytics.com/g/collect" in r.url else None)
        page.on("request", lambda r: collect_requests.append(r.url + "&" + (r.post_data or "")) if "google-analytics.com/g/collect" in r.url else None)
        page.add_init_script("localStorage.setItem('ct-muted','true');localStorage.setItem('ct-analytics','yes');localStorage.setItem('ct-visitor',JSON.stringify('bun-light'))")
        page.clock.install(time=datetime.fromisoformat("2026-11-08T10:00:00+07:00"))

        def settle():
            expect(page.locator("#app")).not_to_have_attribute("aria-busy", "true")
            page.locator("#loading").wait_for(state="hidden")
            page.clock.run_for(500)
            page.evaluate("document.getAnimations().filter(a=>a.effect.getTiming().iterations!==Infinity).forEach(a=>a.finish())")

        def shot(name):
            settle()
            layout = visible_layout(page)
            assert layout["scroll"] == [width, height, width, height], (name, layout)
            assert not layout["overflow"], (name, layout)
            page.screenshot(path=OUT / f"{width}x{height}-{name}.png", scale="css")
            results.append({"size": f"{width}x{height}", "view": name, **layout})

        def click(action):
            page.locator(f'[data-action="{action}"]:visible').first.click()

        page.goto(base)
        page.locator('[data-action="enter"]').wait_for()
        if page.locator("#ga-choice").is_visible():
            page.locator("#ga-choice button").first.click() if PHASE == "after" else page.locator("#ga-choice button").nth(1).click()
        page.locator("#ga-choice").evaluate("el=>{el.hidden=true;el.style.pointerEvents='none'}")
        shot("entry")
        click("enter")
        settle()
        click("continue")
        page.locator('[data-action="incense"]').wait_for()
        shot("home")
        if PHASE == "after":
            home = page.evaluate("""()=>({gap:parseFloat(getComputedStyle(document.querySelector('.action-nav')).gap),buttons:[...document.querySelectorAll('.action-nav button')].map(e=>({font:parseFloat(getComputedStyle(e).fontSize),height:e.getBoundingClientRect().height,clipped:e.scrollWidth>e.clientWidth||e.scrollHeight>e.clientHeight})),heading:parseFloat(getComputedStyle(document.querySelector('.scene-heading h1')).fontSize)})""")
            assert home["gap"] >= 8 and home["heading"] >= 18, home
            assert all(x["font"] >= 14 and x["height"] >= 44 and not x["clipped"] for x in home["buttons"]), home

        for action in ("incense", "bow", "mo", "sit", "beads"):
            click(action)
            shot(action)
            if PHASE == "after":
                back = page.locator('[data-action="home"]')
                style = back.evaluate("e=>({font:parseFloat(getComputedStyle(e).fontSize),border:getComputedStyle(e).borderStyle,height:e.getBoundingClientRect().height})")
                assert style["font"] >= 16 and style["border"] != "none" and style["height"] >= 44, (action, style)
            click("home")
            settle()

        click("incense")
        click("light")
        page.clock.fast_forward(61_000)
        page.locator('[data-action="share"]').wait_for()
        click("share")
        page.locator(".share-preview").wait_for()
        page.locator(".share-preview").evaluate("e=>e.decode()")
        shot("share")

        if PHASE == "after":
            page.wait_for_timeout(1500)
            events = page.evaluate("(window.dataLayer||[]).map(x=>Array.from(x)).filter(x=>x[0]==='event').map(x=>x[1])")
            assert "page_view" in events and "activity_start" in events, events
            assert collects and all(status == 204 for status, _ in collects), [status for status, _ in collects]
            assert any("en=page_view" in request for request in collect_requests), ["page_view" in request for request in collect_requests]
            assert any("en=activity_start" in request for request in collect_requests), ["activity_start" in request for request in collect_requests]
            assert not [x for x in console_errors if "Content Security Policy" in x or "Refused to" in x], console_errors
        context.close()
    browser.close()

server.shutdown()
(OUT / "results.json").write_text(json.dumps({"phase": PHASE, "screenshots": len(results), "results": results}, ensure_ascii=False, indent=2), encoding="utf-8")
print(json.dumps({"passed": True, "phase": PHASE, "screenshots": len(results), "sizes": SIZES}, ensure_ascii=False))
