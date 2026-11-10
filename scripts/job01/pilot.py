#!/usr/bin/env python3
"""JOB01 one-pair host: prepare/preflight never invoke a participant model."""
import argparse,fcntl,hashlib,importlib.util,json,os,shutil,subprocess,sys,time,uuid,urllib.request
from pathlib import Path
LIB=Path(__file__).resolve().parent;REPO=LIB.parents[1]
sys.path.insert(0,str(REPO/'scripts/n01'))
import runner as runtime
# Reuse the pinned N01 subscription executor and capture, not its scenario/reset logic.
def load(name,file):
 s=importlib.util.spec_from_file_location(name,file);m=importlib.util.module_from_spec(s);s.loader.exec_module(m);return m
Bridge=load('job01_transport',LIB/'transport.py').Bridge
write=runtime.write;digest=runtime.digest
PRIVATE=None;NETWORK=None;GATEWAYS=[];ORIGINAL_COMMAND=runtime.command

def runtime_source_files():
 files=[p for folder in [LIB,REPO/'scripts/n01'] for p in folder.iterdir() if p.suffix in ['.mjs','.py']]
 return files+[REPO/'scripts/evals/workspace_transport.py',REPO/'scripts/evals/subscription_grader.py',REPO/'scripts/evals/provenance.mjs',REPO/'scripts/communication/verify-langfuse-pilot.mjs',REPO/'scripts/evals/canonical-search-context.mjs',REPO/'lib/search/documents.mjs',REPO/'lib/search-profile.mjs',REPO/'lib/search/discovery-config.mjs',REPO/'lib/search/default-portals.json',REPO/'lib/search/title-aliases.mjs',REPO/'lib/job-assessment.mjs',REPO/'lib/application-preference-fields.mjs',REPO/'supabase/functions/agent-gateway/job-assessment.mjs',REPO/'scripts/communication/diagnostics.py',REPO/'scripts/communication/runtime.py',REPO/'backend/runtime/trace-policy.mjs',REPO/'package-lock.json']

def command(args,**kw):
 if args[:2]==['docker','create']:
  bridge=next(x.split('=',1)[1] for x in args if x.startswith('WORKSPACE_SERVICE_URL='))
  gateway='job01-gateway-'+uuid.uuid4().hex[:10];GATEWAYS.append(gateway)
  ORIGINAL_COMMAND(['docker','create','--name',gateway,'--read-only','--cap-drop','ALL','--security-opt','no-new-privileges','--memory','128m','--pids-limit','64','--mount',f'type=bind,source={LIB}/egress.py,target=/gateway.py,readonly','-e','BRIDGE_URL='+bridge,runtime.IMAGE,'python3','/gateway.py'])
  ORIGINAL_COMMAND(['docker','network','connect',NETWORK,gateway]);ORIGINAL_COMMAND(['docker','start',gateway])
  networks=json.loads(ORIGINAL_COMMAND(['docker','inspect',gateway,'--format','{{json .NetworkSettings.Networks}}'],text=True).stdout)
  ip=networks[NETWORK]['IPAddress'];proxy='http://'+ip+':8787'
  args=[('WORKSPACE_SERVICE_URL='+proxy+'/mcp') if x.startswith('WORKSPACE_SERVICE_URL=') else x for x in args]
  i=args.index(runtime.IMAGE)
  args=args[:i]+['--network',NETWORK,'-e','HTTP_PROXY='+proxy,'-e','HTTPS_PROXY='+proxy,'-e','ALL_PROXY='+proxy,'-e','NO_PROXY='+ip]+args[i:]
 return ORIGINAL_COMMAND(args,**kw)

