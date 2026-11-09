"""Independent local-first grading. Missing semantic review is pending, never a pass."""
import argparse,hashlib,json
from pathlib import Path
TERMINAL={'completed','execution_failed','timed_out','setup_failed','artifact_failed'}

def read(p):return json.loads(p.read_text())
def rows(p):return [json.loads(x) for x in p.read_text().splitlines() if x] if p.exists() else []
def evidence_digest(run):
 h=hashlib.sha256()
 for p in sorted(run.rglob('*')):
  if p.is_file() and not p.is_symlink() and (p.name in ['run.json','trace.jsonl','lookout-trace.jsonl','delivery.json','stage-run.json','after-state.json','before-state.json','initial-state.json','final-state.json','prompt.txt'] or 'output' in p.parts):
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
 for p in requests.values():result.append({'name':p['name'],'success':False})
 return result

def template(run,spec):
 return {'version':spec['version'],'evidenceDigest':evidence_digest(run),'reviewer':None,'independentOfParticipant':True,'quality':{k:{'pass':None,'reason':'','evidence':[]} for k in spec['quality']},'adherence':{k:{'outcomeVerified':None,'reason':'','evidence':[]} for k in spec['adherence']},'additionalInteractions':[], 'interactionReviewComplete':False}

def verify_refs(run,item):
 if not item.get('reason') or not item.get('evidence'):raise ValueError('Review decisions require reason and evidence paths')
 for ref in item['evidence']:
  p=(run/ref.split('#')[0]).resolve()
  if not p.is_relative_to(run.resolve()) or not p.is_file() or p.is_symlink():raise ValueError('Invalid review evidence reference')

def grade(run,spec,review=None):
 run=Path(run);m=read(run/'run.json')
 if m['status'] not in TERMINAL:raise ValueError('Cannot grade an active run')
 if m.get('version')!=spec['version']:raise ValueError('Wrong scenario version')
 stages=sorted(run.glob('stage-*'),key=lambda p:int(p.name.split('-')[1]))
 deliveries=[];execution=0;toolcount=0;questions=[];calls={};stepcount=0
 for sd in stages:
  if not (sd/'stage-run.json').exists():continue
  sm=read(sd/'stage-run.json');execution+=sm['durationSeconds'];calls[int(sd.name.split('-')[1])]=tool_calls(sd)
  d=read(sd/'delivery.json');deliveries.append(d)
  for row in rows(sd/'lookout-trace.jsonl'):
   if row['type']=='user.interaction':questions.append({'stage':d['stage'],**row['data']})
  for row in rows(sd/'trace.jsonl'):
   item=row.get('event',{}).get('item',{})
   if row.get('event',{}).get('type')=='item.completed' and item.get('type') in ['command_execution','mcp_tool_call','web_search','file_change']:stepcount+=1
  toolcount+=len(calls[d['stage']])
 complete=review is not None
 if complete:
  if review.get('evidenceDigest')!=evidence_digest(run):raise ValueError('Review evidence changed')
  if not review.get('reviewer') or review.get('independentOfParticipant') is not True or review.get('interactionReviewComplete') is not True:raise ValueError('Independent complete interaction review required')
  if set(review.get('quality',{}))!=set(spec['quality']):raise ValueError('Missing or extra quality checks')
  for item in review['quality'].values():
   if type(item.get('pass')) is not bool:raise ValueError('Unresolved quality decision')
   verify_refs(run,item)
  for item in review.get('additionalInteractions',[]):
   if item.get('category') not in ['clarification','context_restatement','correction','reminder','approval']:raise ValueError('Unknown interaction category')
   verify_refs(run,item)
 quality={k:(review['quality'][k]['pass'] if complete else None) for k in spec['quality']}
 adherence={}
 for key,rule in spec['adherence'].items():
  if m['condition']=='baseline':adherence[key]={'status':'not_applicable'};continue
  relevant=[x for x in calls.get(rule['stage'],[]) if x['name'] in rule['tools']]
  if not relevant:status='omitted'
  elif not any(x['success'] for x in relevant):status='attempted_but_failed'
  elif not complete:status='pending_review'
  else:
   item=review.get('adherence',{}).get(key,{})
   if type(item.get('outcomeVerified')) is not bool:raise ValueError('Missing native outcome verification')
   verify_refs(run,item)
   status='used_correctly' if item['outcomeVerified'] else 'attempted_but_failed'
  adherence[key]={'status':status,'calls':relevant}
 metrics={'execution_seconds':execution,'tool_calls':toolcount,'observable_steps':stepcount,'assigned_initiations':sum(d['assignedInitiation'] for d in deliveries),'assigned_onboarding':sum(d['assignedOnboarding'] for d in deliveries),'necessary_user_updates':sum(d['necessaryUserUpdate'] for d in deliveries),'observed_question_turns':len(questions),'completed_execution':int(m['status']=='completed')}
 for category in ['clarification','context_restatement','correction','reminder','approval']:
  metrics['observed_'+category+'_turns']=sum(q['category']==category for q in questions)
  if complete:metrics['observed_'+category+'_turns']+=sum(x['category']==category for x in review.get('additionalInteractions',[]))
 if complete:
  metrics['quality_fraction']=sum(quality.values())/len(quality)
  metrics['quality_pass']=int(all(quality.values()) and m['status']=='completed')
  metrics['observed_additional_interactions']=len(questions)+len(review.get('additionalInteractions',[]))
  if m['condition']=='lookout':metrics['lookout_adherence_fraction']=sum(x['status']=='used_correctly' for x in adherence.values())/len(adherence)
 latencies=[]
 for i,stage in enumerate(spec['stages'],1):
  sd=run/f'stage-{i}';delivered=next((d for d in deliveries if d['stage']==i),None)
  achieved=complete and all(quality[k] for k in stage['checks']) and (sd/'stage-run.json').exists() and read(sd/'stage-run.json')['status']=='completed'
  latencies.append({'stage':i,'eventId':stage['id'],'achieved':bool(achieved) if complete else None,'simulated_minutes':((delivered['triggerMinute']-delivered['releasedMinute'])+sum(q['simulatedDelayMinutes'] for q in questions if q['stage']==i)) if achieved else None,'execution_seconds':read(sd/'stage-run.json')['durationSeconds'] if (sd/'stage-run.json').exists() else None})
 return {'version':spec['version'],'episodeId':m['episodeId'],'status':'graded' if complete else 'pending_review','evidenceDigest':evidence_digest(run),'reviewer':review.get('reviewer') if complete else None,'metrics':metrics,'quality':quality,'adherence':adherence,'latencies':latencies,'questions':questions,'limitations':['Scripted interactions are not measured human cognitive effort.','Initiation delays are equal and zero; no artificial scheduling speed advantage.','Simulated latency excludes compute; execution duration reported separately.','Semantic quality and durable native outcome require independent evidence review.']}

if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('--run',type=Path,required=True);p.add_argument('--scenario',type=Path,default=Path(__file__).resolve().parents[2]/'examples/n01/scenario.json');p.add_argument('--review',type=Path);p.add_argument('--template',action='store_true');p.add_argument('--output',type=Path,required=True);a=p.parse_args()
 result=template(a.run,read(a.scenario)) if a.template else grade(a.run,read(a.scenario),read(a.review) if a.review else None)
 if a.output.exists():raise SystemExit('Output exists; retain earlier grade/review versions')
 a.output.write_text(json.dumps(result,indent=2)+'\n');a.output.chmod(0o600)
 print(json.dumps({'saved':str(a.output),'status':result.get('status','review_template')}))
