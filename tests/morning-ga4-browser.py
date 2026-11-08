from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread

from playwright.sync_api import sync_playwright


ROOT = Path(__file__).resolve().parents[1]


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT / "dist"), **kwargs)

    def log_message(self, *_):
        pass


class QuietServer(ThreadingHTTPServer):
    def handle_error(self, *_):
        pass


server = QuietServer(("127.0.0.1", 0), Handler)
Thread(target=server.serve_forever, daemon=True).start()
base = f"http://h5.chuamay.org:{server.server_port}"

try:
    with sync_playwright() as pw:
        browser = pw.chromium.launch(args=["--host-resolver-rules=MAP h5.chuamay.org 127.0.0.1"])
        page = browser.new_page(viewport={"width": 393, "height": 659})
        page.add_init_script("localStorage.setItem('ct-analytics','yes');localStorage.removeItem('ct-morning-seen')")
        page.goto(base)
        page.locator("[data-action=enter]").click()
        page.locator("[data-action=continue]").click()
        page.locator("[data-action=morning-start]").click()
        page.wait_for_timeout(100)
        page.locator("[data-action=morning-skip]").click()
        events = page.evaluate("(window.dataLayer||[]).map(x=>Array.from(x)).filter(x=>x[0]==='event').map(x=>x[1])")
        assert "morning_start" in events and "morning_step" in events and "morning_skip" in events, events
        browser.close()
    print({"passed": True, "events": ["morning_start", "morning_step", "morning_skip"]})
finally:
    server.shutdown()
    server.server_close()
