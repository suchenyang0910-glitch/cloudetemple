import urllib.request,re,json
from pathlib import Path
sources=[('bell','tec_studio',668647,'zero/1.0'),('keisu','milivolt',367128,'by/4.0'),('mo','the_very_Real_Horst',205999,'by/4.0'),('ambient-courtyard','kevp888',578503,'by/4.0'),('ambient-rain','TSP-Talk',846307,'zero/1.0')]
rows=[]
for name,author,id,license in sources:
 url=f'https://freesound.org/people/{author}/sounds/{id}/'
 try:
  html=urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':'Mozilla/5.0'})).read().decode()
  matches=sorted(set(re.findall(r'https?[^\s"<>]+(?:mp3|ogg)',html)))
  licenses=sorted(set(re.findall(r'https?://creativecommons.org/[^\s"<>]+',html)))
  print(name,licenses,matches[:6],flush=True)
  Path('audio/raw/'+name+'-source.html').write_text(html,encoding='utf-8')
  rows.append({'name':name,'author':author,'url':url,'expectedLicense':license,'licenses':licenses,'previews':matches})
 except Exception as e: print(name,type(e).__name__,str(e),flush=True)
Path('audio/raw/source-check.json').write_text(json.dumps(rows,indent=2),encoding='utf-8')
