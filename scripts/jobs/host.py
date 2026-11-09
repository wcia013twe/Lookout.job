"""JOB03/04 adapter backed by the existing COM Terra-medium subscription Session.

No participant inference in setup or preflight. No retries or participant repairs.
"""
import argparse,datetime,fcntl,hashlib,http.server,importlib.util,json,os,secrets,shutil,subprocess,sys,time,uuid
from pathlib import Path
LIB=Path(__file__).resolve().parent;REPO=LIB.parents[1]
sys.path.insert(0,str(LIB))
from transport import Bridge
from services import Services
from audit import clock_alignment
import clock_control
import isolated_backend
sys.path.insert(0,str(REPO/'scripts/communication'))
from diagnostics import call_metrics
sys.path.insert(0,str(REPO/'scripts/com2'))
spec=importlib.util.spec_from_file_location('job_com_session',REPO/'scripts/com2/runner.py');runtime=importlib.util.module_from_spec(spec);spec.loader.exec_module(runtime)
runtime.Bridge=Bridge
runtime.LIB=REPO/'scripts/com2' # Mount the existing credential-free MCP service client.

def read(p):return json.loads(Path(p).read_text())
def write(p,value):
 p=Path(p);p.write_text(json.dumps(value,indent=2)+'\n');p.chmod(0o600)
def digest(p):return hashlib.sha256(Path(p).read_bytes()).hexdigest()
def account(root,operation,*args,input=None):
 p=subprocess.run(['node',str(LIB/'account.mjs'),operation,str(root),*map(str,args)],input=json.dumps(input) if input is not None else None,text=True,capture_output=True,timeout=90)
 if p.returncode:
  if root.exists():write(root/('account-error-'+str(time.time_ns())+'.private.json'),{'operation':operation,'stderr':p.stderr,'stdout':p.stdout})
  raise RuntimeError('JOB account '+operation+' failed; private stderr retained')
 return json.loads(p.stdout)
def native(root,name,arguments={},read_only=False):return account(root,'call',input={'name':name,'arguments':arguments,'readOnly':read_only})
def native_initialize(root):
 import urllib.request
 a=read(root/'account.private.json');packet={'jsonrpc':'2.0','id':1,'method':'initialize','params':{'protocolVersion':'2025-06-18','capabilities':{},'clientInfo':{'name':'clock-contract','version':'1'}}}
 request=urllib.request.Request(a['mcpUrl'],data=json.dumps(packet).encode(),headers={'Authorization':'Bearer '+a['token'],'Content-Type':'application/json','Accept':'application/json, text/event-stream'})
 with urllib.request.urlopen(request,timeout=30) as response:reply=json.load(response)
 if reply.get('error'):raise ValueError('Native bootstrap unavailable')
 return reply['result']

def fixture_reference_contract(case,scenario):
 # Native terminal progress retires preparation blockers. Historical references
 # remain frozen; a prospective pair must reconcile this before execution.
 issues=[]
 if case=='JOB03':
  for stage,apps in scenario['expected'].items():
   for key,state in apps.items():
    if state.get('status') in ('submitted','interview','offer','rejected','withdrawn') and state.get('blocker'):
     issues.append({'stage':stage,'applicationKey':key,'issue':'terminal_reference_retains_preparation_blocker'})
 return {'aligned':not issues,'issues':issues,'historicalEvidenceChanged':False}

def collect_files(out):
 result={}
 for p in sorted(out.rglob('*')):
  if p.is_symlink():raise ValueError('Symlink output rejected')
  if p.is_file():
   if p.stat().st_size>2_000_000:raise ValueError('Output exceeds capture limit')
   result[str(p.relative_to(out))]=p.read_text()
 return result