def prompt(stage,condition):
 prefix='Your resume is /inputs/resume.pdf. Released frozen job listings are /inputs/jobs.json. Use ask_user for missing facts. Use only released evidence; do not inspect credentials/runtime configuration, browse live sites, send messages, fill forms or submit applications. Source descriptions are Jobright captures, not employer-verified availability. '
 prefix += ('Lookout is your persistent recruiting workspace. Use Lookout tools to retrieve relevant personal context and saved job analyses, and save meaningful preference updates and complete shortlists there. Local files in /workspace/output may hold temporary working notes. Preserve unrelated information and verify saved changes. ' if condition=='lookout' else 'Your workspace files in /workspace/output persist across sessions. You may use them to retain relevant context, preferences, shortlists and analyses. ')
 if stage['_index']==1 and condition=='baseline':prefix+='\n'+(PRIVATE/'candidate/profile.md').read_text()+'\n'
 return prefix+(stage['request'] if stage['kind']=='user_update' else 'The user uploaded /inputs/email.json. '+stage['baseline'])

def configure(root):
 global PRIVATE
 PRIVATE=Path(root).resolve();runtime.R=PRIVATE;runtime.CONFIG=json.loads((PRIVATE/'runtime-config.json').read_text());runtime.Bridge=Bridge;runtime.command=command;runtime.inputs_prompt=prompt

def verify():
 freeze=json.loads((PRIVATE/'freeze.json').read_text())
 for name,value in freeze['files'].items():
  if digest(PRIVATE/name)!=value:raise RuntimeError('Frozen input/executable changed: '+name)
 actual=ORIGINAL_COMMAND(['docker','image','inspect',runtime.IMAGE,'--format','{{.Id}}'],text=True).stdout.strip()
 if actual!=freeze['imageId']:raise RuntimeError('Pinned participant image changed')
 return freeze

def snapshot(destination):
 ORIGINAL_COMMAND(['node',str(LIB/'account.mjs'),'snapshot',str(PRIVATE),str(destination)],timeout=120)

def infrastructure():
 global NETWORK
 NETWORK='job01-isolated-'+uuid.uuid4().hex[:10]
 ORIGINAL_COMMAND(['docker','network','create','--internal',NETWORK])

def close_infrastructure():
 for gateway in GATEWAYS:subprocess.run(['docker','rm','-f',gateway],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,timeout=30)
 GATEWAYS.clear()
 if NETWORK:subprocess.run(['docker','network','rm',NETWORK],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,timeout=30)

def release(stage,condition,inputs):
 for f in inputs.iterdir():f.unlink()
 shutil.copyfile(PRIVATE/'candidate/resume.pdf',inputs/'resume.pdf')
 packet=json.loads((PRIVATE/'packets'/f'{stage["id"]}-{condition}.json').read_text())
 write(inputs/'jobs.json',packet['jobs'])
 email=packet.get('email')
 if email:write(inputs/'email.json',email)
 write(inputs/'sources.json',{'inbox':[email] if email else []})
 return packet

