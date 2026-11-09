"""Reversible dedicated-owner writer roundtrip. Not read-only, not participant execution."""
import argparse,fcntl,json,subprocess,sys,time,uuid
from pathlib import Path
import runner,capture
p=argparse.ArgumentParser();p.add_argument('--task-dir',type=Path,required=True);p.add_argument('--output',type=Path,required=True);a=p.parse_args()
runner.configure(a.task_dir)
if a.output.exists():raise SystemExit('Preserve earlier smoke receipts')
a.output.mkdir(mode=0o700,parents=True);out=a.output;lock=(runner.R/'account.lock').open('a');fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
inputs=out/'live-inputs';inputs.mkdir();(inputs/'sources.json').write_text('{"calendar":[],"inbox":[]}');sd=out/'stage-1';sd.mkdir();(out/'active-stage.json').write_text('{"stage":1}')
proc=None;calls=[];report={'participantExecuted':False,'readOnly':False,'taskId':'COM2','ownerId':json.loads((runner.R/'grader.private.json').read_text())['userId'],'startedAt':time.time()}
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
 initial=json.loads((runner.S/'initial-state.json').read_text())
 toolkit=call('read_toolkit_context')
 candidates=toolkit.get('applications',[])
 target=initial['applications'][0]
 matches=[x for x in candidates if x.get('job_id')==target['jobId']]
 if len(matches)!=1:raise RuntimeError('Application cannot be rediscovered through scoped toolkit')
 app=matches[0]['id']
 if app!=target['id']:raise RuntimeError('Rediscovered application mismatch')
 context=call('read_personal_context');assert context['settings']['profile']['user_id']==report['ownerId']
 call('read_application_record',{'applicationId':app});call('read_application_timeline',{'applicationId':app})
 for seeded in initial['contacts']:
  people=call('list_contacts')
  rows=people if isinstance(people,list) else people.get('contacts',[])
  found=next(x for x in rows if x['id']==seeded['id'])
  writable=dict(seeded['record']);writable['message']=writable.get('message','')+' Native roundtrip probe.'
  call('save_contact',{'id':seeded['id'],'record':writable,'expectedRevision':found['revision']})
  people=call('list_contacts');rows=people if isinstance(people,list) else people.get('contacts',[])
  found=next(x for x in rows if x['id']==seeded['id'])
  if found.get('message',found.get('record',{}).get('message'))!=writable['message']:raise RuntimeError('Seeded contact write/read mismatch')
 report['exactSeededContactsRoundtripped']=len(initial['contacts']);report['applicationRediscovered']=True
 # New person draft, then genuine list read-back; no claims of sending.
 cid='smoke-contact';record={'contact':'Readiness Person','company':'Alder Systems','status':'Not contacted','subject':'Availability','message':'Tuesday 2–4 PM or Wednesday 10 AM–noon Eastern works for me.'}
 call('save_contact',{'id':cid,'record':record,'expectedRevision':0});people=call('list_contacts')
 if cid not in json.dumps(people):raise RuntimeError('Contact read-back absent')
 artifact=str(uuid.uuid4());call('list_artifacts',{})
 call('save_artifact',{'id':artifact,'expectedVersion':0,'title':'Communication draft','purpose':'Application communication, unsent','kind':'notes','format':'markdown','body':'Earliest start date: January 19, 2027. Unsent.','sources':[],'links':[{'applicationId':app}]})
 saved=call('read_artifact',{'id':artifact})
 if 'January 19' not in json.dumps(saved):raise RuntimeError('Artifact content not read back')
 source={'kind':'email','messageId':'smoke-confirm','subject':'Confirmed screen','excerpt':'November 17 at 2:30 PM Eastern.','receivedAt':'2026-11-16T16:10:00Z','timestampConfirmed':True}
 event=call('record_application_milestone',{'applicationId':app,'eventKey':str(uuid.uuid4()),'kind':'recruiter_call','label':'Confirmed recruiter screen','phase':'scheduled','occurredAt':'2026-11-17T14:30:00-05:00','source':source,'timeZone':'America/New_York'})
 # Verify native storage, not just a successful response.
 runner.snapshot(out/'after-writes.json');tables=json.loads((out/'after-writes.json').read_text())['tables'];milestone=tables['application_milestones'][0]
 call('record_application_milestone',{'applicationId':app,'eventKey':str(uuid.uuid4()),'kind':'recruiter_call','label':'Replacement recruiter screen','phase':'scheduled','occurredAt':'2026-11-18T10:30:00-05:00','supersedesId':milestone['id'],'source':{**source,'messageId':'smoke-reschedule','excerpt':'Replacement November 18 at 10:30 AM Eastern.'},'timeZone':'America/New_York'})
 call('read_application_record',{'applicationId':app});runner.snapshot(out/'after-replacement.json')
 latest=json.loads((out/'after-replacement.json').read_text())['tables']['application_milestones'];assert any(x.get('supersedes_id')==milestone['id'] for x in latest)
 replacement=next(x for x in latest if x.get('supersedes_id')==milestone['id'])
 call('record_application_milestone',{'applicationId':app,'eventKey':str(uuid.uuid4()),'kind':'recruiter_call','label':'User reported screen completion','phase':'completed','occurredAt':None,'supersedesId':replacement['id'],'source':{'kind':'user_reported','note':'I finished the recruiter screen this morning.'}})
 call('record_application_milestone',{'applicationId':app,'eventKey':str(uuid.uuid4()),'kind':'technical_round','label':'Technical interview confirmed','phase':'scheduled','occurredAt':'2026-11-23T11:00:00-05:00','source':{**source,'messageId':'smoke-technical','excerpt':'Technical interview November 23 at 11 AM Eastern.'},'round':{'stage':'INTERVIEW','type':'technical'},'timeZone':'America/New_York'})
 runner.snapshot(out/'before-cancel.json');technical=next(x for x in json.loads((out/'before-cancel.json').read_text())['tables']['application_milestones'] if x['kind']=='technical_round')
 call('record_application_milestone',{'applicationId':app,'eventKey':str(uuid.uuid4()),'kind':'technical_round','label':'Technical interview cancelled by recruiter','phase':'received','occurredAt':None,'supersedesId':technical['id'],'source':{**source,'messageId':'smoke-closed','excerpt':'Your application was rejected and technical interview cancelled.'},'round':{'stage':'INTERVIEW','type':'technical','cancelled':True}})
 call('record_application_milestone',{'applicationId':app,'eventKey':str(uuid.uuid4()),'kind':'rejected','label':'Recruiter rejected application','phase':'received','occurredAt':None,'source':{**source,'messageId':'smoke-closed','excerpt':'Your application was rejected and technical interview cancelled.'}})
 call('read_application_record',{'applicationId':app});runner.snapshot(out/'after-terminal-writes.json')
 terminal=json.loads((out/'after-terminal-writes.json').read_text())['tables'];assert any(x['source']['kind']=='user_reported' for x in terminal['application_milestones']);assert any(x['kind']=='rejected' for x in terminal['application_milestones']);assert any(x.get('round',{}).get('cancelled') is True for x in terminal['application_milestones'] if x.get('round'))

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
