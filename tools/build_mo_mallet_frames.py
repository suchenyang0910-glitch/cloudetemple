from pathlib import Path
from PIL import Image

ROOT=Path(__file__).resolve().parents[1]
IMG=ROOT/'assets/processed-v1/img'
VISITORS=['short-light','curly-dark','curly-medium','bun-light','bun-dark','ponytail-medium']
SIZE=(166,159)
ANCHOR=(320,440)
PIVOT=(round(SIZE[0]*.88),round(SIZE[1]*.86))
ANGLES={1:5,2:15,3:5}

mallet=Image.open(IMG/'mo-mallet.webp').convert('RGBA').resize(SIZE,Image.Resampling.LANCZOS)
for visitor in VISITORS:
 base=Image.open(IMG/f'visitor-{visitor}-mo-base-v2.webp').convert('RGBA')
 for frame,angle in ANGLES.items():
  layer=Image.new('RGBA',base.size)
  layer.alpha_composite(mallet,(ANCHOR[0]-PIVOT[0],ANCHOR[1]-PIVOT[1]))
  layer=layer.rotate(-angle,Image.Resampling.BICUBIC,center=ANCHOR)
  layer.alpha_composite(base)
  layer.save(IMG/f'visitor-{visitor}-mo-{frame}-v3.webp','WEBP',lossless=True,method=6)

print(f'generated {len(VISITORS)*len(ANGLES)} integrated mallet frames')