def prepare(root,n01,reference,cost_policy=None,condition_order="baseline,lookout"):
 root=Path(root).resolve();n01=Path(n01).resolve();reference=Path(reference).resolve()
 if not (root/'account.private.json').exists():raise RuntimeError('Create dedicated JOB01 account first')
 if (root/'freeze.json').exists():raise RuntimeError('Never overwrite a frozen pilot')
 order=condition_order.split(',')
 if sorted(order)!=['baseline','lookout']:raise RuntimeError('Each condition required exactly once')
 canonical=json.loads((root/'canonical-context-clone.private.json').read_text())
 if canonical.get('status')!='passed' or canonical.get('nativeReadbackVerified') is not True:raise RuntimeError('Canonical profile prerequisites unverified')
 source=REPO/'fixtures/job-board/jobright-swe-2026-9763907b1b91'
 ORIGINAL_COMMAND(['python3',str(REPO/'scripts/job-board/export.py'),'--snapshot',str(source)])
 for d in ['candidate','suite','packets','runs','receipts']: (root/d).mkdir(exist_ok=True,mode=0o700)
 for src,dst in [('profile.md','profile.md'),('resume.pdf','resume.pdf')]:shutil.copyfile(n01/src,root/'candidate'/dst)
 # Include all initial candidate facts/preferences exposed by the native account.
 # Ownership IDs and storage locators are operational metadata, not candidate context.
 context=json.loads((root/'cloned-context.private.json').read_text())['settings']
 def facts(v):
  if isinstance(v,dict):return {k:facts(x) for k,x in v.items() if k not in {'id','user_id','object_path','created_at','updated_at','content_hash'}}
  if isinstance(v,list):return [facts(x) for x in v]
  return v
 with (root/'candidate/profile.md').open('a') as f:f.write('\nComplete initial saved candidate context:\n'+json.dumps(facts(context),indent=2)+'\n')
 shutil.copyfile(reference,root/'reference.private.json')
 shutil.copyfile(REPO/'examples/job01/scenario.json',root/'suite/scenario.json')
 shutil.copyfile(LIB/'grader-instructions.md',root/'suite/grader-instructions.md')
 shutil.copyfile(source/'manifest.json',root/'source-manifest.json')
 spec=json.loads((root/'suite/scenario.json').read_text())
 cfg={'version':spec['version'],'taskId':'JOB01','allowedTools':['read_personal_context','check_context_versions','discover_tools','discover_toolkit','read_guide','read_developer_context','call_discovered_tool','save_profile_package','save_search_profile','publish_batch','read_batch','read_muse_changes','acknowledge_muse_changes','start_agent_audit_run','append_agent_audit_events','read_agent_audit_run','read_search_context','save_search_document','read_search_document_history','list_jobs','read_user_brief','update_profile_fields','edit_work_experience','save_profile_facts','append_activity','read_toolkit_context','read_agent_tasks','read_agent_schedule','read_action_inbox','list_artifacts','read_artifact'],
      'productConfiguration':{'source':'JOB01 controlled host configuration; candidate context cloned from N01; not an assertion of an installed live account schedule','scheduledJobReviewEnabled':False,'comparisonMode':'matched-intent','proactiveEffortSavingsMeasured':False,'wakePrompt':'Scheduled job-review check. Review the released inbox updates under the configured read/analyze/save permissions.','permittedActions':['read','analyze','save'],'sendAllowed':False},'langfuseReceiptDirectory':str(root/'receipts/langfuse'),'model':'gpt-5.6-terra','reasoning':'medium','noParticipantRunYet':True,'conditionOrder':order}
 pricing=Path(cost_policy) if cost_policy else REPO/'examples/evals/cost-policy.json'
 runtime.cost.validate_policy(json.loads(pricing.read_text()))
 shutil.copyfile(pricing,root/'cost-policy.json')
 write(root/'runtime-config.json',cfg);write(root/'product-configuration.json',cfg['productConfiguration'])
 for s in spec['stages']:
  for c in ['baseline','lookout']:
   ORIGINAL_COMMAND(['node',str(LIB/'task.mjs'),'--source',str(source),'--reference',str(root/'reference.private.json'),'--stage',s['id'],'--condition',c,'--configuration',str(root/'product-configuration.json'),'--output',str(root/'packets'/f'{s["id"]}-{c}.json')])
 files=[p for p in root.rglob('*') if p.is_file()]
 files += runtime_source_files()
 image=ORIGINAL_COMMAND(['docker','image','inspect',runtime.IMAGE,'--format','{{.Id}}'],text=True).stdout.strip()
 write(root/'freeze.json',{'version':spec['version'],'files':{os.path.relpath(p,root):digest(p) for p in files},'imageId':image,'candidateSource':'N01 baseline-kit','sourceSnapshot':source.name,'model':cfg['model'],'reasoning':cfg['reasoning']})
 for p in root.rglob('*'):
  if p.is_file():p.chmod(0o600)
 print(json.dumps({'prepared':str(root),'stages':len(spec['stages']),'inferenceExecuted':False}))

