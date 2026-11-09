"""Private coordinator for ordinary recruiting sessions; no evaluation metadata is mounted."""
import datetime
import argparse,fcntl,hashlib,json,os,shutil,subprocess,sys,threading,time,uuid
from pathlib import Path
from transport import Bridge
from capture import capture
LIB=Path(__file__).resolve().parent; CONTROL=LIB.parent
R=LIB;S=R/'suite';RUNS=R/'runs';CONFIG={};TASK='';IMAGE='lookout-benchmark:0.164.0'
TERMINAL={'completed','execution_failed','timed_out','setup_failed','artifact_failed'}
def write(p,v):p.write_text(json.dumps(v,indent=2)+'\n');p.chmod(0o600)
def command(args,**kw):
 kw.setdefault("timeout",120)
 return subprocess.run(args,check=True,capture_output=True,**kw)
def digest(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def file_hashes(root):
 result={}
 for p in sorted(root.rglob('*')):
  if p.is_symlink():raise RuntimeError('Symlink artifact rejected')
  if p.is_file():
   if p.stat().st_size>20_000_000:raise RuntimeError('Artifact exceeds 20MB')
   result[str(p.relative_to(root))]=digest(p)
 return result

def verify():
 lock=json.loads((R/'freeze.json').read_text())
 for name,value in lock['files'].items():
  if digest(R/name)!=value:raise RuntimeError('Frozen file changed: '+name)
 for name,value in lock['background'].items():
  if digest(R/'background'/name)!=value:raise RuntimeError('Frozen background changed')
 image=command(['docker','image','inspect',IMAGE,'--format','{{.Id}}'],text=True).stdout.strip()
 if image!=lock['imageId']:raise RuntimeError('Container image changed')
 return digest(R/'freeze.json'),image

def snapshot(p):command(['node',str(R/'snapshot.mjs'),str(p)])
def validate_initial(p):
 tables=json.loads(p.read_text())['tables'];original=json.loads((R/'cloned-context.private.json').read_text())['settings']
 if not all(isinstance(x,list) for x in tables.values()):raise RuntimeError('Snapshot incomplete')
 if len(tables['profiles'])!=1 or tables['profiles'][0]['facts']!=json.loads((S/'initial-state.json').read_text())['profileFacts']:raise RuntimeError('Starting profile mismatch')
 def semantic(row):return {k:v for k,v in row.items() if k!='updated_at'}
 if [semantic(x) for x in tables['preferences']]!=[semantic(original['preferences'])] or sorted(tables['resumes'],key=lambda x:x['id'])!=sorted(original['resumes'],key=lambda x:x['id']) or tables['answer_library']!=original['answers']:raise RuntimeError('Protected personal context differs')
 actual={x['id']:x['record'] for x in tables['outreach_contacts'] if not x.get('deleted_at')}
 expected={x['id']:x['record'] for x in json.loads((S/'initial-state.json').read_text())['contacts']}
 if actual!=expected:raise RuntimeError('Starting contacts mismatch')
 initial=json.loads((S/'initial-state.json').read_text())
 expected_apps={x['id']:x for x in initial['applications']}
 actual_apps={x['id']:x for x in tables['applications']}
 if set(actual_apps)!=set(expected_apps):raise RuntimeError('Starting applications mismatch')
 for aid,wanted in expected_apps.items():
  actual=actual_apps[aid]
  if actual['status']!=wanted['status'] or actual['receipt'] is not None or actual['draft']!=wanted['draft'] or actual['job_id']!=wanted['jobId']:raise RuntimeError('Application provenance/state mismatch')
 if tables['application_milestones'] or tables['career_artifacts'] or tables['approvals']:raise RuntimeError('Unexpected starting native work')

class Session:
 def __init__(self,run,inputs,out,condition,label):
  self.name='career-session-'+uuid.uuid4().hex[:10];self.bridge=None;self.thread_id=None;self.condition=condition
  self.auth=json.loads((Path.home()/'.codex/auth.json').read_text())
  if self.auth.get('OPENAI_API_KEY') or not self.auth.get('tokens'):raise RuntimeError('Subscription-only auth required')
  try:
   self.bridge=Bridge(run,R,condition)
   args=['docker','create','--name',self.name,'--read-only','--cap-drop','ALL','--security-opt','no-new-privileges','--pids-limit','256','--memory','2g','--cpus','2','--tmpfs','/tmp:rw,nosuid,nodev,size=256m','--tmpfs','/root/.codex:rw,nosuid,nodev,size=128m','--mount',f'type=bind,source={inputs},target=/inputs,readonly','--mount',f'type=bind,source={out},target=/workspace/output','--mount',f'type=bind,source={LIB}/service.py,target=/service.py,readonly']
   if self.bridge:args+=['-e','WORKSPACE_SERVICE_URL='+self.bridge.url,'-e','WORKSPACE_SERVICE_KEY='+self.bridge.key]
   command(args+[IMAGE,'sleep','infinity']);command(['docker','start',self.name])
   command(['docker','exec','-i',self.name,'python3','-c',"import sys,os; p='/root/.codex/auth.json'; open(p,'wb').write(sys.stdin.buffer.read()); os.chmod(p,0o600)"],input=json.dumps(self.auth).encode())
   login=command(['docker','exec',self.name,'codex','login','status'],text=True)
   if 'Logged in using ChatGPT' not in login.stdout+login.stderr:raise RuntimeError('Subscription login unavailable')
   paths=[str(R),str(Path.home()/'.agents'),'/Volumes/External SSD/Lookout/app','/var/run/docker.sock']
   visible=json.loads(command(['docker','exec',self.name,'python3','-c','import os,json; print(json.dumps({p:os.path.exists(p) for p in '+repr(paths)+'}))'],text=True).stdout)
   if any(visible.values()):raise RuntimeError('Unexpected host path visible')
   write(run/'isolation.json',{'session':label,'hostPathsVisible':visible,'mounts':json.loads(command(['docker','inspect',self.name,'--format','{{json .Mounts}}'],text=True).stdout),'auth':'Subscription credential in ephemeral container tmpfs, readable by runtime; no host config/history copied. Network remains available for inference.'})
  except Exception:self.close();raise
 def close(self):
  subprocess.run(['docker','rm','-f',self.name],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,timeout=30)
  if self.bridge:self.bridge.close();self.bridge=None
 def turn(self,stage_dir,stage,resume=False):
  cmd=['docker','exec','-i',self.name,'codex','--no-daemon','--ask-for-approval','never','exec']
  if resume:
   if not self.thread_id:raise RuntimeError('Stage 1 supplied no session ID; cannot resume')
   cmd+=['resume',self.thread_id,'-c','sandbox_mode="danger-full-access"']
  else:cmd+=['--sandbox','danger-full-access','--cd','/workspace']
  cmd+=['--ignore-user-config','--ignore-rules','--skip-git-repo-check','--json','--model','gpt-5.6-terra','-c','model_reasoning_effort="medium"','-c','project_doc_max_bytes=0','-c','skills.bundled.enabled=false','-c','web_search="disabled"']
  for feature in ['apps','plugins','remote_plugin','memories','multi_agent','skill_search']:cmd+=['--disable',feature]
  if self.bridge:cmd+=['-c','mcp_servers.workspace.command="python3"','-c','mcp_servers.workspace.args=["/service.py"]','-c','mcp_servers.workspace.env_vars=["WORKSPACE_SERVICE_URL","WORKSPACE_SERVICE_KEY"]']
  # Resume only adjacent turns bearing the same frozen session ID.
  write(stage_dir.parent/'active-stage.json',{'stage':stage['_index']})
  (stage_dir/'lookout-trace.jsonl').touch(exist_ok=True)
  prompt=(inputs_prompt(stage,self.condition))
  (stage_dir/'prompt.txt').write_text(prompt)
  meta={'stage':stage['_index'],'session':stage['_session'],'resumed':resume,'status':'running','startedAt':time.time(),'budgetSeconds':stage['seconds'],'command':cmd};write(stage_dir/'stage-run.json',meta)
  expired=threading.Event();usage=None;events=0
  with (stage_dir/'stderr.log').open('w') as errors:
   proc=subprocess.Popen(cmd+['-'],stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=errors,text=True)
   def stop():
    if proc.poll() is None:expired.set();subprocess.run(['docker','kill',self.name],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,timeout=30)
   timer=threading.Timer(stage['seconds'],stop);timer.start()
   try:
    proc.stdin.write(prompt);proc.stdin.close()
    with (stage_dir/'trace.jsonl').open('w') as trace:
     for line in proc.stdout:
      events+=1
      try:e=json.loads(line)
      except ValueError:e={'type':'unparsed','text':line}
      if e.get('type')=='thread.started':
       tid=e.get('thread_id')
       if resume and tid!=self.thread_id:raise RuntimeError('Resume unexpectedly changed session')
       self.thread_id=tid
      if e.get('usage'):usage=e['usage']
      if e.get('item',{}).get('type')=='reasoning':e={'type':e.get('type'),'item':{'type':'reasoning','content':'not captured'}}
      raw=json.dumps(e)
      for token in [*self.auth['tokens'].values(),self.bridge.key if self.bridge else None]:
       if isinstance(token,str) and token:raw=raw.replace(token,'[REDACTED]')
      trace.write(json.dumps({'sequence':events,'capturedAt':time.time(),'event':json.loads(raw)})+'\n');trace.flush()
    code=proc.wait()
   finally:
    timer.cancel()
    if proc.poll() is None:stop();proc.wait(timeout=30)
  meta.update(status='timed_out' if expired.is_set() else 'completed' if code==0 else 'execution_failed',exitCode=code,threadId=self.thread_id,durationSeconds=time.time()-meta['startedAt'],usage=usage)
  write(stage_dir/'stage-run.json',meta);return meta

def run(condition,repeat,pair_id,pilot=False):
 suite_hash,image=verify();RUNS.mkdir(exist_ok=True)
 lock=(R/'account.lock').open('a');fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
 existing=[json.loads(x.read_text()) for x in RUNS.glob('*/run.json')]
 if any(x.get('taskId')==TASK and x.get('pairId')==pair_id and x.get('condition')==condition for x in existing):raise RuntimeError('This pair/condition already has an attempt; use a new pair ID for a separately reported attempt')
 run=RUNS/f'{TASK}-{condition}-r{repeat}-{uuid.uuid4().hex[:8]}';run.mkdir(mode=0o700);out=run/'output';out.mkdir();inputs=run/'live-inputs';inputs.mkdir()
 meta={'ownerId':json.loads((R/'account.private.json').read_text())['userId'],'episodeId':run.name,'taskId':TASK,'version':CONFIG['version'],'scenarioDigest':hashlib.sha256(json.dumps(json.loads((S/'scenario.json').read_text()),sort_keys=True,separators=(',',':')).encode()).hexdigest(),'condition':condition,'repeat':repeat,'pairId':pair_id,'pilot':pilot,'measured':not pilot,'suiteHash':suite_hash,'imageId':image,'status':'starting','model':'gpt-5.6-terra','reasoning':'medium','budgetSeconds':sum(x['seconds'] for x in packets()),'startedAt':time.time(),'stages':[]};write(run/'run.json',meta)
 session=None
 try:
  snapshot(run/'before-reset.json');command(['node',str(R/'reset.mjs')]+[v.replace('{task}',TASK) for v in CONFIG.get('resetArgs',[])]);snapshot(run/'initial-state.json');validate_initial(run/'initial-state.json')
  # No harness-created baseline profile or native/local mirror.
  previous_session=None
  for stage in packets():
   i=stage['_index'];sd=run/f'stage-{i}';sd.mkdir();(sd/'inputs').mkdir()
   if stage['kind']=='final_reconciliation':
    snapshot(run/'prefinal-state.json');capture(run,R,'prefinal')
   for p in inputs.iterdir():p.unlink()
   shutil.copyfile(R/'background'/'resume.pdf',inputs/'resume.pdf')
   (inputs/'workspace.md').write_text((S/'contract.md').read_text())
   # User messages travel through stdin only, never as a persistent input file.
   # The metadata packet, future requests, model/budget and condition never enter the container.
   visible=released_sources(packets()[:i])
   write(inputs/'sources.json',visible)
   for name in CONFIG.get('publicFiles',[]):shutil.copyfile(S/name,inputs/Path(name).name)
   for p in inputs.iterdir():shutil.copyfile(p,sd/'inputs'/p.name)
   # Private receipt used only by external graders; not copied into live-inputs.
   write(sd/'inputs/stage.json',{k:v for k,v in stage.items() if not k.startswith('_')})
   write(sd/'input-hashes.json',file_hashes(inputs));snapshot(sd/'before-state.json')
   resume=stage['_session']==previous_session
   if not resume:
    if session:session.close()
    session=Session(sd,inputs,out,condition,stage['_session'])
   previous_session=stage['_session']
   meta['status']='running';write(run/'run.json',meta)
   record={'stage':i,'eventId':stage['id'],'kind':stage['kind'],'releasedMinute':stage['minute'],'triggerMinute':stage['minute'],'assignedInitiation':condition=='baseline' and stage['kind']=='external','assignedOnboarding':stage['kind']=='onboarding','necessaryUserUpdate':stage['kind']=='user_update'}
   write(sd/'delivery.json',record)
   sm=session.turn(sd,stage,resume=resume);meta['stages'].append(sm)
   snapshot(sd/'after-state.json');hashes=file_hashes(out);shutil.copytree(out,sd/'output');write(sd/'output-hashes.json',hashes)
   write(run/'run.json',meta)
   print(json.dumps({'run':str(run),'stage':i,'status':sm['status']}),flush=True)
   if sm['status']!='completed':meta['status']=sm['status'];break
   # No outcome parsing or semantic grading between stages; bad saved work carries forward.
  else:meta['status']='completed'
 except Exception as e:
  meta.update(status='setup_failed',errorType=type(e).__name__,error=str(e)[:400]);raise
 finally:
  if session:session.close()
  meta['participantEndedAt']=time.time()
  try:snapshot(run/'final-state.json');meta['finalStateCaptured']=True
  except Exception:meta['finalStateCaptured']=False
  meta['durationSeconds']=time.time()-meta['startedAt'];write(run/'run.json',meta)
  try:capture(run,R)
  except Exception as error:
   meta['terminalCaptureError']=type(error).__name__+': '+str(error);meta['status']='artifact_failed';write(run/'run.json',meta)
  for p in run.rglob('*'):
   if p.is_file() and not p.is_symlink():p.chmod(0o600)
  fcntl.flock(lock,fcntl.LOCK_UN);lock.close()
 print(json.dumps({'run':str(run),'status':meta['status']}),flush=True)
 return run

def configure(root,task=None):
 global R,S,RUNS,CONFIG,TASK
 R=Path(root).resolve();CONFIG=json.loads((R/'runtime-config.json').read_text());TASK=task or CONFIG['taskId']
 S=R/'suite'/TASK if CONFIG.get('suiteByTask') else R/'suite';RUNS=R/'runs'
 if not (S/'initial-state.json').exists():raise RuntimeError('Unknown task suite')
 if CONFIG.get('version')!='COM3-stream-v1' or CONFIG.get('taskId')!='COM3':raise RuntimeError('Wrong runtime configuration')
 account=json.loads((R/'account.private.json').read_text())
 if account.get('benchmarkTaskId')!='COM3':raise RuntimeError('Dedicated COM3 account receipt required')

def released_sources(stages):
 inbox={};calendar={};deliveries=[]
 for stage in stages:
  current={'eventId':stage['id'],'inboxIds':[],'calendarIds':[]}
  for message in stage.get('inbox',[]):
   key=message['id']
   if key in inbox and inbox[key]!=message:raise RuntimeError('Inbox ID collision with different content: '+key)
   inbox[key]=message;current['inboxIds'].append(key)
  for event in stage.get('calendar',[]):
   key=event['id']
   if key in calendar and calendar[key]!=event:raise RuntimeError('Calendar ID collision with different content: '+key)
   calendar[key]=event;current['calendarIds'].append(key)
  deliveries.append(current)
 return {'inbox':list(inbox.values()),'calendar':list(calendar.values()),'currentNotifications':deliveries[-1] if deliveries else {},'notificationHistory':deliveries,'calendarMeaning':'Released historical calendar evidence. Older invitations and reminders are not assertions of current status; reconcile email updates and revisions.'}

def inputs_prompt(stage,condition):
 # Transport/infrastructure instructions only, no standing career goal or evaluator contract.
 prefix='Your resume is /inputs/resume.pdf. Earlier released emails and historical calendar evidence remain available through tools and /inputs/sources.json; currentNotifications identifies this turn’s deliveries and notificationHistory retains duplicates. Use ask_user for questions requiring an answer. Do not inspect credentials/runtime configuration, browse live sites, send messages, submit applications. '
 storage = ('Lookout is your persistent recruiting workspace. Use its tools to retrieve relevant personal context and recruiting records, and save meaningful updates, drafts, and next steps there. Local files in /workspace/output may hold temporary working notes. Preserve unrelated information and verify saved changes. ' if condition=='lookout' else 'Your workspace files in /workspace/output persist across sessions. You may use them to retain relevant context, drafts, and next steps. ')
 prefix += storage+'Current workspace time: '+(datetime.datetime.fromisoformat(json.loads((S/'scenario.json').read_text())['origin'].replace('Z','+00:00'))+datetime.timedelta(minutes=stage['minute'])).isoformat()+'. This business clock governs deadlines rather than container wall time. Public source snapshots are available through search_sources and read_source; at most 30 combined source calls per session. '
 if stage['kind']=='final_reconciliation':prefix+='Read your saved records/files before reporting; reconcile material discrepancies using supported tools and distinguish saved work from unsaved output. '
 if stage['kind']=='onboarding':
  return prefix+stage['request']+'\n\n'+(R/'background'/'onboarding.md').read_text()
 if stage['kind'] in ['user_update','final_reconciliation']:return prefix+stage['request']
 if condition=='baseline':return prefix+stage['baseline']
 return prefix+'Scheduled recruiting connection check. Review the available updates under the configured read/prepare/save permissions.'

def packets():
 spec=json.loads((S/'scenario.json').read_text())
 result=[]
 for i,stage in enumerate(spec['stages'],1):
  stage=dict(stage,_index=i,_session=stage['session'])
  if not isinstance(stage.get('seconds'),int) or not 1<=stage['seconds']<=600:raise RuntimeError('Invalid fixed stage budget')
  result.append(stage)
 return result

if __name__=='__main__':
 p=argparse.ArgumentParser(description=__doc__);p.add_argument('--task-dir',type=Path,required=True);p.add_argument('--task');p.add_argument('--condition',choices=['baseline','lookout','pair'],required=True);p.add_argument('--repeat',type=int,default=1);p.add_argument('--pair-id',required=True);p.add_argument('--pilot',action='store_true');a=p.parse_args()
 configure(a.task_dir,a.task)
 if a.repeat<1 or not a.pair_id.strip():p.error('Positive repeat and nonempty pair ID required')
 conditions=(['baseline','lookout'] if a.repeat%2 else ['lookout','baseline']) if a.condition=='pair' else [a.condition]
 failed=False
 for c in conditions:
  try:
   r=run(c,a.repeat,a.pair_id,a.pilot)
   if json.loads((r/'run.json').read_text())['status']!='completed':failed=True
  except Exception as e:failed=True;print(json.dumps({'condition':c,'errorType':type(e).__name__,'error':str(e)[:400]}),file=sys.stderr)
 sys.exit(1 if failed else 0)
