"""Phone-oriented EQ on the retained lossless edits; never replace v1 recordings."""
import json, re, subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
def run(args):
    return subprocess.run(['ffmpeg', '-hide_banner', '-nostdin', *args], capture_output=True, text=True, check=True).stderr
def measure(path):
    log = run(['-i', str(path), '-af', 'loudnorm=I=-18:TP=-1.5:LRA=11:print_format=json', '-f', 'null', '-'])
    return json.loads(re.findall(r'\{[^{}]+\}', log)[-1])

rows=[]
for name in ['bell', 'keisu']:
    source=ROOT/'audio/raw/processed'/f'{name}-edit.wav'
    eq='highpass=f=140,equalizer=f=1800:t=q:w=0.8:g=3'
    edited=ROOT/'audio/raw/processed'/f'{name}-v2-eq.wav'
    run(['-y','-i',str(source),'-af',eq,str(edited)])
    stats=measure(edited)
    # Preserve the bell decay; static gain avoids loudnorm's dynamic gain pumping.
    gain=min(-17-float(stats['input_i']), -2-float(stats['input_tp']))
    norm=f'volume={gain}dB'
    for ext, codec in [('mp3','libmp3lame'),('m4a','aac')]:
        out=ROOT/'assets/audio'/f'{name}-v2.{ext}'
        run(['-y','-i',str(edited),'-af',norm,'-ac','1','-ar','44100','-c:a',codec,'-b:a','64k',str(out)])
        result=measure(out)
        assert out.stat().st_size < 100000
        assert float(result['input_tp']) < -1
        rows.append(dict(file=out.name,bytes=out.stat().st_size,LUFS=float(result['input_i']),truePeakDb=float(result['input_tp']),EQ=eq))
(ROOT/'assets/audio/measurements-v2.json').write_text(json.dumps(rows,indent=2)+'\n')
print(json.dumps(rows,indent=2))