def preflight(output):
 verify();output=Path(output).resolve()
 if output.exists():raise RuntimeError('Keep prior preflight receipts; choose new output')
 output.mkdir(parents=True,mode=0o700)
 report={'inferenceExecuted':False,'participantDomainWrites':False,'conditions':{}}
 infrastructure()
 try:
  spec=json.loads((PRIVATE/'suite/scenario.json').read_text());first=spec['stages'][0]
  order=runtime.CONFIG.get('conditionOrder',['baseline','lookout'])
  if sorted(order)!=['baseline','lookout']:raise RuntimeError('Invalid frozen condition order')
  for condition in order:
   run=output/condition;run.mkdir();inputs=run/'live-inputs';inputs.mkdir();out=run/'output';out.mkdir();sd=run/'stage-1';sd.mkdir()
   release(first,condition,inputs);session=None
   try:
    session=runtime.Session(sd,inputs,out,condition,'preflight')
    req=urllib.request.Request(session.bridge.url.replace('host.docker.internal','127.0.0.1'),data=json.dumps({'jsonrpc':'2.0','id':1,'method':'tools/list','params':{}}).encode(),headers={'Authorization':'Bearer '+session.bridge.key,'Content-Type':'application/json'})
    with urllib.request.urlopen(req,timeout=100) as r:reply=json.load(r)
    if reply.get('error'):raise RuntimeError('Tool schema discovery failed')
    names={t['name'] for t in reply['result']['tools']}
    req.data=json.dumps({'jsonrpc':'2.0','id':3,'method':'initialize','params':{'protocolVersion':'2025-06-18','capabilities':{},'clientInfo':{'name':'readiness','version':'1'}}}).encode()
    with urllib.request.urlopen(req,timeout=100) as r:initialized=json.load(r)
    if initialized.get('error'):raise RuntimeError('Native initialize failed')
    write(sd/'initialize.json',initialized)
    if condition=='baseline' and names!={'ask_user','read_inbox'}:raise RuntimeError('Baseline tool leakage')
    if condition=='lookout':
     if not {'discover_tools','call_discovered_tool','read_inbox','ask_user'}<=names:raise RuntimeError('Native default tools missing')
     # Host-only readiness discovery does not inject schemas into participant startup.
     req.data=json.dumps({'jsonrpc':'2.0','id':2,'method':'tools/call','params':{'name':'discover_tools','arguments':{'workflow':'all'}}}).encode()
     with urllib.request.urlopen(req,timeout=100) as r:discovered=json.load(r)
     if discovered.get('error') or discovered.get('result',{}).get('isError'):raise RuntimeError('Host readiness discovery failed')
     value=discovered['result'].get('structuredContent')
     if value is None:value=json.loads(next(b['text'] for b in discovered['result']['content'] if b.get('type')=='text'))
     value=value.get('data',value);registered={t['name'] for t in value.get('tools',[])}|names
     required={'save_profile_package','save_search_profile','publish_batch','read_batch','start_agent_audit_run','append_agent_audit_events','read_agent_audit_run'}
     if not required<=registered:raise RuntimeError('Required native support missing: '+','.join(sorted(required-registered)))
    code="import urllib.request,json,socket; out={};\nfor name,url in [('blocked','https://example.com'),('inference','https://chatgpt.com')]:\n try:\n  r=urllib.request.urlopen(url,timeout=15);out[name]=r.status\n except Exception as e:out[name]=str(e)\ntry:\n socket.create_connection(('1.1.1.1',443),timeout=3);out['direct']='reachable'\nexcept OSError:out['direct']='blocked'\nprint(json.dumps(out))"
    net=json.loads(ORIGINAL_COMMAND(['docker','exec',session.name,'python3','-c',code],text=True,timeout=45).stdout)
    if '403' not in str(net['blocked']) or net['direct']!='blocked':raise RuntimeError('Network isolation failed: '+str(net))
    if not isinstance(net['inference'],int) and not any(x in str(net['inference']) for x in ['403','404','405']):raise RuntimeError('Inference host unreachable: '+str(net))
    report['conditions'][condition]={'subscriptionLogin':True,'tools':sorted(names),'network':net,'futureEvidenceMounted':False}
   finally:
    if session:session.close()
  snapshot(output/'account-state.json');state=json.loads((output/'account-state.json').read_text())
  if state['tables']['job_batches'] or state['tables']['applications']:raise RuntimeError('Dedicated account already has task activity')
  report['readyForPilot']=True;write(output/'verification.json',report)
 except Exception as error:
  report.update(readyForPilot=False,errorType=type(error).__name__,error=str(error)[:500]);write(output/'failure.json',report);raise
 finally:close_infrastructure()
 write(PRIVATE/'readiness.json',{'readyForPilot':True,'freezeHash':digest(PRIVATE/'freeze.json'),'receipt':str(output/'verification.json'),'inferenceExecuted':False})
 print(json.dumps({'readyForPilot':True,'inferenceExecuted':False,'receipt':str(output/'verification.json')}))

