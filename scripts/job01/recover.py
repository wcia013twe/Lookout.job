#!/usr/bin/env python3
"""Explicit operator-authorized JOB01 initial-stage recovery; never resets account state."""
import argparse,fcntl,hashlib,importlib.util,json,shutil,subprocess,time,uuid
from pathlib import Path

def load_host(repo):
 s=importlib.util.spec_from_file_location('job01_recovery_host',repo/'scripts/job01/pilot.py');m=importlib.util.module_from_spec(s);s.loader.exec_module(m);return m

def read(p):return json.loads(p.read_text())
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def same_state(a,b):return a['tables']==b['tables']
def recovery_cost(current,prior):
 result=dict(current);result['recoverySegments']=[{'role':'interrupted','cost':prior},{'role':'continuation','cost':current}]
 old=prior['coverage'];new=current['coverage'];attempted=old['attemptedStages']+new['attemptedStages'];covered=old['coveredStages']+new['coveredStages']
 result['coverage']={'status':'complete' if covered==attempted else 'partial' if covered else 'unknown','attemptedStages':attempted,'coveredStages':covered}
 result['observedTokens']={k:(prior.get('observedTokens') or {}).get(k,0)+(current.get('observedTokens') or {}).get(k,0) for k in set((prior.get('observedTokens') or {}))|set((current.get('observedTokens') or {}))} or None
 if covered!=attempted:result.update(tokens=None,estimatedModelUsd=None,estimatedTotalUsd=None,billedUsd=None)
 elif prior.get('tokens') and current.get('tokens'):result['tokens']={k:prior['tokens'].get(k,0)+current['tokens'].get(k,0) for k in set(prior['tokens'])|set(current['tokens'])}
 result['limitations']=[*current.get('limitations',[]),'Includes interrupted work; missing usage in the terminated segment remains unknown.']
 return result

def prepare(host,parent,destination):
 if destination.parent!=parent.parent:raise RuntimeError('Recovery root must be a sibling to retain original relative source bindings')
 host.configure(parent);host.verify()
 runs=[p for p in (parent/'runs').iterdir() if (p/'run.json').exists()]
 baseline=[p for p in runs if read(p/'run.json')['condition']=='baseline'];lookout=[p for p in runs if read(p/'run.json')['condition']=='lookout']
 if len(runs)!=2 or len(baseline)!=1 or len(lookout)!=1:raise RuntimeError('Original terminal pair required')
 old=read(lookout[0]/'run.json')
 if old['status']!='timed_out' or len(old['checkpoints'])!=1 or old['checkpoints'][0]['stage']!='initial_search':raise RuntimeError('Only explicit first-stage timeout recovery is supported')
 for run in runs:
  for name,value in read(run/'evidence-hashes.json').items():
   if sha(run/name)!=value:raise RuntimeError('Original participant artifact drift')
 destination.mkdir(mode=0o700)
 for name in read(parent/'freeze.json')['files']:
  if '..' not in Path(name).parts and not Path(name).is_absolute():
   dst=destination/name;dst.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(parent/name,dst)
 shutil.copyfile(parent/'freeze.json',destination/'freeze.json')
 for name in ['runs','receipts']:(destination/name).mkdir()
 shutil.copytree(baseline[0],destination/'runs'/baseline[0].name)
 out=destination/'runs'/('JOB01-lookout-recovery-'+uuid.uuid4().hex[:8]);out.mkdir()
 shutil.copytree(lookout[0],out/'interrupted-attempt')
 host.configure(destination);host.verify()
 files=sorted(set(host.runtime_source_files()+[Path(__file__).resolve()]))
 amendment={'status':'prepared','authorization':'User explicitly requested repairing JOB01 by allowing it to finish','parentRoot':str(parent),'originalFreezeSha256':sha(parent/'freeze.json'),'originalLookoutRun':str(lookout[0]),'originalEvidenceManifestSha256':sha(lookout[0]/'evidence-hashes.json'),'recoveryRun':str(out),'condition':'lookout','model':'gpt-5.6-terra','reasoning':'medium','hardDeadlineSeconds':None,'accountReset':False,'baselineRerun':False,'freshRuntimeRequired':True,'confoundStatus':'recovered_after_harness_timeout_fresh_context','qualityRubricChanged':False,'futureEventsRevealed':False,'sourceSha256':{str(p):sha(p) for p in files},'recordedAt':time.time()}
 host.write(destination/'execution-amendment.json',amendment)
 return out,old

