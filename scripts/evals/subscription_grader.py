"""One isolated subscription grader invocation; no scheduler or account writer tools."""
import argparse,hashlib,json,os,subprocess,sys,time,uuid
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'communication'))
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'n01'))
from runtime import StageClock,ensure_awake,stop_container_client,clean_error
import cost
MODEL='gpt-5.6-terra';REASONING='medium';IMAGE='lookout-benchmark:0.164.0'
def sha(path):return hashlib.sha256(Path(path).read_bytes()).hexdigest()
def manifest(root):
 result={}
 for p in sorted(root.rglob('*')):
  if p.is_symlink():raise ValueError('Evidence symlinks are not allowed')
  if not p.is_file():continue
  if p.name in ['auth.json','.env','account.private.json','grader.private.json'] or p.name.endswith('.private.json') or p.name.startswith('.env.'):
   raise ValueError('Remove credential/private configuration files from grader evidence bundle: '+p.name)
  result[str(p.relative_to(root))]=sha(p)
 return result

def cli_command(name):
 cmd=['docker','exec','-i',name,'codex','--no-daemon','--ask-for-approval','never','exec','--sandbox','danger-full-access','--cd','/workspace','--ignore-user-config','--ignore-rules','--skip-git-repo-check','--json','--model',MODEL,'-c','model_reasoning_effort="medium"','-c','project_doc_max_bytes=0','-c','skills.bundled.enabled=false','-c','web_search="disabled"']
 for feature in ['apps','plugins','remote_plugin','memories','multi_agent','skill_search']:cmd+=['--disable',feature]
 return cmd+['-']
