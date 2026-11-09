"""Read-only live connectivity/isolation check. No inference, reset or personal writes."""
import argparse,json,urllib.request,time
from pathlib import Path
import runner
p=argparse.ArgumentParser();p.add_argument('--task-dir',type=Path,required=True);p.add_argument('--output',type=Path,required=True);a=p.parse_args()
runner.configure(a.task_dir);suite,image=runner.verify()
if a.output.exists():raise SystemExit('Retain existing preflight evidence; choose new output')
a.output.mkdir(mode=0o700,parents=True)
inputs=a.output/'live-inputs';inputs.mkdir();(inputs/'sources.json').write_text('{"calendar":[],"inbox":[]}')
out=a.output/'output';out.mkdir();report={'suiteHash':suite,'imageId':image,'inferenceExecuted':False,'domainWrites':False,'conditions':{}}
for condition in ['baseline','lookout']:
 sd=a.output/condition;sd.mkdir();session=None
 try:
  session=runner.Session(sd,inputs,out,condition,'preflight')
  req=urllib.request.Request(session.bridge.url.replace("host.docker.internal","127.0.0.1"),data=json.dumps({'jsonrpc':'2.0','id':1,'method':'tools/list','params':{}}).encode(),headers={'Authorization':'Bearer '+session.bridge.key,'Content-Type':'application/json'})
  with urllib.request.urlopen(req,timeout=100) as r:response=json.load(r)
  if response.get('error'):raise RuntimeError('Tool schema discovery failed')
  names={t['name'] for t in response['result']['tools']}
  if not {'read_calendar','read_inbox','ask_user'}<=names:raise RuntimeError('Local tools missing')
  if condition=='baseline' and names!={'read_calendar','read_inbox','ask_user'}:raise RuntimeError('Baseline has native context tools')
  if condition=='lookout' and not set(runner.CONFIG['allowedTools'])<=names:raise RuntimeError('Native tools missing')
  report['conditions'][condition]={'subscriptionLogin':True,'tools':sorted(names),'hostIsolationChecked':True}
 finally:
  if session:session.close()
(a.output/'verification.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps({'verified':True,'inferenceExecuted':False,'output':str(a.output)}))
