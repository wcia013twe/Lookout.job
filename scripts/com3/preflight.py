"""Read-only live connectivity/isolation check. No inference, reset or retained personal writes; writer probe rolls back."""
import argparse,json,urllib.request,time
from pathlib import Path
import runner
p=argparse.ArgumentParser();p.add_argument('--task-dir',type=Path,required=True);p.add_argument('--output',type=Path,required=True);a=p.parse_args()
runner.configure(a.task_dir);suite,image=runner.verify()
if a.output.exists():raise SystemExit('Retain existing preflight evidence; choose new output')
a.output.mkdir(mode=0o700,parents=True)
runner.snapshot(a.output/'owner-state.json') # Read-only owner assignment and required-table check.
inputs=a.output/'live-inputs';inputs.mkdir();(inputs/'sources.json').write_text('{"calendar":[],"inbox":[]}')
out=a.output/'output';out.mkdir();report={'suiteHash':suite,'imageId':image,'inferenceExecuted':False,'domainWrites':False,'contactWriterProbe':'passed_rolled_back','conditions':{}}
for condition in ['baseline','lookout']:
 sd=a.output/condition;sd.mkdir();session=None
 try:
  session=runner.Session(sd,inputs,out,condition,'preflight')
  req=urllib.request.Request(session.bridge.url.replace("host.docker.internal","127.0.0.1"),data=json.dumps({'jsonrpc':'2.0','id':1,'method':'tools/list','params':{}}).encode(),headers={'Authorization':'Bearer '+session.bridge.key,'Content-Type':'application/json'})
  with urllib.request.urlopen(req,timeout=100) as r:response=json.load(r)
  if response.get('error'):raise RuntimeError('Tool schema discovery failed')
  names={t['name'] for t in response['result']['tools']}
  if not {'read_calendar','read_inbox','ask_user','search_sources','read_source'}<=names:raise RuntimeError('Local tools missing')
  if condition=='baseline' and names!={'read_calendar','read_inbox','ask_user','search_sources','read_source'}:raise RuntimeError('Baseline has native context tools')
  if condition=='lookout':
   if not {'discover_tools','call_discovered_tool'}<=names:raise RuntimeError('Native discovery tools missing')
   def request(message):
    req=urllib.request.Request(session.bridge.url.replace('host.docker.internal','127.0.0.1'),data=json.dumps(message).encode(),headers={'Authorization':'Bearer '+session.bridge.key,'Content-Type':'application/json'})
    with urllib.request.urlopen(req,timeout=100) as response:return json.load(response)
   init=request({'jsonrpc':'2.0','id':2,'method':'initialize','params':{'protocolVersion':'2025-06-18','capabilities':{},'clientInfo':{'name':'preflight','version':'1'}}})
   if init.get('error') or not init.get('result',{}).get('instructions'):raise RuntimeError('Native startup unavailable')
   discovered=request({'jsonrpc':'2.0','id':3,'method':'tools/call','params':{'name':'discover_tools','arguments':{'workflow':'all'}}})
   if discovered.get('error') or discovered.get('result',{}).get('isError'):raise RuntimeError('Native discovery failed')
   value=discovered['result'].get('structuredContent')
   if value is None:value=json.loads(next(b['text'] for b in discovered['result']['content'] if b['type']=='text'))
   value=value.get('data',value)
   if not set(runner.CONFIG['allowedTools'])<=names|{t['name'] for t in value['tools']}:raise RuntimeError('Required scoped tools missing')
  report['conditions'][condition]={'subscriptionLogin':True,'tools':sorted(names),'hostIsolationChecked':True}
 finally:
  if session:session.close()
(a.output/'verification.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps({'verified':True,'inferenceExecuted':False,'output':str(a.output)}))
