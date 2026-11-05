"""Public CC0 preview only; stop if the license changes. No credentials."""
from pathlib import Path
import urllib.request,re,json,subprocess
root=Path(__file__).resolve().parents[1];raw=root/'audio/raw';raw.mkdir(exist_ok=True)
url='https://freesound.org/people/Sadiquecat/sounds/789008/'
html=urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':'Mozilla/5.0'})).read().decode()
licenses=sorted(set(re.findall(r'https?://creativecommons.org/[^\s"<>]+',html)))
assert any('publicdomain/zero/1.0' in x for x in licenses),'License changed: manual review required'
preview=re.findall(r'https?[^\s"<>]+hq\.mp3',html)[0]
urllib.request.urlretrieve(preview,raw/'bead-v1-preview.mp3')
(raw/'bead-v1-source.json').write_text(json.dumps({'url':url,'author':'Sadiquecat','licenses':licenses,'preview':preview},indent=2),encoding='utf-8')
for ext,codec in [('mp3','libmp3lame'),('m4a','aac')]:
 dest=root/'assets/audio'/f'bead-v1.{ext}'
 subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-ss','0.895','-i',str(raw/'bead-v1-preview.mp3'),'-t','0.15','-af','afade=t=in:d=0.002,afade=t=out:st=0.10:d=0.05,volume=3.6dB','-ar','44100','-ac','1','-c:a',codec,'-b:a','64k','-y',str(dest)],check=True)
 assert dest.stat().st_size<=30000