def execute(host,parent,destination,out,old):
 runtime=host.runtime;amendment=read(destination/'execution-amendment.json')
 for p,value in amendment['sourceSha256'].items():
  if sha(Path(p))!=value:raise RuntimeError('Recovery execution source changed')
 with (parent/'account.lock').open('a') as lock:
  fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
  host.configure(destination);host.verify()
  host.snapshot(destination/'receipts/before-recovery.private.json')
  if not same_state(read(destination/'receipts/before-recovery.private.json'),read(out/'interrupted-attempt/stage-1/after-state.json')):raise RuntimeError('Owner state changed since interruption; do not reset or continue blindly')
  spec=read(destination/'suite/scenario.json');manifest=read(destination/'source-manifest.json');inputs=out/'live-inputs';inputs.mkdir();files=out/'output';shutil.copytree(out/'interrupted-attempt/output',files)
  resumed_at=time.time();meta={**{k:old[k] for k in ['version','pairId','condition','pilot','synthetic','model','reasoning','snapshotId','sourceHash','startedAt']},'episodeId':out.name,'status':'running','checkpoints':[],'recovery':{**amendment,'resumedAt':resumed_at,'priorExecutionSeconds':old['checkpoints'][0]['executionSeconds'],'freshSession':True,'comparisonEligibleAsUninterrupted':False},'hostAwakeGuard':runtime.ensure_awake()}
  host.write(destination/'pilot-attempt.json',{'startedAt':resumed_at,'pairId':old['pairId'],'recovery':True});host.write(out/'run.json',meta)
  host.snapshot(out/'initial-state.json');session=None;previous=None
  original_prompt=runtime.inputs_prompt
  def prompt(stage,condition):
   text=original_prompt(stage,condition)
   return text+(' Continue the interrupted request using the work retained in your persistent workspace.' if stage['_index']==1 else '')
  runtime.inputs_prompt=prompt
  try:
   host.infrastructure()
   for index,s in enumerate(spec['stages'],1):
    stage=dict(s,_index=index,_session=s['session'],seconds=spec['policy']['stageBudgetSeconds'],allowHealthyCompletion=True)
    sd=out/f'stage-{index}';sd.mkdir();host.release(stage,'lookout',inputs);shutil.copytree(inputs,sd/'inputs');host.write(sd/'input-hashes.json',runtime.file_hashes(inputs));host.snapshot(sd/'before-state.json')
    resume=previous==stage['session'];startup_seconds=0
    if not resume:
     if session:session.close()
     start=time.monotonic();session=runtime.Session(sd,inputs,files,'lookout',str(stage['session']));startup_seconds=time.monotonic()-start
    previous=stage['session'];result=session.turn(sd,stage,resume)
    events=[json.loads(line) for line in (sd/'lookout-trace.jsonl').read_text().splitlines() if json.loads(line).get('type')=='user.interaction']
    prior_events=[]
    if index==1:prior_events=[json.loads(line) for line in (out/'interrupted-attempt/stage-1/lookout-trace.jsonl').read_text().splitlines() if json.loads(line).get('type')=='user.interaction']
    all_events=prior_events+events
    turns=[f"{s['id']}:interrupted:ask_user:{i}" for i in range(1,len(prior_events)+1)]+[f"{s['id']}:ask_user:{i}" for i in range(1,len(events)+1)]
    counts={'uniqueTurns':len(turns),'scriptedInitiations':int(s['kind']=='external'),'questions':len(turns),'repeatedContext':sum(x['data'].get('category')=='context_restatement' for x in all_events),'reminders':0,'corrections':0,'approvals':sum(x['data'].get('category')=='approval' for x in all_events)}
    checkpoint={'sessionStartupSeconds':startup_seconds+(old['checkpoints'][0].get('sessionStartupSeconds',0) if index==1 else 0),'stage':s['id'],'startedAt':old['checkpoints'][0]['startedAt'] if index==1 else result['startedAt'],'executionSeconds':result['durationSeconds']+(old['checkpoints'][0]['executionSeconds'] if index==1 else 0),'status':result['status'],'interactions':counts,'interactionTurnIds':turns,'answeredTurnCount':len(turns),'simulatedCompletionMinute':None,'interactionEvidenceStatus':'additional_prose_demands_pending_review','selectionEvidenceStatus':'pending_independent_extraction','captureStatus':'pending'}
    meta['checkpoints'].append(checkpoint);host.write(out/'run.json',meta)
    host.snapshot(sd/'after-state.json');shutil.copytree(files,sd/'output');host.write(sd/'output-hashes.json',runtime.file_hashes(files));checkpoint['captureStatus']='captured';host.write(out/'run.json',meta)
    if result['status']!='completed':meta['status']=result['status'];break
   else:meta['status']='completed'
  except Exception as error:
   meta.update(status='harness_failed',errorType=type(error).__name__,error=str(error)[:300]);raise
  finally:
   if session:meta['cleanup']=session.close()
   host.close_infrastructure();runtime.inputs_prompt=original_prompt
   meta['endedAt']=time.time();meta['wallDurationSeconds']=meta['endedAt']-meta['startedAt'];meta['recovery']['continuationWallSeconds']=meta['endedAt']-resumed_at;meta['recovery']['interruptionGapSeconds']=resumed_at-(old['startedAt']+old['wallDurationSeconds'])
   diagnostic=host.load('recovery_diagnostics',host.REPO/'scripts/communication/diagnostics.py');meta['toolDiagnostics']=diagnostic.call_metrics([out/'interrupted-attempt/stage-1',*sorted(out.glob('stage-*'))]);meta['cost']=recovery_cost(runtime.cost.persist(out,destination/'cost-policy.json'),old['cost']);host.write(out/'cost.json',meta['cost']);host.write(out/'run.json',meta);host.write(out/'evidence-hashes.json',runtime.file_hashes(out))
  host.ORIGINAL_COMMAND(['node',str(host.LIB/'grading.mjs'),'--action','handoff','--root',str(destination)])
  states=sorted(out.glob('stage-*/after-state.json'),key=lambda p:int(p.parent.name.split('-')[-1]));batches=read(states[-1])['tables']['job_batches'];ids=destination/'grading/native-batch-ids.json';host.write(ids,[b['id'] for b in batches]);subprocess.run(['node',str(host.LIB/'confirm.mjs'),'--root',str(destination),'--batch-ids',str(ids),'--output',str(destination/'grading/native-confirmation.json')],check=True,timeout=120)
  print(json.dumps({'status':meta['status'],'root':str(destination),'recoveryRun':str(out),'originalPreserved':True,'independentGradingPending':True}),flush=True)

if __name__=='__main__':
 p=argparse.ArgumentParser(description=__doc__);p.add_argument('--repo',type=Path,required=True);p.add_argument('--parent',type=Path,required=True);p.add_argument('--destination',type=Path,required=True);a=p.parse_args();host=load_host(a.repo.resolve());parent=a.parent.resolve();destination=a.destination.resolve();out,old=prepare(host,parent,destination);execute(host,parent,destination,out,old)
