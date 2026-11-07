from __future__ import annotations

import argparse
import base64
import json
import shutil
from datetime import datetime
from pathlib import Path

from playwright.sync_api import sync_playwright


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "screenshots" / "cushion-share-fix"
BASELINES = ROOT / "tests" / "visual-baselines" / "cushion-share"
VISITORS = ["short-light", "curly-dark", "curly-medium", "bun-light", "bun-dark", "ponytail-medium"]
ACTIVITIES = ["incense", "bow", "mo", "sit", "beads"]
SIZES = [(375, 548, "375x548"), (393, 659, "393x659"), (393, 852, "iphone15-telegram")]
PERIODS = {"day": "2026-11-07T10:00:00+07:00", "night": "2026-11-07T21:00:00+07:00"}


def settled(page, view):
    page.wait_for_function(
        "view => document.body.dataset.view === view && document.querySelector('#app')?.getAttribute('aria-busy') === 'false'",
        arg=view,
    )
    page.locator("#loading").wait_for(state="hidden")
    page.clock.run_for(350)
    page.evaluate("document.getAnimations().filter(a=>a.effect.getTiming().iterations!==Infinity).forEach(a=>a.finish())")


def click(page, action):
    page.locator(f'[data-action="{action}"]:visible').first.click()


def contact_sheet(browser, cells, title, path):
    page = browser.new_page(viewport={"width": 1180, "height": 900})
    cards = "".join(
        f'<figure><img src="data:image/png;base64,{base64.b64encode(data).decode()}"><figcaption>{label}</figcaption></figure>'
        for label, data in cells
    )
    page.set_content(
        f"""<!doctype html><style>
        body{{margin:18px;background:#e9dfcf;color:#31281f;font:14px sans-serif}}h1{{font-size:22px}}
        main{{display:grid;grid-template-columns:repeat(6,1fr);gap:10px}}figure{{margin:0;background:#fff8ec;padding:6px;border-radius:8px}}
        img{{display:block;width:100%;aspect-ratio:393/659;object-fit:contain;object-position:top}}figcaption{{padding-top:5px;text-align:center}}
        </style><h1>{title}</h1><main>{cards}</main>"""
    )
    page.screenshot(path=str(path), full_page=True, type="jpeg", quality=80)
    page.close()


