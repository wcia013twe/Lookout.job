"""Independent local-first grading. Missing semantic review is pending, never a pass."""
import argparse,hashlib,json,math
from pathlib import Path
import sys
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/"communication"))
from diagnostics import call_metrics
GRADER_VERSION='COM4-grade-v3'
from terminal_state import validate_terminal_state
def scenario_digest(spec):return hashlib.sha256(json.dumps(spec,sort_keys=True,separators=(',',':')).encode()).hexdigest()

TERMINAL={'completed','execution_failed','timed_out','setup_failed','artifact_failed'}

def read(p):return json.loads(p.read_text())
def rows(p):return [json.loads(x) for x in p.read_text().splitlines() if x] if p.exists() else []
def evidence_digest(run):
 h=hashlib.sha256()
 for p in sorted(run.rglob('*')):
  if p.is_file() and not p.is_symlink() and (p.name in ['run.json','trace.jsonl','lookout-trace.jsonl','delivery.json','stage-run.json','after-state.json','before-state.json','initial-state.json','final-state.json','prompt.txt','terminal-state.json'] or 'output' in p.parts):
   h.update(str(p.relative_to(run)).encode());h.update(p.read_bytes())
 return h.hexdigest()
def tool_calls(stage):
 requests={};result=[]
 for r in rows(stage/'lookout-trace.jsonl'):
  data=r.get('data',{})
  if r['type']=='mcp.request' and data.get('method')=='tools/call':requests[data['id']]=data['params']
  if r['type']=='mcp.response' and data.get('id') in requests:
   p=requests.pop(data['id']);name=p['name'];args=p.get('arguments',{})
   if name=='call_discovered_tool':name=args.get('name')
   result.append({'name':name,'success':not(data.get('error') or data.get('result',{}).get('isError'))})
 for p in requests.values():result.append({'name':p.get('arguments',{}).get('name') if p['name']=='call_discovered_tool' else p['name'],'success':False})
 return result

def template(run,spec):
 return {'version':spec['version'],'graderVersion':GRADER_VERSION,'scenarioDigest':scenario_digest(spec),'evidenceDigest':evidence_digest(run),'reviewer':None,'independentOfParticipant':False,'quality':{k:{'pass':None,'reason':'','evidence':[]} for k in spec['quality']},'adherence':{k:{'outcomeVerified':None,'reason':'','evidence':[]} for k in spec['adherence']},'additionalInteractions':[], 'interactionReviewComplete':False}

def verify_refs(run,item):
 if not item.get('reason') or not item.get('evidence'):raise ValueError('Review decisions require reason and evidence paths')
 for ref in item['evidence']:
  p=(run/ref.split('#')[0]).resolve()
  if not p.is_relative_to(run.resolve()) or not p.is_file() or p.is_symlink():raise ValueError('Invalid review evidence reference')

