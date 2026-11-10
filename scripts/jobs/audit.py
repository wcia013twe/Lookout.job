"""Post-pair structural audit. Never supplies semantic quality judgments."""
import argparse,hashlib,json,datetime,sys,math
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

def contextualize(root,result,spec):
 # Report only clock/timing provenance actually captured for this root. Old
 # historical warnings must not describe a newer isolated-clock execution.
 preflight_clock=False;clock_status='unavailable'
 preflight=root/'receipts/preflight.json'
 if preflight.exists():
  receipt=read(preflight)
  for gate in receipt.get('host',{}).get('gates',[]):
   if gate.get('name')!='native_clock_alignment':continue
   try:
    p=Path(gate.get("path",""))
    if p.is_symlink() or not p.resolve().is_relative_to((root/"receipts").resolve()) or gate.get("status")!="passed" or digest(p)!=gate.get("sha256"):
     raise ValueError("Invalid native clock receipt")
    value=read(p)
    preflight_clock=value.get("aligned") is True and [x.get("stage") for x in value.get("stages",[])]==[x["id"] for x in spec["stages"]]
    clock_status="verified" if preflight_clock else "unverified"
   except (OSError,ValueError,TypeError):
    clock_status="invalid_receipt";result["structuralIssues"].append("Native clock gate evidence unavailable or changed")
   break
 native_turn_clocks=[]
 for p in sorted((root/'runs/lookout').glob('*/response.json')):
  clock=read(p).get('clock',{})
  native_turn_clocks.append(clock.get('aligned') is True and clock.get('clockMode')=='ticking_isolated_backend' and all(clock.get(k) for k in ['sqlNow','javascriptNow','nodeApiNow']))
 native_count=len(result['conditions']['lookout']['reached'])
 turn_clocks=bool(native_turn_clocks) and len(native_turn_clocks)==native_count and all(native_turn_clocks)
 timing_records=[]
 for condition in result['conditions'].values():
  observations=condition['hostObservations']
  timing_records.append(bool(observations) and len(observations)==len(condition['reached']) and all(isinstance(x.get('timing'),dict) and isinstance(x['timing'].get('monotonicSeconds'),(int,float)) and isinstance(x['timing'].get('valid'),bool) for x in observations))
  condition['timingBasis']='Recorded checkpoint execution time; monotonic where executor timing was captured. Historical wall/adapter observations remain separate; unavailable execution time stays unknown.'
  condition['semanticQuality']='not_assessed_by_structural_audit'
 result['auditVersion']='jobs-structural-v3'
 result['clockVerification']={'nativePreflight':clock_status,'nativeTurnReadbacksAligned':turn_clocks,'sqlEdgeNodeProven':preflight_clock and turn_clocks,'monotonicReceiptsCapturedForBoth':all(timing_records),'baselineClockMode':'shared_local_services_and_explicit_business_time; no native task reads'}
 notes=result['limitations']
 notes[0]='Structural audit only; completed turns are not quality passes.'
 notes[1]="Native stage-clock alignment lacks complete bound evidence; calendar-derived comparisons remain unverified."
 notes[2]="Complete monotonic/wall integrity receipts are unavailable for both conditions. Retain measured timings and do not attribute failures from wall duration alone."
 if preflight_clock and not turn_clocks:
  notes[1]="Native clock preflight is verified; complete actual-turn clock captures are unavailable. Calendar-derived comparisons remain unverified."
 if preflight_clock and turn_clocks:
  notes[1]='Isolated SQL, Edge and Node clocks align in bound preflight and captured native turns. Auth/Storage remains a fixture bootstrap, not hosted-service verification.'
 if all(timing_records):
  notes[2]='Monotonic/wall timing and integrity receipts are captured. Reference overruns alone do not establish participant fault; retain actual environment/clock-integrity findings.'
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
  reached=[];inputs[condition]={};diagnostics={};turn_seconds=0;startup_seconds=0;startup_known=True;missing_response=[];time_known=True
  for i,cp in enumerate(run['checkpoints']):
   stage=cp['stage'];sd=directory/(stage if case=='JOB03' else f'stage-{i+1}');reached.append(stage)
   if stage!=stage_ids[i]:problems.append(condition+': wrong stage order')
   packet=read(sd/'input.json');inputs[condition][stage]={'request':packet.get('prompt') or packet.get('input',{}).get('message'),'evidence':packet.get('events',packet.get('input',{}).get('source')),'roleSources':packet.get('sources')}
   if cp['status']=='harness_failed':problems.append(condition+': retained harness failure at '+stage)
   seconds=cp.get('executionSeconds')
   if isinstance(seconds,(int,float)) and math.isfinite(seconds) and seconds>=0:turn_seconds+=seconds
   else:time_known=False
   if not (sd/'response.json').exists():
    startup_known=False;missing_response.append(stage);continue
   response=read(sd/'response.json')
   for key,value in response.get('mcpDiagnostics',{}).items():diagnostics[key]=diagnostics.get(key,0)+value
   if response.get('executionSeconds')!=cp.get('executionSeconds'):problems.append(condition+': execution time differs from executor at '+stage)
   if response.get('containerStartupSeconds') is None:startup_known=False
   else:startup_seconds+=response['containerStartupSeconds']
  confirmation=read(directory/'terminal-confirmation.json')
  if condition=='lookout' and confirmation.get('status')!='confirmed':problems.append('lookout: terminal native confirmation unavailable')
  conditions[condition]={'status':run['status'],'reached':reached,'unreached':[s for s in stage_ids if s not in reached],'participantTurnSeconds':turn_seconds if time_known else None,'knownParticipantSeconds':turn_seconds,'executionTimingCoverage':'complete' if time_known else 'partial','timingBasis':'recorded checkpoint duration including failed attempts; adapter wall time when executor receipt absent','missingResponseStages':missing_response,'hostObservations':host_observations(root,condition,run['checkpoints']),'containerStartupSeconds':startup_seconds if startup_known else None,'diagnosticsWithinTurn':diagnostics,'cost':run.get('cost'),'confirmationReadSucceeded':confirmation.get('status')=='confirmed' if condition=='lookout' else bool(confirmation.get('files') is not None),'semanticQuality':'pending_independent_review'}
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
 result={'auditVersion':'jobs-structural-v2','caseId':case,'scenarioVersion':spec['version'],'pairedIntentEvidenceMatch':not any('mismatch' in p.lower() for p in problems),'structuralIssues':problems,'conditions':conditions,'supplementalReviewerEvidence':supplemental,'independentQualityReviewRequired':True,'qualityPass':None,'measuredComparisonReady':False,'limitations':['Harness-clearing pilot only; completed turns are not quality passes.','Native backend uses real time; historical simulated-stage clock alignment was not established. Calendar-derived preparation is confounded.','Historical wall-budget overruns and DNS failures are supplemental diagnostics, not proof of participant fault. Monotonic timing and suspension receipts were not captured.','Timing reflects the shared host load; no subtraction of native discovery/read/write/verification costs.','Use the case finalizer with a fresh independent reviewer; this operator audit cannot supply that review.','No Langfuse publication or independent grading is performed by this command.']}
 return contextualize(root,result,spec)

if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('--root',type=Path,required=True);p.add_argument('--output',type=Path,required=True);a=p.parse_args()
 if a.output.exists():p.error('Use a new output; preserve prior audits')
 result=audit(a.root);a.output.write_text(json.dumps(result,indent=2)+'\n');a.output.chmod(0o600)
 print(json.dumps({'caseId':result['caseId'],'audit':str(a.output),'structuralIssues':result['structuralIssues'],'quality':'unreviewed'}))
