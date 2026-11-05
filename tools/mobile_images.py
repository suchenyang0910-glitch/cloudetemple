from pathlib import Path
from PIL import Image
import json
root=Path(__file__).resolve().parents[1]/'assets/processed-v1'
out=root/'mobile';out.mkdir(exist_ok=True)
records=[]
for source in sorted((root/'img').glob('scene-vn-*.webp')):
    im=Image.open(source).convert('RGB');im=im.resize((720,round(im.height*720/im.width)),Image.Resampling.LANCZOS)
    dest=out/source.name
    for quality in range(85,29,-5):
        im.save(dest,'WEBP',quality=quality,method=6)
        if dest.stat().st_size<=120000:break
    assert dest.stat().st_size<=120000,source
    records.append(dict(name=source.name,original=source.stat().st_size,mobile=dest.stat().st_size,width=720,height=im.height,quality=quality))
(out/'measurements.json').write_text(json.dumps(records,indent=2),encoding='utf-8')
print(json.dumps(records,indent=2))
