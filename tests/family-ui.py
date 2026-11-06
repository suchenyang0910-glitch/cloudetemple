from pathlib import Path
from playwright.sync_api import sync_playwright

OUT=Path(r'E:\cloudtemple-worktrees\v2-family-staging\screenshots\family-v2')
OUT.mkdir(parents=True,exist_ok=True)
BASE='http://127.0.0.1:8788/family.html?demo=1'
results=[]
with sync_playwright() as p:
    browser=p.chromium.launch(headless=True)
    for width,height in [(375,548),(393,659)]:
        page=browser.new_page(viewport={'width':width,'height':height})
        errors=[]; page.on('pageerror',lambda e: errors.append(str(e)))
        for period in ['dawn','day','dusk','night']:
            page.goto(BASE+'&period='+period);page.locator('.card').first.click();page.locator('.scene').wait_for();
            page.screenshot(path=str(OUT/f'{width}x{height}-tablet-{period}.png') )
            metrics=page.evaluate('''()=>({root:[document.scrollingElement.scrollWidth,document.scrollingElement.scrollHeight,innerWidth,innerHeight],buttons:[...document.querySelectorAll('button,a')].filter(e=>e.getClientRects().length).map(e=>{const r=e.getBoundingClientRect();return [r.left,r.top,r.right,r.bottom,r.height]})})''')
            assert metrics['root']==[width,height,width,height],metrics
            assert all(b[0]>=0 and b[1]>=0 and b[2]<=width+.1 and b[3]<=height+.1 and b[4]>=44 for b in metrics['buttons']),metrics
        page.goto(BASE+'&period=night');page.locator('.card').first.click();page.get_by_role('button',name='Thắp hương').click();page.screenshot(path=str(OUT/f'{width}x{height}-offering-night.png'))
        page.get_by_role('button',name='Về danh sách').click();page.locator('#new').click();page.screenshot(path=str(OUT/f'{width}x{height}-form.png'))
        page.locator('#account').click();page.screenshot(path=str(OUT/f'{width}x{height}-account.png'))
        page.goto(BASE+'#invite=demo');page.get_by_text('mời bạn').wait_for();page.screenshot(path=str(OUT/f'{width}x{height}-invite.png'))
        assert not errors,errors
        results.append({'width':width,'height':height,'screenshots':8,'errors':errors})
        page.close()
    browser.close()
print({'passed':True,'viewports':results,'files':len(list(OUT.glob('*.png')))})
