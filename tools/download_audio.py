import urllib.request,json
from pathlib import Path
rows=json.loads(Path('audio/raw/source-check.json').read_text())
for r in rows:
 assert any(r['expectedLicense'] in x for x in r['licenses']), 'LICENSE CHANGED: '+r['name']
 url=next(x for x in r['previews'] if x.startswith('https://cdn.freesound.org/') and x.endswith('-hq.mp3'))
 target=Path('audio/raw/'+r['name']+'.mp3')
 if not target.exists(): urllib.request.urlretrieve(url,target)
 print(r['name'],target.stat().st_size,flush=True)