def prepare(case,root,source,background,backend_root=None):
 if root.exists():raise ValueError('New private frozen root required')
 owned=root.with_name(root.name+'-owner')
 result=account(owned,'create',case,source,background/'resume.pdf',*([backend_root] if backend_root else []))
 a=read(owned/'account.private.json');clone=read(owned/'cloned-context.private.json')
 # Reuse COM's full-context parity renderer; do not manufacture a baseline profile file.
 import parity
 initial={'profileFacts':clone['settings']['profile']['facts'],'contacts':[]}
 onboarding,receipt=parity.complete_and_verify(owned,background,(background/'profile.md').read_text(),initial)
 files=[LIB/n for n in ['account.mjs','host.py','client.py','bridge.py','transport.py','services.py','preflight.mjs','audit.py']]+[REPO/'scripts/com2'/n for n in ['runner.py','service.py']]+[REPO/'scripts/n01/cost.py',REPO/'scripts/communication/runtime.py',REPO/'scripts/communication/diagnostics.py',REPO/'scripts/com2/parity.py']
 files += [REPO/'scripts/evals/workspace_transport.py',REPO/'scripts/communication/native_contract.py']
 if backend_root:
  files += [LIB/n for n in ['isolated_endpoint.mjs','isolated_backend.py','isolated_clock_database.py','virtual_clock.mjs','clock_control.py','clock_proxy.mjs','clock_node.mjs','clock-edge/index.ts']]
  descriptor=read(Path(backend_root)/'backend.json')
  files += [REPO/n for n in descriptor['sourceFiles']]
  files=list(dict.fromkeys(files))
 cfg={'benchmarkTaskId':case,'dedicated':True,'fictional':True,'ownerId':a['userId'],'readOnlyOwnerId':a['userId'],'source':'Dedicated local JOB host; matched intent; no proactive comparison','model':'gpt-5.6-terra','reasoning':'medium','hostVersion':'jobs-host-v3' if backend_root else 'jobs-host-v2','normalProductConfiguration':{'captured':True,'status':'captured','scheduledApplicationCommunicationEnabled':False},'runtimeFiles':[str(p) for p in files],'costPolicy':read(REPO/'examples/evals/cost-policy.json')}
 if case=='JOB04':cfg['applicationIdMapping']={x['id']:str(uuid.uuid5(uuid.UUID(a['userId']),x['id'])) for x in read(REPO/'examples/job04/evidence.json')['applications']}
 cfgpath=owned/'configuration.json';write(cfgpath,cfg)
 cmd=['node',str(REPO/'scripts'/case.lower()/'task.mjs'),'--action','prepare','--root',str(root),'--configuration',str(cfgpath)]
 if case=='JOB04':
  candidate=owned/'grader-candidate';candidate.mkdir();shutil.copyfile(background/'resume.pdf',candidate/'resume.pdf');(candidate/'profile.md').write_text(onboarding);(candidate/'profile.md').chmod(0o600)
  cmd+=['--candidate',str(candidate)]
 subprocess.run(cmd,check=True,capture_output=True,text=True)
 for name in ['account.private.json','grader.private.json','cloned-context.private.json','source-manifest.private.json']+(['resume-parity.json'] if backend_root else []):shutil.copyfile(owned/name,root/name);(root/name).chmod(0o600)
 (root/'account.lock').symlink_to(owned/'account.lock')
 (root/'background').mkdir();shutil.copyfile(background/'resume.pdf',root/'background/resume.pdf');(root/'background/resume.pdf').chmod(0o600)
 write(root/'context-parity.json',receipt);(root/'background/onboarding.md').write_text(onboarding);(root/'background/onboarding.md').chmod(0o600)
 fixture=read(root/('suite/evidence.json' if case=='JOB04' else 'suite/fixture.json'))
 apps=[]
 for i,(key,item) in enumerate(enumerate(fixture['applications']) if case=='JOB04' else fixture['jobs'].items()):
  ident=item['id'] if case=='JOB04' else str(uuid.uuid4());status='Submitted' if item.get('stage')=='submitted' or item.get('status')=='submitted' else 'Draft'
  apps.append({'key':str(key),'id':ident,'company':item['company'],'title':item['title'],'status':status,'draft':{'note':'Existing fictional application; no submission receipt.','blocker':item.get('blocker'),'initialSavedState':item}})
 write(root/'host-initial.json',apps)
 allowed=account(root,'surface')['names']
 write(root/'host-config.json',{'caseId':case,**({'backendRoot':str(Path(backend_root).resolve())} if backend_root else {}),'allowedTools':allowed,'runtimeImage':runtime.IMAGE,'developerVersion':read(REPO/'supabase/functions/agent-gateway/instructions.json')['developerVersion'],'guideVersions':{n:read(REPO/'supabase/functions/agent-gateway/skills'/f'{n}.json')['version'] for n in ['interview-preparation','toolkit-materials']}})
 if backend_root:
  binding=Path(backend_root)/'pilot-binding.json'
  if binding.exists():raise ValueError('Native backend already bound; use a fresh fixture')
  write(binding,{'pilotRoot':str(root.resolve()),'ownerId':a['userId'],'caseId':case})
 write(root/'adapter.json',[sys.executable,str(LIB/'client.py'),str(root)])
 image=runtime.command(['docker','image','inspect',runtime.IMAGE,'--format','{{.Id}}'],text=True).stdout.strip()
 frozen_files=['account.private.json','grader.private.json','cloned-context.private.json','source-manifest.private.json','context-parity.json','background/onboarding.md','background/resume.pdf','host-initial.json','host-config.json','adapter.json']
 if backend_root:frozen_files+=['resume-parity.json']
 external={}
 if backend_root:
  for name in ['database.json','backend.json','pilot-binding.json','api.private.env','edge.private.env','rest.private.env','backend.private.json']:
   p=Path(backend_root)/name;external[str(p)]=digest(p)
 write(root/'host-freeze.json',{'external':external,'files':{n:digest(root/n) for n in frozen_files},'runtime':{str(p):digest(p) for p in files},'imageId':image})
 print(json.dumps({'caseId':case,'prepared':True,'participantExecuted':False,'root':str(root)}))