def validate_evidence(run,spec,m):
 if m.get('scenarioDigest')!=scenario_digest(spec):raise ValueError('Run/scenario digest mismatch')
 found={int(p.name.split('-')[1]):p for p in run.glob('stage-*') if p.is_dir()}
 if any(i<1 or i>len(spec['stages']) for i in found):raise ValueError('Unexpected stage directory')
 reached={}
 for i,sd in sorted(found.items()):
  if not (sd/'stage-run.json').exists():
   if m['status']=='completed':raise ValueError('Completed run missing stage receipt')
   continue
  sm=read(sd/'stage-run.json')
  if sm.get('status') not in TERMINAL:raise ValueError('Nonterminal stage receipt')
  for name in ['durationSeconds','startedAt']:
   if not isinstance(sm.get(name),(int,float)) or not math.isfinite(sm[name]) or sm[name]<0:raise ValueError('Invalid stage timing')
  for name in ['trace.jsonl','lookout-trace.jsonl','delivery.json','prompt.txt','before-state.json','after-state.json']:
   if not (sd/name).is_file() or (sd/name).is_symlink():raise ValueError('Missing required telemetry: '+str(sd/name))
  if not (sd/'output').is_dir():raise ValueError('Missing output snapshot')
  if sm['status']=='completed' and not rows(sd/'trace.jsonl'):raise ValueError('Completed stage has empty trace')
  d=read(sd/'delivery.json');expected=spec['stages'][i-1]
  if d.get('stage')!=i or d.get('eventId')!=expected['id'] or d.get('releasedMinute')!=expected['minute']:raise ValueError('Delivery differs from scenario')
  if not isinstance(d.get('triggerMinute'),(int,float)) or not math.isfinite(d['triggerMinute']) or d['triggerMinute']<d['releasedMinute']:raise ValueError('Invalid delivery time')
  if d.get('assignedInitiation')!=(expected['kind']=='external') or d.get('assignedOnboarding')!=(expected['kind']=='onboarding') or d.get('necessaryUserUpdate')!=(expected['kind']=='user_update'):raise ValueError('Delivery interaction classification differs from scenario')
  reached[i]=sd
 if list(reached)!=list(range(1,len(reached)+1)):raise ValueError('Noncontiguous stage receipts')
 if m['status']=='completed' and (len(reached)!=len(spec['stages']) or any(read(sd/'stage-run.json')['status']!='completed' for sd in reached.values())):raise ValueError('Completed run has incomplete stages')
 if reached and not (run/'initial-state.json').is_file():raise ValueError('Missing initial state')
 return reached

def check_review_evidence(run,item,stage_ids,passed,native_write=False):
 verify_refs(run,item)
 refs=[ref.split('#')[0] for ref in item['evidence']]
 for i in stage_ids:
  prefix=f'stage-{i}/'
  valid=[ref for ref in refs if ref.startswith(prefix) and (ref.endswith('trace.jsonl') or ref.endswith('after-state.json') or '/output/' in ref or (not passed and ref.endswith('stage-run.json')))]
  if not valid:raise ValueError('Checkpoint needs its own output/state/trace evidence')
  if native_write and prefix+'after-state.json' not in refs:raise ValueError('Native writes require after-state evidence')

