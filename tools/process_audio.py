from pathlib import Path
import subprocess,json,re
root=Path(__file__).resolve().parents[1];raw=root/'audio/raw';out=root/'assets/audio';out.mkdir(parents=True,exist_ok=True)
work=raw/'processed';work.mkdir(exist_ok=True)
def run(args):return subprocess.run(['ffmpeg','-hide_banner','-nostdin','-y']+args,stdout=subprocess.PIPE,stderr=subprocess.PIPE,check=True).stderr.decode(errors='replace')
def measure(path):
 log=run(['-i',str(path),'-af','loudnorm=I=-18:TP=-1:LRA=11:print_format=json','-f','null','-']);return json.loads(re.findall(r'\{[^{}]+\}',log)[-1])
records=[]
for name,start,duration in [('bell',0,8),('keisu',.046,4),('mo',1.664,.4),('ambient-courtyard',10,60),('ambient-rain',30,60)]:
 own=sorted(raw.glob(name+'-own*')) if name in ['mo','keisu'] else []
 originals=[p for p in raw.glob(name+'.*') if p.suffix.lower() in ['.wav','.flac','.mp3']]
 originals.sort(key=lambda p:p.suffix!='.wav');src=own[0] if own else originals[0]
 if own:raise SystemExit('Self recording found: audition and set its onset before processing '+str(src))
 tmp=work/(name+'-edit.wav')
 if duration==60:
  graph='[0:a]aformat=channel_layouts=mono,asplit=3[m][t][h];[m]atrim=2:60,asetpts=PTS-STARTPTS[mid];[t]atrim=60:62,asetpts=PTS-STARTPTS[tail];[h]atrim=0:2,asetpts=PTS-STARTPTS[head];[tail][head]acrossfade=d=2:c1=tri:c2=tri[seam];[mid][seam]concat=n=2:v=0:a=1[out]'
  run(['-ss',str(start),'-t','62','-i',str(src),'-filter_complex',graph,'-map','[out]','-ar','44100','-c:a','pcm_f32le',str(tmp)])
 else:
  fade=min(.8,duration*.2)
  filters=f'aformat=channel_layouts=mono,afade=t=out:st={duration-fade}:d={fade}'
  if name=='bell':filters+=',afade=t=in:d=0.01'
  if name=='mo':filters+=',acompressor=threshold=0.04:ratio=12:attack=0.01:release=40:makeup=2,alimiter=limit=0.15:attack=0.1:release=20:level=false'
  run(['-ss',str(start),'-t',str(duration),'-i',str(src),'-af',filters,'-ar','44100','-c:a','pcm_f32le',str(tmp)])
 target=-24 if duration==60 else -18
 log=run(['-i',str(tmp),'-af',f'loudnorm=I={target}:TP=-1.5:LRA=11:print_format=json','-f','null','-']);m=json.loads(re.findall(r'\{[^{}]+\}',log)[-1])
 filt=f"loudnorm=I={target}:TP=-1.5:LRA=11:measured_I={m['input_i']}:measured_TP={m['input_tp']}:measured_LRA={m['input_lra']}:measured_thresh={m['input_thresh']}:offset={m['target_offset']}:linear=true"
 for ext,codec in [('m4a','aac'),('mp3','libmp3lame')]:
  dest=out/(name+'.'+ext);run(['-i',str(tmp),'-af',filt,'-ac','1','-ar','44100','-c:a',codec,'-b:a','64k',str(dest)])
  actual=measure(dest)
  correction=min(target-float(actual['input_i']),-1.5-float(actual['input_tp']))
  if abs(correction)>.15:
   run(['-i',str(tmp),'-af',filt+f',volume={correction}dB','-ac','1','-ar','44100','-c:a',codec,'-b:a','64k',str(dest)]);actual=measure(dest)
  probe=json.loads(subprocess.check_output(['ffprobe','-v','error','-show_format','-show_streams','-of','json',str(dest)]))
  size=dest.stat().st_size;seconds=float(probe['format']['duration']);assert size<=(500000 if duration==60 else 100000);assert abs(seconds-duration)<.12;assert float(actual['input_tp'])<=-1
  rec={'file':dest.name,'source':src.name,'start':start,'duration':seconds,'bytes':size,'LUFS':float(actual['input_i']),'truePeakDb':float(actual['input_tp']),'channels':probe['streams'][0]['channels']};records.append(rec);print(rec,flush=True)
(out/'measurements.json').write_text(json.dumps(records,indent=2),encoding='utf-8')