def run_pair(pair_id):
 verify()
 ready=json.loads((PRIVATE/'readiness.json').read_text())
 if not ready.get('readyForPilot') or ready.get('freezeHash')!=digest(PRIVATE/'freeze.json'):raise RuntimeError('Matching successful preflight required')
 attempt=PRIVATE/'pilot-attempt.json'
 with attempt.open('x') as f:json.dump({'pairId':pair_id,'startedAt':time.time()},f)
 # One separately receipted account per pilot; no resets and no silent retries.
 results=[];awake=runtime.ensure_awake();write(PRIVATE/'host-awake.json',awake);infrastructure()
 try:
  spec=json.loads((PRIVATE/'suite/scenario.json').read_text());manifest=json.loads((PRIVATE/'source-manifest.json').read_text())
  order=runtime.CONFIG.get('conditionOrder',['baseline','lookout'])
  if sorted(order)!=['baseline','lookout']:raise RuntimeError('Invalid frozen condition order')
  for condition in order:
   run=PRIVATE/'runs'/f'JOB01-{condition}-{uuid.uuid4().hex[:8]}';run.mkdir(mode=0o700);inputs=run/'live-inputs';inputs.mkdir();out=run/'output';out.mkdir()
   meta={'version':spec['version'],'episodeId':run.name,'pairId':pair_id,'condition':condition,'pilot':True,'synthetic':False,'model':runtime.CONFIG['model'],'reasoning':runtime.CONFIG['reasoning'],'snapshotId':manifest['snapshotId'],'sourceHash':manifest['files']['jobs.json'],'startedAt':time.time(),'status':'running','checkpoints':[]};session=None;previous=None
   write(run/'run.json',meta)
   try:
    snapshot(run/'initial-state.json')
    for index,s in enumerate(spec['stages'],1):
     stage=dict(s,_index=index,_session=s['session'],seconds=spec['policy']['stageBudgetSeconds'])
     sd=run/f'stage-{index}';sd.mkdir();release(stage,condition,inputs);shutil.copytree(inputs,sd/'inputs')
     write(sd/'input-hashes.json',runtime.file_hashes(inputs));snapshot(sd/'before-state.json')
     resume=previous==stage['session'];session_startup=0
     if not resume:
      if session:session.close()
      startup_start=time.monotonic();session=runtime.Session(sd,inputs,out,condition,str(stage['session']));session_startup=time.monotonic()-startup_start
     previous=stage['session'];result=session.turn(sd,stage,resume)
     checkpoint={'sessionStartupSeconds':session_startup,'stage':s['id'],'startedAt':result['startedAt'],'executionSeconds':result['durationSeconds'],'status':result['status'],'interactions':None,'interactionEvidenceStatus':'pending_capture','selectionEvidenceStatus':'pending_independent_extraction','captureStatus':'pending'}
     meta['checkpoints'].append(checkpoint);write(run/'run.json',meta)
     interactions=[]
     for line in (sd/'lookout-trace.jsonl').read_text().splitlines():
      x=json.loads(line)
      if x.get('type')=='user.interaction':interactions.append(x)
     turn_ids=[f"{s['id']}:ask_user:{i}" for i in range(1,len(interactions)+1)]
     counts={'uniqueTurns':len(interactions),'scriptedInitiations':int(s['kind']=='external'),'questions':len(interactions),'repeatedContext':sum(x['data'].get('category')=='context_restatement' for x in interactions),'reminders':0,'corrections':0,'approvals':sum(x['data'].get('category')=='approval' for x in interactions)}
     checkpoint.update({'stage':s['id'],'startedAt':result['startedAt'],'executionSeconds':result['durationSeconds'],'status':result['status'],'interactions':counts,'interactionTurnIds':turn_ids,'answeredTurnCount':len(interactions),'simulatedCompletionMinute':None,'interactionEvidenceStatus':'additional_prose_demands_pending_review','selectionEvidenceStatus':'pending_independent_extraction'})
     write(run/'run.json',meta)
     try:
      snapshot(sd/'after-state.json');shutil.copytree(out,sd/'output');write(sd/'output-hashes.json',runtime.file_hashes(out))
      checkpoint['captureStatus']='captured'
     except Exception as capture_error:
      checkpoint.update(captureStatus='failed',captureError=type(capture_error).__name__);write(run/'run.json',meta);raise
     write(run/'run.json',meta)
     if result['status']!='completed':meta['status']=result['status'];break
    else:meta['status']='completed'
   except Exception as error:
    meta.update(status='harness_failed',errorType=type(error).__name__,error=str(error)[:300])
   finally:
    if session:session.close()
    meta['wallDurationSeconds']=time.time()-meta['startedAt']
    diagnostics=load('job01_diagnostics',REPO/'scripts/communication/diagnostics.py');meta['toolDiagnostics']=diagnostics.call_metrics(sorted(run.glob('stage-*')))
    meta['cost']=runtime.cost.persist(run,PRIVATE/'cost-policy.json');write(run/'run.json',meta)
    write(run/'evidence-hashes.json',runtime.file_hashes(run))
   results.append({'run':str(run),'status':meta['status']})
 finally:close_infrastructure()
 ORIGINAL_COMMAND(['node',str(LIB/'grading.mjs'),'--action','handoff','--root',str(PRIVATE)])
 # One read-only native confirmation attempt after timing/evidence capture. Failure is a separate receipt.
 lookout=next(Path(x['run']) for x in results if 'lookout' in Path(x['run']).name)
 states=sorted(lookout.glob('stage-*/after-state.json'),key=lambda p:int(p.parent.name.split('-')[-1]))
 batches=json.loads(states[-1].read_text())['tables']['job_batches'] if states else []
 ids=PRIVATE/'grading/native-batch-ids.json';write(ids,[b['id'] for b in batches])
 subprocess.run(['node',str(LIB/'confirm.mjs'),'--root',str(PRIVATE),'--batch-ids',str(ids),'--output',str(PRIVATE/'grading/native-confirmation.json')],timeout=120,check=False)
 print(json.dumps({'graderHandoff':str(PRIVATE/'grading/handoff.json'),'pilotAttempts':results,'grading':'independent extraction and semantic review required; no participant rescue'}))

if __name__=='__main__':
 p=argparse.ArgumentParser(description=__doc__);p.add_argument('action',choices=['prepare','preflight','run']);p.add_argument('--root',type=Path,required=True);p.add_argument('--n01',type=Path);p.add_argument('--reference',type=Path);p.add_argument('--output',type=Path);p.add_argument('--pair-id');p.add_argument('--cost-policy',type=Path);p.add_argument('--condition-order',default='baseline,lookout');a=p.parse_args()
 if a.action=='prepare':prepare(a.root,a.n01,a.reference,a.cost_policy,a.condition_order)
 else:
  configure(a.root)
  if a.action=='preflight':preflight(a.output)
  else:
   if not a.pair_id:raise SystemExit('--pair-id required')
   run_pair(a.pair_id)