def grade(run,spec,review=None):
 run=Path(run);m=read(run/'run.json')
 if m['status'] not in TERMINAL:raise ValueError('Cannot grade an active run')
 if m.get('taskId')!=spec['taskId'] or m.get('version')!=spec['version'] or m.get('condition') not in ['baseline','lookout']:raise ValueError('Wrong scenario/condition')
 stages=validate_evidence(run,spec,m)
 terminal=None
 if m['status']=='completed' or (run/'terminal-state.json').exists():terminal=validate_terminal_state(run,m)
 deliveries=[];execution=0;toolcount=0;questions=[];calls={};stepcount=0
 for i,sd in stages.items():
  sm=read(sd/'stage-run.json');execution+=sm['durationSeconds'];calls[i]=tool_calls(sd)
  d=read(sd/'delivery.json');deliveries.append(d)
  for index,row in enumerate(rows(sd/'lookout-trace.jsonl'),1):
   if row['type']=='user.interaction':questions.append({'stage':i,**row['data'],'interactionId':f'stage-{i}/lookout-trace.jsonl#L{index}'})
  for row in rows(sd/'trace.jsonl'):
   item=row.get('event',{}).get('item',{})
   if row.get('event',{}).get('type')=='item.completed' and item.get('type') in ['command_execution','mcp_tool_call','web_search','file_change']:stepcount+=1
  toolcount+=len(calls[i])
 complete=review is not None
 check_stages={k:[i for i,s in enumerate(spec['stages'],1) if k in s['checks']] for k in spec['quality']}
 check_stages['preservation']=list(stages)
 unavailable={k:any(i not in stages or read(stages[i]/'stage-run.json')['status']!='completed' for i in ids) or not ids for k,ids in check_stages.items()}
 additional=[]
 if complete:
  if review.get('version')!=spec['version'] or review.get('graderVersion')!=GRADER_VERSION or review.get('scenarioDigest')!=scenario_digest(spec):raise ValueError('Review/rubric version mismatch')
  if review.get('evidenceDigest')!=evidence_digest(run):raise ValueError('Review evidence changed')
  if not review.get('reviewer') or review.get('independentOfParticipant') is not True or review.get('interactionReviewComplete') is not True:raise ValueError('Independent complete interaction review required')
  if set(review.get('quality',{}))!=set(spec['quality']):raise ValueError('Missing or extra quality checks')
  for key,item in review['quality'].items():
   if type(item.get('pass')) is not bool:raise ValueError('Unresolved quality decision')
   if unavailable[key] and item['pass']:raise ValueError('Unreached/incomplete checkpoint cannot pass')
   if not unavailable[key]:
    check_review_evidence(run,item,check_stages[key],item['pass'])
    if item['pass'] and key in spec.get('durableChecks',[]):
     for i in check_stages[key]:
      refs=[ref.split('#')[0] for ref in item['evidence']]
      if m['condition']=='lookout' and f'stage-{i}/after-state.json' not in refs:raise ValueError('Durable quality needs native after-state')
      if m['condition']=='baseline' and not any(ref.startswith(f'stage-{i}/output/') for ref in refs):raise ValueError('Durable quality needs saved file evidence')
    if key in ['saved_state','report_accuracy']:
     if terminal is None or 'terminal-state.json' not in item.get('evidence',[]):raise ValueError('Independent terminal evidence required')
     if key=='saved_state' and f"stage-{len(spec['stages'])}/before-state.json" not in item.get('evidence',[]):raise ValueError('Pre-final snapshot evidence required for reconciliation review')
     if key=='report_accuracy' and item['pass'] and not any('/output/final-report.md' in ref for ref in item['evidence']):raise ValueError('Report evidence required')
   elif not item.get('reason'):raise ValueError('Unavailable checkpoint requires explanation')
  seen={q['interactionId'] for q in questions}
  for item in review.get('additionalInteractions',[]):
   if item.get('category') not in ['clarification','context_restatement','correction','reminder','approval']:raise ValueError('Unknown interaction category')
   ident=item.get('interactionId','')
   if ident in seen or '/trace.jsonl#L' not in ident:raise ValueError('Duplicate/invalid interaction identity; cite a unique agent-message line')
   verify_refs(run,item)
   filename,line=ident.rsplit('#L',1);sd=(run/filename).parent
   if sd not in stages.values():raise ValueError('Interaction stage was not reached')
   entries=rows(run/filename)
   if not line.isdigit() or not 1<=int(line)<=len(entries):raise ValueError('Interaction line missing')
   event=entries[int(line)-1].get('event',{})
   if event.get('type')!='item.completed' or event.get('item',{}).get('type')!='agent_message':raise ValueError('Additional demand must cite an agent message')
   if item.get('duplicatesCapturedQuestion') is not False:raise ValueError('Reviewer must explicitly rule out a captured question duplicate')
   seen.add(ident);additional.append(item)
 quality={k:(False if unavailable[k] else review['quality'][k]['pass'] if complete else None) for k in spec['quality']}
 adherence={}
 for key,rule in spec['adherence'].items():
  if m['condition']=='baseline':adherence[key]={'status':'not_applicable'};continue
  if rule['stage'] not in stages:adherence[key]={'status':'not_reached'};continue
  relevant=[x for x in calls.get(rule['stage'],[]) if x['name'] in rule['tools']]
  if not relevant:status='omitted'
  elif not any(x['success'] for x in relevant):status='attempted_but_failed'
  elif not complete:status='pending_review'
  else:
   item=review.get('adherence',{}).get(key,{})
   if type(item.get('outcomeVerified')) is not bool:raise ValueError('Missing native outcome verification')
   check_review_evidence(run,item,[rule['stage']],item['outcomeVerified'],native_write=rule.get('nativeWrite',False))
   status='used_correctly' if item['outcomeVerified'] else 'attempted_but_failed'
  adherence[key]={'status':status,'calls':relevant}
 metrics={'execution_seconds':execution,'tool_calls':toolcount,'observable_steps':stepcount,'assigned_initiations':sum(d['assignedInitiation'] for d in deliveries),'assigned_onboarding':sum(d['assignedOnboarding'] for d in deliveries),'necessary_user_updates':sum(d['necessaryUserUpdate'] for d in deliveries),'observed_question_turns':len(questions),'completed_execution':int(m['status']=='completed'),'stage_coverage':len(stages)/len(spec['stages'])}
 metrics.update(call_metrics(stages.values()))
 metrics.update(prescribed_user_turns=len(deliveries),scheduled_wakes=0,total_wall_seconds=m['durationSeconds'])
 for category in ['clarification','context_restatement','correction','reminder','approval']:
  metrics['observed_'+category+'_turns']=sum(q['category']==category for q in questions)
  if complete:metrics['observed_'+category+'_demands']=sum(x['category']==category for x in additional)
 if complete:
  metrics['quality_fraction']=sum(quality.values())/len(quality)
  metrics['quality_pass']=int(all(quality.values()) and m['status']=='completed')
  metrics['observed_unanswered_demands']=len(additional)
  applicable=[x for x in adherence.values() if x['status'] not in ['not_applicable','not_reached']]
  if m['condition']=='lookout':
   metrics['lookout_adherence_coverage']=len(applicable)/len(adherence)
   if applicable:metrics['lookout_adherence_fraction']=sum(x['status']=='used_correctly' for x in applicable)/len(applicable)
 latencies=[]
 for i,stage in enumerate(spec['stages'],1):
  delivered=next((d for d in deliveries if d['stage']==i),None)
  achieved=all(quality[k] is True for k in stage['checks']) and i in stages and read(stages[i]/'stage-run.json')['status']=='completed'
  resolved=complete or unavailable[stage['checks'][0]]
  metrics[f'stage_{i}_reached']=int(i in stages)
  if resolved:metrics[f'stage_{i}_success']=int(achieved)
  waiting=(delivered['triggerMinute']-delivered['releasedMinute'])+sum(q['simulatedDelayMinutes'] for q in questions if q['stage']==i) if achieved else None
  latencies.append({'stage':i,'eventId':stage['id'],'achieved':bool(achieved) if resolved else None,'simulated_waiting_minutes':waiting,'execution_seconds':read(stages[i]/'stage-run.json')['durationSeconds'] if i in stages else None})
 return {'cost':m.get('cost'),'version':spec['version'],'graderVersion':GRADER_VERSION,'scenarioDigest':scenario_digest(spec),'episodeId':m['episodeId'],'status':'graded' if complete else 'pending_review','evidenceDigest':evidence_digest(run),'reviewer':review.get('reviewer') if complete else None,'metrics':metrics,'quality':quality,'adherence':adherence,'latencies':latencies,'questions':questions,'additionalDemands':additional,'limitations':['Scripted interactions are not measured human cognitive effort.','Simulated waiting excludes compute and is not time to task completion.','Unanswered demands are not completed user exchanges.','Semantic quality and native outcomes require independent evidence review.']}

if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('--run',type=Path,required=True);p.add_argument('--scenario',type=Path,default=Path(__file__).resolve().parents[2]/'examples/com4/scenario.json');p.add_argument('--review',type=Path);p.add_argument('--template',action='store_true');p.add_argument('--output',type=Path,required=True);a=p.parse_args()
 result=template(a.run,read(a.scenario)) if a.template else grade(a.run,read(a.scenario),read(a.review) if a.review else None)
 if a.output.exists():raise SystemExit('Output exists; retain earlier grade/review versions')
 a.output.write_text(json.dumps(result,indent=2)+'\n');a.output.chmod(0o600)
 print(json.dumps({'saved':str(a.output),'status':result.get('status','review_template')}))
