// Playwright browser_run_code_unsafe filename; requires the local HTTP preview.
async(page)=>{
  const rows=[];
  async function measure(view){
    const buttons=page.locator(await page.locator('#modal').getAttribute('open')!==null?'#modal button:visible':'button:visible');
    for(let i=0;i<await buttons.count();i++){
      const b=buttons.nth(i);for(const hover of [false,true]){if(hover)await b.hover();else await page.mouse.move(0,0);
      rows.push(...await b.evaluate((el,view)=>{
        const luminance=color=>color.match(/[\d.]+/g).slice(0,3).map(Number).map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((n,v,i)=>n+v*[.2126,.7152,.0722][i],0);
        const original={disabled:el.disabled,pressed:el.getAttribute('aria-pressed')},out=[];
        for(const state of ['enabled','disabled','selected']){
          el.disabled=state==='disabled';el.setAttribute('aria-pressed',String(state==='selected'));
          const css=getComputedStyle(el),a=luminance(css.color),b=luminance(css.backgroundColor),ratio=(Math.max(a,b)+.05)/(Math.min(a,b)+.05);
          out.push({period:document.body.dataset.period,view,button:el.textContent.trim(),state,foreground:css.color,background:css.backgroundColor,opacity:css.opacity,ratio});
          if(ratio<4.5||Number(css.opacity)!==1)throw Error('Contrast failed: '+JSON.stringify(out.at(-1)));
        }
        el.disabled=original.disabled;if(original.pressed===null)el.removeAttribute('aria-pressed');else el.setAttribute('aria-pressed',original.pressed);
        return out;
      },view));}
    }
  }
  for(const [period,hour] of [['dusk',18],['night',22]]){
    await page.clock.setSystemTime(new Date(`2026-11-05T${hour}:00:00+07:00`));await page.goto('http://127.0.0.1:8788');
    await page.locator('[data-action=enter]').waitFor();await measure('entry');
    await page.locator('[data-action=enter]').click();await page.locator('[data-action=continue]').waitFor();await measure('choose');
    await page.locator('[data-action=continue]').click();await page.locator('[data-action=incense]').waitFor();await measure('home');
    for(const view of ['incense','bow','sit','beads']){
      await page.locator(`[data-action=${view}]`).click();await page.locator('[data-action=home]').waitFor();await measure(view);
      if(view==='sit'){await page.locator('[data-action=sit-start]').click();await measure('sit-running');await page.locator('[data-action=finish]').click();await page.locator('[data-action=share]').click();await page.locator('.share-preview').waitFor();await measure('share');await page.locator('#close-modal').click();}
      await page.locator('[data-action=home]').click();await page.locator('[data-action=incense]').waitFor();
    }
    await page.locator('#memorial').click();await measure('memorial');await page.locator('#close-modal').click();
  }
  const share=await page.evaluate(async()=>{
    await document.fonts.ready;const {copy}=await import('/i18n.js'),c=document.createElement('canvas').getContext('2d');c.font='500 44px "Be Vietnam Pro", sans-serif';
    return ['shareIncense','shareBow','shareSit','shareBeads'].flatMap(key=>['vi','en'].map(lang=>{
      const text=copy[key][lang].replace('{minutes}','10'),lines=[''];for(const word of text.split(' ')){const i=lines.length-1,next=lines[i]?lines[i]+' '+word:word;if(c.measureText(next).width>640&&lines[i])lines.push(word);else lines[i]=next;}
      if(lines.length>2)throw Error(key+' '+lang+' exceeds two lines');return {key,lang,font:44,cardWidth:720,lines};
    }));
  });
  return {samples:rows.length,minimum:Math.min(...rows.map(r=>r.ratio)),perPeriod:['dusk','night'].map(period=>({period,minimum:Math.min(...rows.filter(r=>r.period===period).map(r=>r.ratio))})),pairs:[...new Map(rows.map(r=>[r.foreground+r.background,{foreground:r.foreground,background:r.background,ratio:r.ratio}])).values()],share};
}