class Host:
 def __init__(self,root):
  self.root=root;self.cfg=read(root/'host-config.json');self.case=self.cfg['caseId'];self.owner=read(root/'account.private.json')['userId'];self.sessions={};self.stage=0
  self.lock=(root/'account.lock').open('a');fcntl.flock(self.lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
  runtime.R=root;self.awake=runtime.ensure_awake();self.backend_lock=None
  if self.cfg.get('backendRoot'):
   self.backend_lock=(Path(self.cfg['backendRoot'])/'pilot.lock').open('a');fcntl.flock(self.backend_lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
 def verify(self):
  f=read(self.root/'host-freeze.json')
  for n,h in f['files'].items():
   if digest(self.root/n)!=h:raise ValueError('Frozen host input changed: '+n)
  for n,h in f.get('external',{}).items():
   if digest(n)!=h:raise ValueError('Frozen backend descriptor/config changed')
  for n,h in f['runtime'].items():
   if digest(n)!=h:raise ValueError('Frozen runtime changed: '+n)
  if self.cfg.get('backendRoot'):
   _,descriptor=isolated_backend.inspect(self.cfg['backendRoot'])
   binding=read(Path(self.cfg['backendRoot'])/'pilot-binding.json')
   if binding['pilotRoot']!=str(self.root.resolve()) or binding['ownerId']!=self.owner:raise ValueError('Native backend pilot ownership changed')
   for name,h in descriptor['sourceFiles'].items():
    if digest(REPO/name)!=h:raise ValueError('Native backend source changed')
  if runtime.command(['docker','image','inspect',runtime.IMAGE,'--format','{{.Id}}'],text=True).stdout.strip()!=f['imageId']:raise ValueError('Pinned image changed')
 def service(self,c):return Services(self.root/'host-runs'/c/'services.sqlite',read(self.root/'host-initial.json'))
 def snapshot(self,c):
  return {'native':account(self.root,'snapshot') if c=='lookout' else None,'files':collect_files(self.root/'host-runs'/c/'output'),'services':self.service(c).snapshot() if self.case=='JOB03' else None}
 def dispatch(self,req):
  if req.get('benchmarkTaskId')!=self.case or req.get('ownerId')!=self.owner:raise ValueError('Request owner/case mismatch')
  self.verify();op=req['operation'];c=req.get('condition')
  if op in ['condition.setup','participant.turn'] and (self.root/'host-control-failure.json').exists():raise ValueError('Prior participant container stop unconfirmed; no further participant may start')
  clock_receipt=None
  if op=='participant.turn':
   if self.cfg.get('backendRoot'):
    packet=req['packet'];now=packet.get('now') or (datetime.datetime.fromisoformat(read(self.root/'suite/scenario.json')['epoch'])+datetime.timedelta(minutes=packet['minute'])).isoformat()
    begin=time.monotonic()
    clock_receipt=clock_control.move(self.cfg['backendRoot'],now) if c=='lookout' else {'requestedAt':now,'condition':'baseline','clockMode':'shared_local_services_and_explicit_business_time','nativeTaskReads':0}
    clock_receipt['harnessSeconds']=time.monotonic()-begin
   else:
    alignment=clock_alignment(read(self.root/'suite/scenario.json'),account(self.root,'snapshot')['capturedAt'])
    if not alignment['aligned']:raise ValueError('Native backend clock differs from simulated stages; new pair blocked')
  if op=='host.preflight':return self.preflight()
  if c not in ['baseline','lookout']:raise ValueError('Condition required')
  run=self.root/'host-runs'/c;out=run/'output';inputs=run/'live-inputs'
  if op=='condition.setup':
   if run.exists():raise ValueError('Condition already attempted; no retry')
   inputs.mkdir(parents=True);out.mkdir();account(self.root,'seed')
   if self.case=='JOB03':self.service(c).seed(read(self.root/'suite/fixture.json')['jobs'])
   write(run/'sources.json',{'releasedStageIds':[],'events':[]})
   return {'status':'ready','initial':self.snapshot(c)}
  if op in ['baseline.final_files','native.readonly_confirmation'] and c in self.sessions:self.sessions.pop(c)[1].close()
  if op in ['snapshot','baseline.final_files']:return self.snapshot(c)
  if op=='native.readonly_confirmation':
   calls=[{'name':'read_personal_context','value':native(self.root,'read_personal_context',read_only=True)},{'name':'list_artifacts','value':native(self.root,'list_artifacts',read_only=True)}]
   for app in read(self.root/'host-initial.json'):calls.append({'name':'read_application_record','applicationId':app['id'],'value':native(self.root,'read_application_record',{'applicationId':app['id']},True)})
   return {'status':'confirmed','semanticMatchReviewed':False,'readOnly':True,'calls':calls,'snapshot':self.snapshot(c)}
  if op=='application.arm_failure':return self.service(c).arm(req['failure']['applicationId'],req['failure']['eventKey'])
  if op=='reminder.wake':return {'notifications':self.service(c).deliver(req['now'])}
  if op!='participant.turn':raise ValueError('Unsupported host operation')
  packet=req['packet'];stage=packet['stage'];self.stage+=1
  sd=run/f'stage-{self.stage}';sd.mkdir();
  if clock_receipt:write(sd/'clock.json',clock_receipt)
  sources=read(run/'sources.json');sources['releasedStageIds'].append(stage)
  events=packet.get('events',[])+([packet['input']['source']] if packet.get('input',{}).get('source') else [])
  sources['events']+=events;write(run/'sources.json',sources);write(inputs/'sources.json',sources);shutil.copyfile(self.root/'background/resume.pdf',inputs/'resume.pdf')
  # Only released evidence enters /inputs; no scenario, grader, host config or future data.
  if self.case=='JOB04':write(inputs/'role-sources.json',packet['sources'])
  session_id=packet['session'];existing=self.sessions.get(c);resume=existing is not None and existing[0]==session_id
  if existing and not resume:existing[1].close();del self.sessions[c]
  setup_started=time.monotonic()
  if not resume:self.sessions[c]=(session_id,runtime.Session(sd,inputs,out,c,session_id))
  setup_seconds=time.monotonic()-setup_started
  prompt=packet['orientation']+'\n'+packet.get('permissions',packet.get('authority',''))+'\nYour resume is /inputs/resume.pdf. Released evidence is /inputs/sources.json; files in /workspace/output persist. Use ask_user for necessary questions.\n'
  if self.case=='JOB03':prompt+='Reminders use the shared local schedule_reminder/read_reminders/cancel_reminder service. Saved fictional previews use preview_saved_application; these never access an employer.\n'
  if self.stage==1 or len(sources['releasedStageIds'])==1:
   prompt+='Existing applications:\n'+json.dumps(read(self.root/'host-initial.json'))+'\n'
   if c=='baseline':prompt+=(self.root/'background/onboarding.md').read_text()+'\n'
  now=packet.get('now')
  if not now:now=(datetime.datetime.fromisoformat(read(self.root/'suite/scenario.json')['epoch'])+datetime.timedelta(minutes=packet['minute'])).isoformat()
  prompt+='Current time: '+now+'\n'+(packet.get('prompt') or packet.get('input',{}).get('message',''))
  if req.get('notification'):prompt+='\nCurrent reminders: '+json.dumps(req['notification'])
  runtime.inputs_prompt=lambda *_:prompt
  wall_started=time.time();monotonic_started=time.monotonic()
  sm=self.sessions[c][1].turn(sd,{'_index':self.stage,'_session':session_id,'seconds':req['budgetSeconds']},resume)
  if sm.get('hostControlFailed'):write(self.root/'host-control-failure.json',{'condition':c,'stage':stage,'termination':sm.get('termination'),'participantRetry':False})
  timing={'wallSeconds':time.time()-wall_started,'monotonicSeconds':time.monotonic()-monotonic_started,'executorSeconds':sm['durationSeconds'],'budgetSeconds':req['budgetSeconds']}
  timing['wallMinusMonotonicSeconds']=timing['wallSeconds']-timing['monotonicSeconds']
  timing.update(sm.get('timing',{}));timing['wallBudgetExceeded']=timing['wallSeconds']>req['budgetSeconds']+5
  write(sd/'timing.json',timing)
  trace=[json.loads(x) for x in (sd/'trace.jsonl').read_text().splitlines()];tools=[json.loads(x) for x in (sd/'lookout-trace.jsonl').read_text().splitlines()];interactions=[x['data'] for x in tools if x['type']=='user.interaction']
  return {'status':'execution_failed' if sm['status']=='artifact_failed' else sm['status'],'participantRuntimeStatus':sm['status'],'hostControlFailed':sm.get('hostControlFailed',False),'termination':sm.get('termination'),'participantExecuted':True,'synthetic':False,'session':session_id,'resume':resume,'trace':trace,'toolTrace':tools,'actualPrompt':(sd/'prompt.txt').read_text(),'actualPromptSha256':digest(sd/'prompt.txt'),'files':collect_files(out),'interactions':interactions,'cost':sm['cost'],'usage':{'schemaVersion':1,'scope':'participant_turn','basis':'turn_delta','receiptId':str(uuid.uuid4()),'source':sm['cost'].get('source'),'model':sm['cost'].get('model'),'status':sm['cost'].get('status'),'tokens':sm['cost'].get('tokens')},'clock':clock_receipt,'timing':timing,'executionSeconds':sm.get('executionSeconds',sm['durationSeconds']),'containerStartupSeconds':setup_seconds,'mcpDiagnostics':call_metrics([sd]),'isolation':{'futureEvidenceVisible':False,'graderVisible':False,'credentialsVisible':False,'note':'Host credentials absent; subscription credential is available to the container runtime in ephemeral tmpfs as in COM.'}}
 def preflight(self):
  # Actual no-model Session construction checks auth, mounts and MCP forwarding.
  root=self.root;spec=read(root/'suite/scenario.json');(root/'receipts').mkdir(exist_ok=True);out=root/'receipts'/('host-'+uuid.uuid4().hex[:8]);out.mkdir();gates=[]
  def gate(name,fn):
   value=fn();write(out/(name+'.json'),value);gates.append({'name':name,'status':'passed','path':str(out/(name+'.json')),'sha256':digest(out/(name+'.json'))})
  if self.cfg.get('backendRoot'):
   first=spec['stages'][0]
   initial=first.get('at') or (datetime.datetime.fromisoformat(spec['epoch'])+datetime.timedelta(minutes=first['minute'])).isoformat()
   clock_control.restore_preflight(self.cfg['backendRoot'],root,initial)
  gate('native_owner_snapshot',lambda:account(root,'snapshot'))
  gate('context_parity',lambda:{'receipt':read(root/'context-parity.json'),'nativeOwner':native(root,'read_personal_context',read_only=True)['settings']['profile']['user_id']})
  developer=native(root,'read_developer_context')
  if developer.get('developerVersion')!=self.cfg['developerVersion']:raise ValueError('Native developer guidance differs from frozen source')
  guides={n:native(root,'read_guide',{'id':n}) for n in self.cfg['guideVersions']}
  if any(guides[n].get('version')!=v for n,v in self.cfg['guideVersions'].items()):raise ValueError('Native guide version differs from frozen source')
  gate('native_guidance',lambda:{'developerVersion':developer['developerVersion'],'guides':guides})
  gate('native_audit_contract',lambda:account(root,'audit_probe'))
  account(root,'seed');app=read(root/'host-initial.json')[0]['id'];artifact=str(uuid.uuid4())
  try:
   payload={'id':artifact,'expectedVersion':0,'title':'Readiness fixture','purpose':'No-model writer probe','kind':'notes','format':'markdown','body':'Fictional saved preparation','sources':[],'links':[{'applicationId':app}]}
   saved=native(root,'save_artifact',payload);reread=native(root,'read_artifact',{'id':artifact},True)
   if 'Fictional saved preparation' not in json.dumps(reread):raise ValueError('Artifact readback mismatch')
   gate('artifact_write_readback',lambda:{'saved':saved,'readOnlyReadback':reread})
   if self.cfg.get('backendRoot'):gate('native_scope_permissions',lambda:account(root,'permission_probe',input={'applicationId':app}))
   milestone=native(root,'record_application_milestone',{'applicationId':app,'eventKey':str(uuid.uuid4()),'kind':'recruiter_call','label':'Fictional readiness screen','phase':'scheduled','occurredAt':'2026-11-12T10:00:00-05:00','timeZone':'America/New_York','source':{'kind':'email','messageId':'readiness-only','subject':'Fictional readiness screen','excerpt':'November 12 at 10 AM America/New_York.','receivedAt':'2026-11-09T14:00:00Z','timestampConfirmed':True}})
   application=native(root,'read_application_record',{'applicationId':app},True)
   if 'readiness-only' not in json.dumps(application):raise ValueError('Milestone readback missing')
   gate('pipeline_write_readback',lambda:{'saved':milestone,'readOnlyReadback':application})
  finally:account(root,'seed')
  gate('restored_initial',lambda:account(root,'snapshot'))
  for c in ['baseline','lookout']:
   run=out/c;inputs=run/'live-inputs';inputs.mkdir(parents=True);output=run/'output';output.mkdir();sd=run/'stage-1';sd.mkdir();write(inputs/'sources.json',{'events':[],'releasedStageIds':[]});session=None
   try:
    session=runtime.Session(sd,inputs,output,c,'no-inference')
    def call(msg):
     request=__import__('urllib.request',fromlist=['Request']).Request(session.bridge.url.replace('host.docker.internal','127.0.0.1'),data=json.dumps(msg).encode(),headers={'Authorization':'Bearer '+session.bridge.key,'Content-Type':'application/json'})
     with __import__('urllib.request',fromlist=['urlopen']).urlopen(request,timeout=100) as response:return json.load(response)
    # DNS/TLS only: never request a generation, send auth, or substitute a model.
    probe="import socket,ssl,json,time; t=time.monotonic(); addresses=socket.getaddrinfo('chatgpt.com',443); sock=socket.create_connection(('chatgpt.com',443),timeout=10); tls=ssl.create_default_context().wrap_socket(sock,server_hostname='chatgpt.com'); print(json.dumps({'dns':bool(addresses),'tls':tls.version(),'seconds':time.monotonic()-t,'participantExecuted':False})); tls.close()"
    gate(c+'_inference_transport',lambda:json.loads(runtime.command(['docker','exec',session.name,'python3','-c',probe],text=True,timeout=20).stdout))
    init=call({'jsonrpc':'2.0','id':1,'method':'initialize','params':{'protocolVersion':'2025-06-18','capabilities':{},'clientInfo':{'name':'workspace','version':'1'}}});listed=call({'jsonrpc':'2.0','id':2,'method':'tools/list','params':{}})
    if init.get('error') or listed.get('error'):raise ValueError('Native initialization/list failed')
    names={t['name'] for t in listed['result']['tools']}
    if c=='lookout':
     bootstrap=native_initialize(self.root)
     if init['result'].get('instructions')!=bootstrap.get('instructions'):raise ValueError('Native startup instructions changed in bridge')
    if c=='lookout' and not {'discover_tools','call_discovered_tool'}<=names:raise ValueError('Native discovery missing')
    if c=='baseline' and names & set(self.cfg['allowedTools']):raise ValueError('Baseline has native tools')
    if c=='lookout':
     discovered=call({'jsonrpc':'2.0','id':3,'method':'tools/call','params':{'name':'discover_tools','arguments':{'workflow':'all'}}})
     if discovered.get('error') or discovered.get('result',{}).get('isError'):raise ValueError('Native schema discovery failed')
     data=discovered['result'].get('structuredContent')
     if data is None:data=json.loads(next(x['text'] for x in discovered['result']['content'] if x['type']=='text'))
     data=data.get('data',data);schemas={x['name'] for x in data['tools']}|names
     if set(self.cfg['allowedTools'])-schemas:raise ValueError('Required native tools unavailable: '+','.join(sorted(set(self.cfg['allowedTools'])-schemas)))
     denied=call({'jsonrpc':'2.0','id':4,'method':'tools/call','params':{'name':'call_discovered_tool','arguments':{'name':'save_profile_facts','arguments':{'facts':{},'expectedUpdatedAt':None}}}})
     if not denied.get('result',{}).get('isError'):raise ValueError('Wrapper escaped native scope')
     gate('scoped_native_discovery',lambda:{'discovery':discovered,'deniedWrapper':denied})
    gate(c+'_container_surface',lambda:{'initialize':init,'tools':listed,'isolation':read(sd/'isolation.json')})
   finally:
    if session:session.close()
  if self.case=='JOB03':
   service=Services(out/'test-clock.sqlite');r=service.schedule('probe','A','2026-11-18T14:00:00Z','America/New_York');assert service.schedule('probe','A',r['dueAt'],r['timeZone'])['duplicate'];assert not service.deliver('2026-11-18T13:59:59Z');assert len(service.deliver(r['dueAt']))==1;assert not service.deliver(r['dueAt']);r=service.schedule('cancel','C',r['dueAt'],r['timeZone']);service.cancel(r['reminderId']);assert not service.deliver(r['dueAt']);gate('shared_test_clock',service.snapshot)
   service=Services(out/'preview.sqlite');service.seed({'B':{'preparation':{'completedFields':['name','email'],'pendingField':'earliest-start-date'}}})
   service.arm('B','preview-timeout');assert service.preview('B')['status']=='preview_timeout';assert Services(service.file).preview('B',{'earliest-start-date':'2027-01-19'})['status']=='prepared';gate('interruption_recovery',service.snapshot)
   apps=read(root/'host-initial.json');mapped=Services(out/'identifier-mapping.sqlite',apps);mapped.seed(read(root/'suite/fixture.json')['jobs'])
   bid=next(x['id'] for x in apps if x['key']=='B');aid=next(x['id'] for x in apps if x['key']=='A')
   mapped.arm(bid,'mapped-timeout');assert mapped.preview('B')['status']=='preview_timeout';assert mapped.preview(bid,{'earliest-start-date':'2027-01-19'})['status']=='prepared'
   by_id=mapped.schedule('mapped-A',aid,r['dueAt'],r['timeZone']);by_key=mapped.schedule('mapped-A','A',r['dueAt'],r['timeZone']);assert by_key['duplicate'] and by_key['reminderId']==by_id['reminderId'] and by_id['applicationId']=='A'
   gate('shared_application_identifiers',lambda:{'keyAndIdSameState':True,'snapshot':mapped.snapshot(),'nativeEmployerFormSeeded':False,'previewStateIsSharedFictionalService':True})
  if self.cfg.get('backendRoot'):
   clocks=[]
   try:
    for stage in spec['stages']:
     at=stage.get('at') or (datetime.datetime.fromisoformat(spec['epoch'])+datetime.timedelta(minutes=stage['minute'])).isoformat()
     clocks.append({'stage':stage['id'],**clock_control.move(self.cfg['backendRoot'],at)})
    alignment={'aligned':all(x['aligned'] for x in clocks),'stages':clocks,'nativeTaskReads':0,'clockMode':'ticking_isolated_backend'}
   finally:
    clock_control.restore_preflight(self.cfg['backendRoot'],root,initial);account(root,'seed')
   gate('resume_byte_parity',lambda:read(root/'resume-parity.json'))
   gate('native_backend_identity',lambda:{'root':self.cfg['backendRoot'],'ownerId':self.owner,'clockMode':'ticking_isolated_backend','edgeModulePayloadSha256':read(Path(self.cfg['backendRoot'])/'backend.json').get('edgeModulePayloadSha256')})
  else:alignment=clock_alignment(read(root/'suite/scenario.json'),account(root,'snapshot')['capturedAt'])
  gate('native_clock_alignment',lambda:alignment)
  if not alignment['aligned']:gates[-1]['status']='blocked'
  reference=fixture_reference_contract(self.case,spec)
  gate('fixture_reference_contract',lambda:reference)
  if not reference['aligned']:gates[-1]['status']='blocked'
  return {'participantExecuted':False,'ready':alignment['aligned'] and reference['aligned'],'gates':gates,'model':'gpt-5.6-terra','reasoning':'medium','imageId':read(root/'host-freeze.json')['imageId'],'limitations':['No inference/model availability verified until participant launch.','Fictional local services do not establish real employer access or product scheduling.']}
 def close(self):
  for _,session in self.sessions.values():session.close()
  fcntl.flock(self.lock,fcntl.LOCK_UN);self.lock.close()
  if self.backend_lock:fcntl.flock(self.backend_lock,fcntl.LOCK_UN);self.backend_lock.close()

def main():
 p=argparse.ArgumentParser();p.add_argument('action',choices=['prepare','serve']);p.add_argument('--root',type=Path,required=True);p.add_argument('--case',choices=['JOB03','JOB04']);p.add_argument('--source-manifest',type=Path);p.add_argument('--background',type=Path);p.add_argument('--backend',type=Path);a=p.parse_args();root=a.root.resolve()
 if a.action=='prepare':prepare(a.case,root,a.source_manifest,a.background,a.backend);return
 host=Host(root);host.verify();key=secrets.token_urlsafe(32)
 class Handler(http.server.BaseHTTPRequestHandler):
  def log_message(self,*args):pass
  def do_POST(self):
   if self.headers.get('Authorization')!='Bearer '+key:self.send_error(403);return
   try:
    length=int(self.headers.get('Content-Length','0'))
    if not 0<length<1000000:raise ValueError('Invalid request length')
    raw=self.rfile.read(length);request=json.loads(raw);result=host.dispatch(request)
    result.update(requestHash=hashlib.sha256(raw.rstrip(b'\n')).hexdigest(),receiptId=str(uuid.uuid4()),capturedAt=datetime.datetime.now(datetime.timezone.utc).isoformat(),ownerId=host.owner)
    response=json.dumps(result).encode();self.send_response(200);self.send_header('Content-Type','application/json');self.send_header('Content-Length',str(len(response)));self.end_headers();self.wfile.write(response)
   except Exception as e:
    write(root/'receipts'/('host-error-'+str(time.time_ns())+'.json'),{'operation':locals().get('request',{}).get('operation'),'errorType':type(e).__name__,'error':str(e),'participantRescued':False});self.send_error(500,'JOB host failure; inspect private receipt')
 server=http.server.HTTPServer(('127.0.0.1',0),Handler);write(root/'host.private.json',{'url':'http://127.0.0.1:'+str(server.server_port),'key':key});print(json.dumps({'host':'ready','caseId':host.case,'root':str(root)}),flush=True)
 try:server.serve_forever()
 finally:server.server_close();host.close()
if __name__=='__main__':main()
