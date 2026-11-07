from __future__ import annotations

import base64
from pathlib import Path

from playwright.sync_api import sync_playwright


ROOT = Path(__file__).resolve().parents[1]
IMAGES = ROOT / "assets" / "processed-v1" / "img"
VISITORS = ("short-light", "curly-dark", "curly-medium", "bun-light", "bun-dark", "ponytail-medium")


with sync_playwright() as playwright:
    browser = playwright.chromium.launch(headless=True)
    page = browser.new_page()
    checked = []
    for visitor in VISITORS:
        for pose in ("sit", "beads"):
            path = IMAGES / f"visitor-{visitor}-{pose}-nocushion.webp"
            source = "data:image/webp;base64," + base64.b64encode(path.read_bytes()).decode()
            result = page.evaluate(
                """async source => {
                  const image=new Image();image.src=source;await image.decode();
                  const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;
                  const context=canvas.getContext('2d',{willReadFrequently:true});context.drawImage(image,0,0);
                  const data=context.getImageData(0,0,canvas.width,canvas.height).data,w=canvas.width,h=canvas.height,n=w*h;
                  const seen=new Uint8Array(n),queue=new Int32Array(n),sizes=[];
                  for(let seed=0;seed<n;seed++){
                    if(seen[seed]||data[seed*4+3]===0)continue;
                    let head=0,tail=0;queue[tail++]=seed;seen[seed]=1;
                    while(head<tail){const p=queue[head++],x=p%w;
                      for(const q of [p-w,p+w,x?p-1:-1,x<w-1?p+1:-1])if(q>=0&&q<n&&!seen[q]&&data[q*4+3]>0){seen[q]=1;queue[tail++]=q;}
                    }
                    sizes.push(tail);
                  }
                  return {components:sizes.length,largest:Math.max(...sizes),orphans:sizes.slice().sort((a,b)=>b-a).slice(1).reduce((a,b)=>a+b,0)};
                }""",
                source,
            )
            assert result["components"] == 1 and result["orphans"] == 0, (path.name, result)
            checked.append(path.name)
    browser.close()

assert len(checked) == 12
print({"passed": True, "files": len(checked), "rule": "one connected alpha component; no non-person alpha fragments"})
