"""One bound request to the already running private JOB host. No retries."""
import json,sys,urllib.request
from pathlib import Path
root=Path(sys.argv[1]);service=json.loads((root/'host.private.json').read_text())
request=urllib.request.Request(service['url'],data=sys.stdin.buffer.read(),headers={'Content-Type':'application/json','Authorization':'Bearer '+service['key']})
with urllib.request.urlopen(request,timeout=350) as response:sys.stdout.write(response.read().decode())
