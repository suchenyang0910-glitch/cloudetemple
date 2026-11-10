from pathlib import Path
import json
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright

OUT=Path(__file__).resolve().parents[1]/'screenshots'/'family-v2'
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

    state={'authenticated':False,'accepted':False,'force401':False,'consent':False,'created':False}
    page=browser.new_page(viewport={'width':393,'height':659})
    errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    tablet={'id':'33333333-3333-4333-8333-333333333333','honorific':'Bà ngoại','full_name':'Nguyễn Hoa','death_lunar_day':12,'death_lunar_month':3,'role':'family'}
    def family_api(route):
        path=urlparse(route.request.url).path
        status=200;body={'ok':True}
        if path.endswith('/session'):body={'ok':True,'authenticated':state['authenticated'],'csrf':'csrf-test' if state['authenticated'] else ''}
        elif path.endswith('/invites/info'):body={'ok':True,'invite':{'inviter':'Nguyễn An','honorific':'Bà ngoại','fullName':'Nguyễn Hoa'}}
        elif path.endswith('/auth/email/start'):body={'ok':True}
        elif path.endswith('/auth/email/verify'):state['authenticated']=True;body={'ok':True,'csrf':'csrf-test'}
        elif path.endswith('/consent'):
            if route.request.method=='POST':state['consent']=True
            body={'ok':True,'accepted':state['consent'],'version':'pilot-2026-11-07-v2'}
        elif path.endswith('/invites/accept'):
            if state['force401']:status=401;body={'ok':False,'error':'unauthorized'}
            else:state['accepted']=True;body={'ok':True,'tablet':tablet}
        elif path.endswith('/tablets'):
            if route.request.method=='POST':state['created']=True;body={'ok':True,'tablet':tablet}
            else:body={'ok':True,'tablets':[tablet] if state['accepted'] or state['created'] else []}
        else:status=404;body={'ok':False,'error':'not_found'}
        route.fulfill(status=status,content_type='application/json',body=json.dumps(body))
    page.route('**/api/family/**',family_api)

    live='http://127.0.0.1:8788/family.html'
    page.goto(live+'#invite=email-token')
    page.get_by_text('Nguyễn An mời bạn').wait_for()
    assert '#invite=' not in page.url and 'invite=' not in page.url
    assert page.locator('#accept').count()==0 and page.locator('#login').is_visible()
    assert page.evaluate("sessionStorage.getItem('ct-family-invite')")=='email-token'
    assert page.evaluate("localStorage.getItem('ct-family-invite')") is None
    page.locator('#login').click()
    page.locator('#email-login input').fill('member@example.test');page.locator('#email-login').evaluate('f=>f.requestSubmit()')
    page.locator('#code-form').wait_for(state='visible');page.locator('#code-form input').fill('123456');page.locator('#code-form').evaluate('f=>f.requestSubmit()')
    page.locator('#accept').wait_for();page.locator('#accept').click()
    page.locator('.card').wait_for();assert state['accepted']
    assert page.evaluate("sessionStorage.getItem('ct-family-invite')") is None

    state.update(authenticated=False,accepted=False,force401=False)
    page.goto(live+'?flow=google#invite=google-token');page.locator('#login').click()
    assert page.evaluate("sessionStorage.getItem('ct-family-invite')")=='google-token'
    page.evaluate("document.querySelector('.google').addEventListener('click',e=>e.preventDefault(),{once:true});document.querySelector('.google').click()")
    assert page.evaluate("sessionStorage.getItem('ct-family-invite')")=='google-token'
    state['authenticated']=True;page.goto(live+'?flow=callback')
    page.locator('#accept').wait_for();assert page.get_by_text('Nguyễn An mời bạn').is_visible()
    state['force401']=True;page.locator('#accept').click();page.locator('#email-login').wait_for()
    assert 'hết hạn' in page.locator('#status').inner_text() and not errors,errors

    state.update(authenticated=True,accepted=False,force401=False,consent=False,created=False)
    page.evaluate("sessionStorage.removeItem('ct-family-invite')")
    page.goto(live+'?flow=consent')
    page.locator('#new, #email-login').first.wait_for()
    assert page.locator('#new').count(),page.locator('#screen').inner_text()
    page.locator('#new').click();page.locator('#consent-agree').wait_for()
    assert page.locator('#consent-continue').is_disabled()
    page.locator('#consent-agree').check();page.locator('#consent-continue').click()
    page.locator('#tablet-form').wait_for();page.locator('[name=fullName]').fill('Nguyễn Hoa')
    page.locator('#tablet-form').evaluate('f=>f.requestSubmit()');page.locator('.card').wait_for()
    assert state['consent'] and state['created']
    page.close()
    browser.close()
print({'passed':True,'viewports':results,'inviteAuth':['email-accept','google-resume','401-recovery'],'consentCreate':True,'files':len(list(OUT.glob('*.png')))})