def main():
 p=argparse.ArgumentParser(description=__doc__);p.add_argument('--evidence',type=Path,required=True);p.add_argument('--instructions',type=Path,required=True);p.add_argument('--output',type=Path,required=True);p.add_argument('--seconds',type=int,required=True);p.add_argument('--expected-image-id',required=True);a=p.parse_args()
 evidence=a.evidence.resolve();instructions=a.instructions.resolve();out=a.output.resolve()
 if not evidence.is_dir() or not instructions.is_file() or a.seconds<1:p.error('Existing evidence/instructions and positive declared seconds required')
 if out.exists():p.error('Use a new output directory; preserve prior grading attempts')
 if out.is_relative_to(evidence) or evidence.is_relative_to(out):p.error('Evidence and writable output must be disjoint')
 files=manifest(evidence);prompt=instructions.read_text();auth=json.loads((Path.home()/'.codex/auth.json').read_text())
 if auth.get('OPENAI_API_KEY') or not auth.get('tokens'):raise RuntimeError('Subscription-only auth required; API keys not accepted')
 out.mkdir(parents=True,mode=0o700);review=out/'output';review.mkdir(mode=0o700)
 name='lookout-grader-'+uuid.uuid4().hex[:10];proc=None;clock=None;create_attempted=False
 meta={'role':'independent_grader','model':MODEL,'model_reasoning_effort':REASONING,'subscriptionOnly':True,'budgetSeconds':a.seconds,'startedAt':time.time(),'status':'setup_failed','container':name,'evidenceReadOnly':True,'accountWriterTools':False,'evidenceManifest':files,'instructionsSha256':sha(instructions),'executorSha256':sha(__file__),'expectedImageId':a.expected_image_id,'command':cli_command(name)}
 def save():
  f=out/'grader-run.json';f.write_text(json.dumps(meta,indent=2)+'\n');f.chmod(0o600)
 def run(args,**kwargs):return subprocess.run(args,check=True,capture_output=True,timeout=30,**kwargs)
 save()
 try:
  meta['hostAwakeGuard']=ensure_awake()
  image=run(['docker','image','inspect',IMAGE,'--format','{{.Id}}'],text=True).stdout.strip()
  if image!=a.expected_image_id:raise RuntimeError('Pinned grading image mismatch')
  meta['imageId']=image
  create_attempted=True
  run(['docker','create','--name',name,'--read-only','--cap-drop','ALL','--security-opt','no-new-privileges','--pids-limit','256','--memory','2g','--cpus','2','--tmpfs','/tmp:rw,nosuid,nodev,size=256m','--tmpfs','/root/.codex:rw,nosuid,nodev,size=128m','--mount',f'type=bind,source={evidence},target=/evidence,readonly','--mount',f'type=bind,source={review},target=/workspace/output',IMAGE,'sleep','infinity'])
  run(['docker','start',name])
  run(['docker','exec','-i',name,'python3','-c',"import sys,os; p='/root/.codex/auth.json'; open(p,'wb').write(sys.stdin.buffer.read()); os.chmod(p,0o600)"],input=json.dumps(auth).encode())
  login=run(['docker','exec',name,'codex','login','status'],text=True)
  if 'Logged in using ChatGPT' not in login.stdout+login.stderr:raise RuntimeError('Subscription login unavailable')
  meta['mounts']=json.loads(run(['docker','inspect',name,'--format','{{json .Mounts}}'],text=True).stdout)
  if any(m.get('RW') for m in meta['mounts'] if m.get('Destination')=='/evidence'):raise RuntimeError('Evidence mount writable')
  meta['status']='running';save();clock=StageClock()
  with (out/'stderr.log').open('w') as errors:
   proc=subprocess.Popen(cli_command(name),stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=errors,text=True)
   try:
    raw,_=proc.communicate('You are an independent evaluator. Evidence is read-only at /evidence. Write only /workspace/output/review.json. Do not contact services, participants or accounts. Follow the supplied frozen review instructions.\n\n'+prompt,timeout=a.seconds)
   except subprocess.TimeoutExpired as error:
    meta['termination']=stop_container_client(proc,name);meta['hostControlFailed']=not meta['termination'].get('containerStopped');meta['status']='timed_out';raw=error.output or '';raw=raw.decode(errors='replace') if isinstance(raw,bytes) else raw
   else:meta['exitCode']=proc.returncode;meta['status']='execution_finished' if proc.returncode==0 else 'execution_failed'
  meta['timing']=clock.finish();clock=None
  events=[]
  for line in raw.splitlines():
   try:event=json.loads(line)
   except ValueError:continue
   if event.get('item',{}).get('type')=='reasoning':event={'type':event.get('type'),'item':{'type':'reasoning','content':'not captured'}}
   for token in auth['tokens'].values():
    if isinstance(token,str) and token:event=json.loads(json.dumps(event).replace(token,'[REDACTED]'))
   events.append(event)
  (out/'trace.jsonl').write_text(''.join(json.dumps(e)+'\n' for e in events))
  tids=[e.get('thread_id') for e in events if e.get('type')=='thread.started'];meta['threadId']=tids[0] if tids else None
  usage={'error':'container_stop_unconfirmed'} if meta.get('hostControlFailed') else cost.capture(name,meta['threadId']) if meta['threadId'] else {'error':'missing_thread_id'}
  meta['usage']=usage;meta['observedModels']=usage.get('models',[]);meta['reasoningEvidence']='Explicit model_reasoning_effort=medium command; no separate provider effort attestation'
  if meta['status']=='execution_finished':
   if meta['observedModels']!=[MODEL]:meta['status']='invalid_model_provenance'
   elif not meta['timing']['valid']:meta['status']='invalid_timing'
   else:
    value=json.loads((review/'review.json').read_text())
    if not isinstance(value,dict):raise ValueError('Review JSON must be an object')
    meta['reviewSha256']=sha(review/'review.json');meta['status']='completed'
 except Exception as error:
  meta['errorType']=type(error).__name__;meta['error']=clean_error(error)
  if meta['status']=='running' or meta['status']=='execution_finished':meta['status']='artifact_failed'
 finally:
  if proc and proc.poll() is None:meta['termination']=stop_container_client(proc,name);meta['hostControlFailed']=not meta['termination'].get('containerStopped')
  if clock:meta['timing']=clock.finish()
  try:
   if not create_attempted:meta['containerRemoved']=True
   else:
    removed=subprocess.run(['docker','rm','-f',name],capture_output=True,timeout=10);meta['containerRemoved']=removed.returncode==0
  except (OSError,subprocess.SubprocessError):meta['containerRemoved']=False
  if not meta['containerRemoved']:meta['hostControlFailed']=True;meta['status']='containment_failed'
  meta['evidenceUnchanged']=manifest(evidence)==files
  if not meta['evidenceUnchanged']:meta['status']='invalid_evidence'
  meta['endedAt']=time.time();save()
  for f in out.rglob('*'):
   if f.is_file():f.chmod(0o600)
 print(json.dumps({'status':meta['status'],'receipt':str(out/'grader-run.json'),'model':MODEL,'reasoning':REASONING}))
 return 0 if meta['status']=='completed' else 1
if __name__=='__main__':sys.exit(main())