def image_difference(page, current_path, baseline_path):
    current_url = "data:image/jpeg;base64," + base64.b64encode(current_path.read_bytes()).decode()
    baseline_url = "data:image/jpeg;base64," + base64.b64encode(baseline_path.read_bytes()).decode()
    return page.evaluate(
        """async ([a,b])=>{const load=src=>new Promise((ok,no)=>{const i=new Image;i.onload=()=>ok(i);i.onerror=no;i.src=src});
        const [x,y]=await Promise.all([load(a),load(b)]);if(x.width!==y.width||x.height!==y.height)return 1;
        const c=document.createElement('canvas');c.width=x.width;c.height=x.height;const g=c.getContext('2d');g.drawImage(x,0,0);const p=g.getImageData(0,0,c.width,c.height).data;g.clearRect(0,0,c.width,c.height);g.drawImage(y,0,0);const q=g.getImageData(0,0,c.width,c.height).data;
        let changed=0;for(let i=0;i<p.length;i+=4)if((Math.abs(p[i]-q[i])+Math.abs(p[i+1]-q[i+1])+Math.abs(p[i+2]-q[i+2]))/3>20)changed++;return changed/(p.length/4)}""",
        [current_url, baseline_url],
    )


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("base", nargs="?", default="http://127.0.0.1:8788")
    parser.add_argument("--update-baselines", action="store_true")
    parser.add_argument("--auth-file", type=Path)
    args = parser.parse_args()
    credentials = None
    if args.auth_file:
        password = args.auth_file.read_text(encoding="utf-8").strip()
        credentials = {"username": "reviewer", "password": password}
    OUT.mkdir(parents=True, exist_ok=True)
    BASELINES.mkdir(parents=True, exist_ok=True)
    reports = []
    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=True)
        for width, height, size_name in SIZES:
            for period, when in PERIODS.items():
                cells = []
                for visitor in VISITORS:
                    context = browser.new_context(
                        viewport={"width": width, "height": height},
                        timezone_id="Asia/Ho_Chi_Minh",
                        user_agent="Telegram-iOS" if "telegram" in size_name else None,
                        http_credentials=credentials,
                    )
                    page = context.new_page()
                    page.add_init_script("localStorage.setItem('ct-morning-seen','true')")
                    page.add_init_script(
                        f"localStorage.setItem('ct-muted','true');localStorage.setItem('ct-analytics','no');localStorage.setItem('ct-visitor',JSON.stringify('{visitor}'));"
                    )
                    page.clock.install(time=datetime.fromisoformat(when))
                    page.goto(args.base + ("?telegram=1" if "telegram" in size_name else ""))
                    if page.locator("#ga-choice:visible").count():
                        page.locator("#ga-choice").evaluate("e=>e.hidden=true")
                    click(page, "enter"); settled(page, "choose")
                    click(page, "continue"); settled(page, "home")
                    for activity in ACTIVITIES:
                        click(page, activity); settled(page, activity)
                        assert page.locator("#scene").get_attribute("data-cushion-policy") == "scene"
                        assert page.locator("#scene").get_attribute("data-visitor") == visitor
                        cells.append((f"{activity} · {visitor}", page.screenshot()))
                        click(page, "home"); settled(page, "home")
                    context.close()
                output = OUT / f"matrix-{size_name}-{period}.jpg"
                contact_sheet(browser, cells, f"{size_name} · {period} · 5 activities × 6 visitors", output)
                baseline = BASELINES / output.name
                if args.update_baselines:
                    shutil.copyfile(output, baseline)
                else:
                    assert baseline.exists(), f"missing baseline: {baseline}"
                    compare = browser.new_page()
                    difference = image_difference(compare, output, baseline)
                    compare.close()
                    assert difference < 0.02, (output.name, difference)
                    reports.append({"matrix": output.name, "pixelDifference": round(difference, 5)})

        share_context = browser.new_context(http_credentials=credentials)
        share_page = share_context.new_page()
        share_page.add_init_script("localStorage.setItem('ct-morning-seen','true')")
        share_page.goto(args.base)
        module_url = share_page.locator('script[type="module"][src*="app."]').get_attribute("src") or "/app.js"
        share_result = share_page.evaluate(
            """async src=>{const {shareCardLayout}=await import(new URL(src,location.href));const c=document.createElement('canvas');const x=c.getContext('2d');
            const texts=['Hôm nay mình đã dành một phút thắp hương ở Chùa Mây. Gửi bạn một khoảng lặng nhỏ 🙏','Hôm nay mình đã lễ Phật 108 lạy, chậm rãi theo hơi thở. Bạn cũng thử dừng lại một chút nhé.','Mình vừa ngồi yên 10 phút ở Chùa Mây. Không cần làm gì thêm.','Hôm nay mình đã gõ 108 tiếng mõ. Một nhịp, rồi một nhịp nữa.','Mình vừa lần trọn một vòng 108 hạt. Chúc bạn một ngày bình an.'];
            const cards=texts.map(text=>{const card=document.createElement('canvas');card.width=720;card.height=1280;const g=card.getContext('2d');g.fillStyle='#f3ecde';g.fillRect(0,0,720,1280);g.fillStyle='#d8c9b5';g.fillRect(90,0,540,930);g.fillStyle='#3d3429';g.textAlign='center';const r=shareCardLayout(g,text);g.font=`500 ${r.font}px sans-serif`;r.body.forEach((line,i)=>g.fillText(line,360,r.bodyBox.top+(i+1)*r.lineHeight-r.lineHeight*.18));g.strokeRect(52,1118,112,112);g.textAlign='left';g.font='500 28px sans-serif';g.fillText('Chùa Mây',200,1145);g.font='18px sans-serif';g.fillText('Một khoảng lặng cho hôm nay',200,1184);g.font='15px sans-serif';g.fillText('h5.chuamay.org',200,1225);return card.toDataURL()});
            return {cards,report:texts.map(text=>{const r=shareCardLayout(x,text);return {font:r.font,lines:r.body.length,bodyBottom:r.bodyBox.bottom,footerTop:r.footerBox.top,clear:r.bodyBox.bottom<=r.footerBox.top}})}}""",
            module_url,
        )
        share_report = share_result["report"]
        assert all(item["clear"] for item in share_report), share_report
        share_cells = []
        for label, url in zip(("incense", "bow", "sit", "mo", "beads"), share_result["cards"]):
            share_cells.append((label, base64.b64decode(url.split(",", 1)[1])))
        share_output = OUT / "share-cards-five-activities.jpg"
        contact_sheet(browser, share_cells, "Share cards · five activities", share_output)
        share_baseline = BASELINES / share_output.name
        if args.update_baselines:
            shutil.copyfile(share_output, share_baseline)
        else:
            assert share_baseline.exists(), f"missing baseline: {share_baseline}"
            compare = browser.new_page()
            difference = image_difference(compare, share_output, share_baseline)
            compare.close()
            assert difference < 0.02, (share_output.name, difference)
            reports.append({"matrix": share_output.name, "pixelDifference": round(difference, 5)})
        share_context.close()
        browser.close()
    (OUT / "results.json").write_text(json.dumps({"matrices": reports, "shareCards": share_report}, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps({"passed": True, "matrices": len(reports), "shareCards": share_report}, ensure_ascii=False))


if __name__ == "__main__":
    main()
