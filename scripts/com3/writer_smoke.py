"""Reversible dedicated-owner writer roundtrip. Not read-only, not participant execution."""
import argparse,fcntl,json,subprocess,sys,time,uuid
from pathlib import Path
import runner,capture
p=argparse.ArgumentParser();p.add_argument('--task-dir',type=Path,required=True);p.add_argument('--output',type=Path,required=True);a=p.parse_args()
runner.configure(a.task_dir)
if a.output.exists():raise SystemExit('Preserve earlier smoke receipts')
a.output.mkdir(mode=0o700,parents=True);out=a.output;lock=(runner.R/'account.lock').open('a');fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
inputs=out/'live-inputs';inputs.mkdir();(inputs/'sources.json').write_text('{"calendar":[],"inbox":[]}');sd=out/'stage-1';sd.mkdir();(out/'active-stage.json').write_text('{"stage":1}')
proc=None;calls=[];report={'participantExecuted':False,'readOnly':False,'taskId':'COM3','ownerId':json.loads((runner.R/'grader.private.json').read_text())['userId'],'startedAt':time.time()}
def call(name,args={}):
 mid=len(calls)+1;proc.stdin.write(json.dumps({'jsonrpc':'2.0','id':mid,'method':'tools/call','params':{'name':name,'arguments':args}})+'\n');proc.stdin.flush();response=json.loads(proc.stdout.readline())
 calls.append({'tool':name,'ok':not response.get('error') and not response.get('result',{}).get('isError')})
 if not calls[-1]['ok']:
  (out/'failed-response.private.json').write_text(json.dumps(response,indent=2)+'\n');raise RuntimeError('Scoped roundtrip rejected: '+name)
 result=response['result'];value=result.get('structuredContent')
 if value is None:value=next(json.loads(x['text']) for x in result.get('content',[]) if x.get('type')=='text')
 return value.get('data',value) if isinstance(value,dict) else value
try:
 runner.snapshot(out/'before-reset.json');runner.command(['node',str(runner.R/'reset.mjs')]);runner.snapshot(out/'baseline.json');runner.validate_initial(out/'baseline.json')
 proc=subprocess.Popen([sys.executable,str(Path(__file__).with_name('bridge.py')),'--root',str(runner.R),'--capture',str(sd/'lookout-trace.jsonl'),'--condition','lookout','--inputs',str(inputs)],stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=(out/'bridge-stderr.log').open('w'),text=True)
 # tools/list verifies actual deployed schema discovery through the same bridge participants use.
 proc.stdin.write(json.dumps({'jsonrpc':'2.0','id':0,'method':'tools/list','params':{}})+'\n');proc.stdin.flush();schemas=json.loads(proc.stdout.readline());(out/'schemas.private.json').write_text(json.dumps(schemas,indent=2)+'\n')
 if schemas.get('error'):raise RuntimeError('Actual tool schema discovery failed')
 initial=json.loads((runner.S/'initial-state.json').read_text());app=initial['applications'][0]['id']
 context=call('read_personal_context');assert context['settings']['profile']['user_id']==report['ownerId']
 call('read_application_record',{'applicationId':app});call('list_contacts')
 # New person draft, then genuine list read-back; no claims of sending.
 cid='smoke-contact';record={'contact':'Readiness Person','company':'Linden Systems','status':'Not contacted','subject':'Availability','message':'Tuesday 2–4 PM or Wednesday 10 AM–noon Eastern works for me.'}
 call('save_contact',{'id':cid,'record':record,'expectedRevision':0});people=call('list_contacts')
 if cid not in json.dumps(people):raise RuntimeError('Contact read-back absent')
 artifact=str(uuid.uuid4());call('list_artifacts',{})
 call('save_artifact',{'id':artifact,'expectedVersion':0,'title':'Communication draft','purpose':'Application communication, unsent','kind':'notes','format':'markdown','body':'Earliest start date: January 19, 2027. Unsent.','sources':[],'links':[{'applicationId':app}]})
 saved=call('read_artifact',{'id':artifact})
 if 'January 19' not in json.dumps(saved):raise RuntimeError('Artifact content not read back')
 company='smoke-company'
 call('save_company_workspace',{'id':company,'record':{'name':'Linden Systems','website':'https://linden.example.test','research':'Source-backed team notes; no hiring guarantee.','priority':'Strong Consider','interest':'','targetTeams':'','concerns':'','nextAction':'','followUpDate':'','sources':[],'archived':False,'contactIds':[cid],'applicationIds':[app]},'expectedRevision':0})
 companies=call('list_company_workspaces',{})
 if company not in json.dumps(companies):raise RuntimeError('Company read-back absent')
 # Capture actual native state with a separate read-only credential, after terminal no-model marker.
 (out/'output').mkdir();(out/'output/readiness.md').write_text('Synthetic writer readiness; no model ran.')
 meta={'episodeId':out.name,'ownerId':report['ownerId'],'condition':'lookout','status':'completed','participantEndedAt':time.time()};(out/'run.json').write_text(json.dumps(meta));runner.snapshot(out/'final-state.json');capture.capture(out,runner.R)
 report['writerRoundtripsVerified']=True;report['readOnlyTerminalCaptureVerified']=True
finally:
 if proc:proc.terminate();proc.wait(timeout=10)
 try:
  runner.command(['node',str(runner.R/'reset.mjs')]);runner.snapshot(out/'restored.json');runner.validate_initial(out/'restored.json');report['restored']=True
 except Exception as error:report['restored']=False;report['restoreError']=type(error).__name__
 report['calls']=calls;report['completedAt']=time.time();(out/'receipt.json').write_text(json.dumps(report,indent=2)+'\n')
 for f in out.rglob('*'):
  if f.is_file():f.chmod(0o600)
 fcntl.flock(lock,fcntl.LOCK_UN);lock.close()
print(json.dumps({'output':str(out),'writerRoundtripsVerified':report.get('writerRoundtripsVerified',False),'restored':report.get('restored',False),'participantExecuted':False}))
if not report.get('restored'):raise SystemExit(1)
