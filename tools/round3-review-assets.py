from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
import shutil,json
root=Path(__file__).resolve().parents[1];src=Path(r'C:\Users\Administrator\.codex\generated_images\01a1a9ec-08f5-7ef3-bdb2-c714c0c81ab4');out=root/'review/beads-v1';out.mkdir(exist_ok=True)
files={'bead-wood-v1':'exec-c4e0e6aa-bf0c-403d-9363-1a6766f6b131.png','bead-spacer-v1':'exec-943925ff-b6a0-48fc-9628-d47c9952513f.png','bead-guru-v1':'exec-3b45ba07-f33e-4e6d-b1ee-4a23ad4dba01.png'}
for name,file in files.items():
 shutil.copy2(src/file,out/(name+'-original.png'));im=Image.open(src/file).convert('RGBA');im=im.crop(im.getchannel('A').point(lambda a:255 if a>32 else 0).getbbox());im.thumbnail((160,200),Image.Resampling.LANCZOS);im.save(out/(name+'.webp'),'WEBP',quality=84,method=6);assert (out/(name+'.webp')).stat().st_size<20000
sheet=Image.new('RGB',(900,600));d=ImageDraw.Draw(sheet)
for row,color in enumerate(['#f1e9dc','#292923']):
 d.rectangle((0,row*300,900,(row+1)*300),fill=color)
 for col,name in enumerate(files):
  im=Image.open(out/(name+'.webp')).convert('RGBA');sheet.paste(im,(col*300+(300-im.width)//2,row*300+40),im);d.text((col*300+40,row*300+260),name,fill='#6a5842' if row==0 else '#e6ddcc')
sheet.save(root/'screenshots/round3/beads-review-light-dark.png')
def contacts(phase):
 folder=root/'screenshots/round3'/phase
 for width in [393,375]:
  for period in ['dawn','day','dusk','night']:
   files=sorted(folder.glob(f'{width}-{period}-*.png'))
   if not files:continue
   sheet=Image.new('RGB',(980,((len(files)+6)//7)*250),'#eee8dc');d=ImageDraw.Draw(sheet)
   for i,file in enumerate(files):
    im=Image.open(file);im.thumbnail((136,225));x=(i%7)*140;y=(i//7)*250;sheet.paste(im,(x,y));d.text((x,y+227),file.stem.removeprefix(f'{width}-{period}-'),fill='#222')
   sheet.save(folder/f'contact-{width}-{period}.jpg',quality=85)
if __name__=='__main__':contacts('before')
