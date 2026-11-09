"""Post-pair structural audit. Never supplies semantic quality judgments."""
import argparse,hashlib,json,datetime,sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/"communication"))
from diagnostics import call_metrics

def read(p):return json.loads(p.read_text())
def digest(p):return hashlib.sha256(p.read_bytes()).hexdigest()

def clock_alignment(spec,backend_now,tolerance_seconds=300):
 """Fail closed: a single real backend clock cannot impersonate a compressed timeline.
 No server clock or shared stack is mutated by this check.
 """
 def stamp(value):
  d=datetime.datetime.fromisoformat(value.replace('Z','+00:00'))
  if d.tzinfo is None:raise ValueError('Clock requires an explicit offset')
  return d.timestamp()
 backend=stamp(backend_now);stages=[]
 for stage in spec['stages']:
  now=stage.get('now') or stage.get('at')
  if not now:
   now=datetime.datetime.fromtimestamp(stamp(spec['epoch'])+stage['minute']*60,datetime.timezone.utc).isoformat()
  delta=stamp(now)-backend
  stages.append({'stage':stage['id'],'simulatedAt':now,'offsetSeconds':delta,'aligned':abs(delta)<=tolerance_seconds})
 return {'backendAt':backend_now,'toleranceSeconds':tolerance_seconds,'aligned':all(s['aligned'] for s in stages),'stages':stages,'policy':'all_stages_require_native_clock_alignment; no global clock mutation'}

def host_observations(root,condition,checkpoints):
 directories=sorted((root/'host-runs'/condition).glob('stage-*'),key=lambda p:int(p.name.split('-')[1]))
 result=[]
 for cp,sd in zip(checkpoints,directories):
  p=sd/'stage-run.json'
  if not p.exists():continue
  meta=read(p);stderr=(sd/'stderr.log').read_text() if (sd/'stderr.log').exists() else ''
  trace=[json.loads(l) for l in (sd/'trace.jsonl').read_text().splitlines()] if (sd/'trace.jsonl').exists() else []
  budget=meta.get('budgetSeconds');duration=meta.get('durationSeconds');start=meta.get('startedAt')
  rows=[x for x in trace if x.get('capturedAt') is not None]
  result.append({'stage':cp['stage'],'hostDirectory':str(sd.relative_to(root)),
   'status':meta.get('status'),'session':meta.get('session'),'resumed':meta.get('resumed'),
   'executorWallSeconds':duration,'budgetSeconds':budget,
   'wallBudgetExceeded':duration>budget+5 if duration is not None and budget is not None else None,
   'eventsAfterWallDeadline':sum(x['capturedAt']>start+budget for x in rows) if start is not None and budget is not None else None,
   'modelEndpointDnsFailure':'failed to lookup address information' in stderr,
   'terminalTurnEvent':any(x.get('event',{}).get('type') in ['turn.completed','turn.failed'] for x in trace),
   'nativeDiagnosticsWithinTurn':call_metrics([sd]),'costCoverage':meta.get('cost',{}).get('status','unknown'),'timing':meta.get('timing'),'environmentTimingConfounded':meta.get('environmentTimingConfounded'),
   'evidence':{str(p.relative_to(root)):digest(p) for p in sd.iterdir() if p.is_file()}})
 return result

