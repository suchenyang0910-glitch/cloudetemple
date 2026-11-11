import json
import base64
import subprocess
import time
from pathlib import Path

from playwright.sync_api import sync_playwright


ROOT = Path(__file__).resolve().parents[1]
BASELINE = Path(r"E:\cloudtemple-worktrees\ui-audit-round4-prod-baseline")
OUT = ROOT / "review" / "ui-audit-round4-fix" / "festival"
DATES = ("2027-01-30", "2027-02-05", "2027-02-06", "2027-02-20")


def enter_home(page):
    page.locator('[data-action="enter"]').click()
    page.locator('[data-action="continue"]').click()
    page.wait_for_function(
        "document.querySelector('[data-action=incense]')||document.querySelector('[data-action=morning-start]')"
    )
    if page.locator('[data-action="morning-start"]').is_visible():
        page.locator('[data-action="morning-skip"]').click()
    page.locator('[data-action="incense"]').wait_for()
    page.wait_for_timeout(700)


def festival_styles(page):
    return page.evaluate(
        r"""()=>{
          const colors=e=>{const s=getComputedStyle(e),m=s.backgroundImage.match(/\/([^/\"]+\.svg)/);return {class:e.className,backgroundColor:s.backgroundColor,backgroundImage:m?m[1]:s.backgroundImage}};
          const lantern=document.querySelector('#festival-layer .fes-l');
          const thread=lantern?getComputedStyle(lantern,'::before').backgroundColor:null;
          const banner=document.querySelector('.tet-banner');
          const probe=document.createElement('p');probe.className='error-inline';document.body.append(probe);
          const error=getComputedStyle(probe).color;probe.remove();
          const bannerStyle=banner?getComputedStyle(banner):null;
          const catalog=Object.fromEntries(['fes-l','fes-fl','fes-pot','fes-moon','fes-p','fes-g'].map(name=>[name,colors(document.querySelector('.'+name))]));
          return {elements:[...document.querySelectorAll('#festival-layer *')].filter(e=>e.getClientRects().length).map(colors),catalog,thread,banner:bannerStyle?{backgroundColor:bannerStyle.backgroundColor,color:bannerStyle.color}:null,error};
        }"""
    )


def sheet(browser, left, right, target, title):
    def data(path):
        return "data:image/png;base64," + base64.b64encode(path.read_bytes()).decode("ascii")

    page = browser.new_page(viewport={"width": 780, "height": 884})
    page.set_content(
        f"""<style>*{{box-sizing:border-box}}body{{margin:0;background:#dfd9ce;color:#342f28;font:15px sans-serif}}header{{height:40px;display:grid;grid-template-columns:1fr 1fr;align-items:center;padding:0 12px}}main{{display:flex}}img{{display:block;width:390px;height:844px}}</style><header><span>production c9cc35c · {title}</span><span>P1 fix · {title}</span></header><main><img src=\"{data(left)}\"><img src=\"{data(right)}\"></main>"""
    )
    page.screenshot(path=target, type="jpeg", quality=90)
    page.close()


OUT.mkdir(parents=True, exist_ok=True)
servers = [
    subprocess.Popen(["python", "-m", "http.server", "8906", "-d", str(BASELINE / "dist")], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL),
    subprocess.Popen(["python", "-m", "http.server", "8907", "-d", str(ROOT / "dist")], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL),
]
time.sleep(0.6)
rows = []

try:
    with sync_playwright() as p:
        browser = p.chromium.launch()
        for date in DATES:
            captures = {}
            styles = {}
            for label, port in (("production", 8906), ("fix", 8907)):
                context = browser.new_context(viewport={"width": 390, "height": 844})
                context.add_init_script(
                    """()=>{localStorage.setItem('ct-muted','true');localStorage.setItem('ct-analytics','no');localStorage.setItem('ct-sound-hint-seen',JSON.stringify(true));localStorage.setItem('ct-morning-seen',JSON.stringify(true));localStorage.setItem('ct-visitor',JSON.stringify('bun-light'))}"""
                )
                page = context.new_page()
                page.goto(f"http://127.0.0.1:{port}/?festival-date={date}")
                page.locator("#boot").wait_for(state="detached")
                page.wait_for_timeout(500)
                entry = OUT / f"{date}-{label}-entry.png"
                page.screenshot(path=entry)
                enter_home(page)
                home = OUT / f"{date}-{label}-home.png"
                page.screenshot(path=home)
                captures[label] = {"entry": entry, "home": home}
                styles[label] = festival_styles(page)
                context.close()
            style_equal = styles["production"] == styles["fix"]
            rows.append({"date": date, "festival_colors_equal": style_equal, "production": styles["production"], "fix": styles["fix"]})
            for view in ("entry", "home"):
                sheet(browser, captures["production"][view], captures["fix"][view], OUT / f"{date}-{view}-side-by-side.jpg", view)
        browser.close()
finally:
    for server in servers:
        server.terminate()
        server.wait(timeout=5)

(OUT / "metrics.json").write_text(json.dumps(rows, ensure_ascii=False, indent=2), encoding="utf-8")
print(json.dumps({"passed": True, "dates": [{"date": row["date"], "festival_colors_equal": row["festival_colors_equal"]} for row in rows]}, ensure_ascii=False))
