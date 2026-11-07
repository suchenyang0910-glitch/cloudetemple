from __future__ import annotations

import base64
import json
from pathlib import Path

from playwright.sync_api import sync_playwright


ROOT = Path(__file__).resolve().parents[1]
IMAGES = ROOT / "assets" / "processed-v1" / "img"
VISITORS = ("short-light", "curly-dark", "curly-medium", "bun-light", "bun-dark", "ponytail-medium")


def data_url(path: Path) -> str:
    return "data:image/webp;base64," + base64.b64encode(path.read_bytes()).decode()


with sync_playwright() as pw:
    browser = pw.chromium.launch(headless=True)
    page = browser.new_page()
    report = []
    for visitor in VISITORS:
        for pose in ("sit", "beads"):
            source = IMAGES / f"visitor-{visitor}-{pose}.webp"
            result = page.evaluate(
                """async src => {
                  const image = new Image(); image.src = src; await image.decode();
                  const canvas = document.createElement('canvas'); canvas.width=image.width; canvas.height=image.height;
                  const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(image,0,0);
                  const pixels=ctx.getImageData(0,0,canvas.width,canvas.height),d=pixels.data,w=canvas.width,h=canvas.height,n=w*h;
                  const cut=new Uint8Array(n);
                  for(let y=Math.floor(h*.70);y<h;y++)for(let x=0;x<w;x++){
                    const p=y*w+x,i=p*4,r=d[i],g=d[i+1],b=d[i+2],a=d[i+3];
                    const skin=r>150&&g>70&&b<165&&r-g>45&&g-b>10;
                    if(a>5&&!skin&&r>100&&g>75&&b<190&&r>g*1.02&&g>b*1.03&&r-b>30)cut[p]=1;
                  }
                  for(let pass=0;pass<2;pass++){
                    const next=cut.slice();
                    for(let y=Math.floor(h*.69);y<h;y++)for(let x=1;x<w-1;x++){
                      const p=y*w+x;if(cut[p]||cut[p-1]||cut[p+1]||cut[p-w]||cut[p+w])next[p]=1;
                    }
                    cut.set(next);
                  }
                  for(let y=Math.floor(h*.895);y<h;y++)cut.fill(1,y*w,(y+1)*w);
                  for(let y=Math.floor(h*.79);y<h*.895;y++){
                    const t=(y/h-.79)/.105,half=w*(.40-.27*t);
                    for(let x=0;x<w;x++)if(Math.abs(x-w/2)>half)cut[y*w+x]=1;
                  }
                  for(let p=0;p<n;p++)if(cut[p])d[p*4+3]=0;
                  const seen=new Uint8Array(n),queue=new Int32Array(n),components=[];let largest=0;
                  for(let seed=0;seed<n;seed++){
                    if(seen[seed]||d[seed*4+3]===0)continue;
                    let head=0,tail=0,skin=0,minY=h;queue[tail++]=seed;seen[seed]=1;const pixels=[];
                    while(head<tail){const p=queue[head++];pixels.push(p);const x=p%w,y=Math.floor(p/w),i=p*4;minY=Math.min(minY,y);
                      if(d[i]>150&&d[i+1]>70&&d[i+2]<165&&d[i]-d[i+1]>45&&d[i+1]-d[i+2]>10)skin++;
                      for(const q of [p-w,p+w,x?p-1:-1,x<w-1?p+1:-1])if(q>=0&&q<n&&!seen[q]&&d[q*4+3]>0){seen[q]=1;queue[tail++]=q;}
                    }
                    components.push({pixels,skin,minY});largest=Math.max(largest,pixels.length);
                  }
                  const keep=new Uint8Array(n);for(const component of components)if(component.pixels.length===largest||component.skin>=8||component.minY<h*.72)for(const p of component.pixels)keep[p]=1;
                  for(let p=0;p<n;p++)if(!keep[p])d[p*4+3]=0;
                  const core=new Uint8Array(n);
                  for(let y=Math.floor(h*.68);y<h;y++)for(let x=0;x<w;x++){
                    const p=y*w+x,i=p*4,r=d[i],g=d[i+1],b=d[i+2],a=d[i+3];
                    const skin=a>220&&r>150&&g>70&&b<165&&r-g>45&&g-b>10;
                    const cloth=a>220&&r<175&&g<125&&b<105&&r-g>18&&g-b>6;
                    const shirt=a>220&&y<h*.76&&x>w*.22&&x<w*.78&&r>190&&g>165&&b>135&&r-g<45&&g-b<55;
                    if(skin||cloth||shirt)core[p]=1;
                  }
                  for(let y=Math.floor(h*.68);y<h;y++)for(let x=0;x<w;x++){const p=y*w+x;if(core[p])d[p*4+3]=255;else d[p*4+3]=0;}
                  seen.fill(0);let main=[];
                  for(let seed=0;seed<n;seed++){
                    if(seen[seed]||d[seed*4+3]===0)continue;
                    let head=0,tail=0;queue[tail++]=seed;seen[seed]=1;const component=[];
                    while(head<tail){const p=queue[head++];component.push(p);const x=p%w;
                      for(const q of [p-w,p+w,x?p-1:-1,x<w-1?p+1:-1])if(q>=0&&q<n&&!seen[q]&&d[q*4+3]>0){seen[q]=1;queue[tail++]=q;}
                    }
                    if(component.length>main.length)main=component;
                  }
                  const finalKeep=new Uint8Array(n);for(const p of main)finalKeep[p]=1;
                  for(let p=0;p<n;p++)if(!finalKeep[p])d[p*4+3]=0;
                  let bottom=0,opaque=0;for(let p=0;p<n;p++)if(d[p*4+3]){opaque++;bottom=Math.max(bottom,Math.floor(p/w));}
                  ctx.putImageData(pixels,0,0);
                  return {url:canvas.toDataURL('image/webp',.94),width:w,height:h,bottom,opaque};
                }""",
                data_url(source),
            )
            target = IMAGES / f"visitor-{visitor}-{pose}-nocushion.webp"
            target.write_bytes(base64.b64decode(result["url"].split(",", 1)[1]))
            assert result["bottom"] < result["height"] * .895, (target.name, result)
            report.append({"source": source.name, "output": target.name, **{k: result[k] for k in ("width", "height", "bottom", "opaque")}})
    browser.close()

(ROOT / "review" / "visitor-nocushion-report.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
print(json.dumps({"passed": True, "files": len(report), "maxBottom": max(item["bottom"] for item in report)}))