def audit(root):
 root=Path(root).resolve();spec=read(root/'suite/scenario.json');config=read(root/'configuration.json');case=config['benchmarkTaskId'];problems=[];conditions={};inputs={}
 required=['baseline','lookout'];stage_ids=[s['id'] for s in spec['stages']]
 for condition in required:
  directory=root/'runs'/condition;run=read(directory/'run.json')
  if run['status'] not in ['completed','timed_out','execution_failed','harness_failed']:raise ValueError('Both attempts must terminate before audit')
  manifest=read(directory/'evidence-hashes.json')
  for relative,sha in manifest.items():
   p=directory/relative
   if not p.resolve().is_relative_to(directory.resolve()) or p.is_symlink():raise ValueError('Evidence escaped run')
   if case=='JOB03':actual=hashlib.sha256(p.read_text().encode()).hexdigest()
   else:actual=digest(p)
   if actual!=sha:problems.append(condition+': changed evidence '+relative)
  reached=[];inputs[condition]={};diagnostics={};turn_seconds=0;startup_seconds=0;startup_known=True;missing_response=[]
  for i,cp in enumerate(run['checkpoints']):
   stage=cp['stage'];sd=directory/(stage if case=='JOB03' else f'stage-{i+1}');reached.append(stage)
   if stage!=stage_ids[i]:problems.append(condition+': wrong stage order')
   packet=read(sd/'input.json');inputs[condition][stage]={'request':packet.get('prompt') or packet.get('input',{}).get('message'),'evidence':packet.get('events',packet.get('input',{}).get('source')),'roleSources':packet.get('sources')}
   if cp['status']=='harness_failed':problems.append(condition+': retained harness failure at '+stage)
   turn_seconds+=cp.get('executionSeconds',0)
   if not (sd/'response.json').exists():
    startup_known=False;missing_response.append(stage);continue
   response=read(sd/'response.json')
   for key,value in response.get('mcpDiagnostics',{}).items():diagnostics[key]=diagnostics.get(key,0)+value
   if response.get('executionSeconds')!=cp.get('executionSeconds'):problems.append(condition+': execution time differs from executor at '+stage)
   if response.get('containerStartupSeconds') is None:startup_known=False
   else:startup_seconds+=response['containerStartupSeconds']
  confirmation=read(directory/'terminal-confirmation.json')
  if condition=='lookout' and confirmation.get('status')!='confirmed':problems.append('lookout: terminal native confirmation unavailable')
  conditions[condition]={'status':run['status'],'reached':reached,'unreached':[s for s in stage_ids if s not in reached],'participantTurnSeconds':turn_seconds,'timingBasis':'recorded checkpoint duration including failed attempts; adapter wall time when executor receipt absent','missingResponseStages':missing_response,'hostObservations':host_observations(root,condition,run['checkpoints']),'containerStartupSeconds':startup_seconds if startup_known else None,'diagnosticsWithinTurn':diagnostics,'cost':run.get('cost'),'confirmationReadSucceeded':confirmation.get('status')=='confirmed' if condition=='lookout' else bool(confirmation.get('files') is not None),'semanticQuality':'pending_independent_review'}
 shared=set(inputs['baseline'])&set(inputs['lookout'])
 for stage in shared:
  if inputs['baseline'][stage]!=inputs['lookout'][stage]:problems.append('Intent/evidence mismatch at '+stage)
 # Actual prompts/inputs are supplemental, frozen reviewer evidence; never send
 # credentials or entire setup roots to a grader. This does not alter run manifests.
 supplemental={}
 for relative in ['background/onboarding.md','context-parity.json','host-initial.json']:
  p=root/relative;supplemental[relative]=digest(p)
 for c in required:
  for p in sorted((root/'host-runs'/c).glob('stage-*/prompt.txt')):supplemental[str(p.relative_to(root))]=digest(p)
 return {'auditVersion':'jobs-structural-v2','caseId':case,'scenarioVersion':spec['version'],'pairedIntentEvidenceMatch':not any('mismatch' in p.lower() for p in problems),'structuralIssues':problems,'conditions':conditions,'supplementalReviewerEvidence':supplemental,'independentQualityReviewRequired':True,'qualityPass':None,'measuredComparisonReady':False,'limitations':['Harness-clearing pilot only; completed turns are not quality passes.','Native backend uses real time; historical simulated-stage clock alignment was not established. Calendar-derived preparation is confounded.','Historical wall-budget overruns and DNS failures are supplemental diagnostics, not proof of participant fault. Monotonic timing and suspension receipts were not captured.','Timing reflects the shared host load; no subtraction of native discovery/read/write/verification costs.','Use the case finalizer with a fresh independent reviewer; this operator audit cannot supply that review.','No Langfuse publication or independent grading is performed by this command.']}

if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('--root',type=Path,required=True);p.add_argument('--output',type=Path,required=True);a=p.parse_args()
 if a.output.exists():p.error('Use a new output; preserve prior audits')
 result=audit(a.root);a.output.write_text(json.dumps(result,indent=2)+'\n');a.output.chmod(0o600)
 print(json.dumps({'caseId':result['caseId'],'audit':str(a.output),'structuralIssues':result['structuralIssues'],'quality':'unreviewed'}))
