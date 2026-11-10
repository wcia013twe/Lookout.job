"""Structural usage accounting; no prompts, reasoning text or credentials are collected."""
import json, math, hashlib, subprocess
from datetime import date
from pathlib import Path
FIELDS=('input_tokens','cached_input_tokens','output_tokens')
# Read only the current isolated container's matching session. Never host history.
COLLECTOR=r'''
import json,sys
from pathlib import Path
session=sys.argv[1]
files=list(Path('/root/.codex/sessions').rglob('*'+session+'*.jsonl'))
if len(files)!=1: raise ValueError('Expected one session log')
total=None; models=set(); records=0
for line in files[0].open():
 try:r=json.loads(line)
 except ValueError:continue
 p=r.get('payload',{})
 if r.get('type')=='turn_context' and isinstance(p.get('model'),str):models.add(p['model'])
 if r.get('type')=='event_msg' and p.get('type')=='token_count':
  t=(p.get('info') or {}).get('total_token_usage')
  if isinstance(t,dict):
   total={k:t[k] for k in ('input_tokens','cached_input_tokens','output_tokens','reasoning_output_tokens','cache_write_input_tokens') if k in t};records+=1
print(json.dumps({'totals':total,'models':sorted(models),'records':records}))
'''
def capture(container,session):
 if session is None:return {'totals':{k:0 for k in FIELDS},'models':[],'records':0,'freshSession':True}
 try:
  p=subprocess.run(['docker','exec',container,'python3','-c',COLLECTOR,session],capture_output=True,text=True,timeout=10)
  if p.returncode:return {'error':'session_usage_unavailable'}
  return json.loads(p.stdout)
 except (OSError,ValueError,subprocess.TimeoutExpired):return {'error':'session_usage_unavailable'}
def integer(x):return type(x) is int and x>=0
def delta(before,after,complete):
 result={'schemaVersion':1,'source':'codex_session_total_token_usage_delta','status':'unknown','tokens':None,'model':None,'before':before,'after':after,'billedUsd':None}
 a,b=before.get('totals'),after.get('totals')
 if not isinstance(a,dict) or not isinstance(b,dict):return result
 if not all(integer(a.get(k)) and integer(b.get(k)) and b[k]>=a[k] for k in FIELDS):return result
 if after.get('records',0)<=before.get('records',0):return result
 t={k:b[k]-a[k] for k in FIELDS}
 if t['cached_input_tokens']>t['input_tokens']:return result
 for k in ('reasoning_output_tokens','cache_write_input_tokens'):
  av=0 if before.get('freshSession') else a.get(k)
  if integer(av) and integer(b.get(k)) and b[k]>=av:t[k]=b[k]-av
 # Reasoning is an output subset; never add it to output a second time.
 if t.get('reasoning_output_tokens',0)>t['output_tokens']:return result
 models=after.get('models',[])
 result.update(status='complete' if complete else 'partial',tokens=t,model=models[0] if len(models)==1 else None)
 return result

def number(x):return type(x) in (int,float) and math.isfinite(x) and x>=0

def validate_policy(p):
 if p.get('schemaVersion')!=1 or p.get('currency')!='USD':raise ValueError('Unsupported cost policy')
 seen=set()
 for r in p.get('rates',[]):
  if not isinstance(r.get('model'),str) or r['model'] in seen:raise ValueError('Exact unique model required')
  seen.add(r['model'])
  if not isinstance(r.get('sourceUrl'),str) or not r['sourceUrl'].startswith('https://') or not isinstance(r.get('asOf'),str):raise ValueError('Pricing source and date required')
  date.fromisoformat(r['asOf'])
  if r.get('outputIncludesReasoning') is not True or r.get('cacheWriteIncludedInInput') is not True:raise ValueError('Unsupported token price convention')
  if not all(number(r.get(k)) for k in ('inputUsdPerMillion','cachedInputUsdPerMillion','outputUsdPerMillion')):raise ValueError('Nonnegative USD rates required')
 ledger=p.get('externalCosts') or {}
 vals=[ledger.get(k) for k in ('toolUsd','infrastructureUsd','lookoutProcessingUsd')]
 if any(v is not None and not number(v) for v in vals):raise ValueError('Invalid external costs')
 if any(v is not None for v in vals) and not ledger.get('source'):raise ValueError('External cost provenance required')
 return p

def summarize(run,policy_path=None):
 run=Path(run)
 policy=validate_policy(json.loads(Path(policy_path).read_text())) if policy_path and Path(policy_path).exists() else {'schemaVersion':1,'currency':'USD','rates':[]}
 rates={x['model']:x for x in policy.get('rates',[])}
 stages=[]
 for f in sorted(run.glob('stage-*/stage-run.json')):
  m=json.loads(f.read_text());c=m.get('cost',{'status':'unknown','tokens':None,'model':None})
  t=c.get('tokens');rate=rates.get(c.get('model'));usd=None
  if t is not None and rate:
   usd=((t['input_tokens']-t['cached_input_tokens'])*rate['inputUsdPerMillion']+t['cached_input_tokens']*rate['cachedInputUsdPerMillion']+t['output_tokens']*rate['outputUsdPerMillion'])/1e6
  stages.append({'stage':f.parent.name,'status':c['status'],'tokens':t,'model':c.get('model'),'estimatedModelUsd':usd,'pricing':rate,'source':'stage-run.json.cost'})
 covered=sum(s['status']=='complete' for s in stages)
 complete=bool(stages) and covered==len(stages)
 priced=complete and all(s['estimatedModelUsd'] is not None for s in stages)
 observed={k:sum((s['tokens'] or {}).get(k,0) for s in stages) for k in FIELDS}
 # External accounting needs a complete, independently attributable USD ledger.
 ledger=policy.get('externalCosts') or {}
 external={k:ledger.get(k) for k in ('toolUsd','infrastructureUsd','lookoutProcessingUsd')}
 if any(v is not None and not number(v) for v in external.values()):raise ValueError('Invalid external costs')
 if any(v is not None for v in external.values()) and not ledger.get('source'):raise ValueError('External cost provenance required')
 model_usd=sum(s['estimatedModelUsd'] for s in stages) if priced else None
 external_complete=all(v is not None for v in external.values())
 return {'schemaVersion':1,'basis':'estimated_api_equivalent_not_subscription_invoice','currency':'USD','coverage':{'status':'complete' if complete else 'partial' if any(s['tokens'] is not None for s in stages) else 'unknown','attemptedStages':len(stages),'coveredStages':covered},'tokens':observed if complete else None,'observedTokens':observed if any(s['tokens'] is not None for s in stages) else None,'estimatedModelUsd':model_usd,'externalCosts':{**external,'source':ledger.get('source')},'estimatedTotalUsd':model_usd+sum(external.values()) if model_usd is not None and external_complete else None,'billedUsd':None,'pricingPolicyDigest':hashlib.sha256(json.dumps(policy,sort_keys=True).encode()).hexdigest(),'stages':stages,'limitations':['Provider-reported counters; unreported usage is unknown.','Failed or killed stages without final counters have incomplete coverage.','Models without exact sourced rates are unpriced.','Subscription allocation and unmetered Lookout processing are not assumed free.']}

def persist(run,policy_path=None):
 result=summarize(run,policy_path)
 p=Path(run)/'cost.json';p.write_text(json.dumps(result,indent=2)+'\n');p.chmod(0o600)
 return result

# Offline paper aggregation: explicit judged success; all attempts contribute costs.
def aggregate(entries):
 groups={};seen=set()
 for entry in entries:
  run=json.loads((Path(entry['run'])/'run.json').read_text())
  identity=run['episodeId']
  if identity in seen:raise ValueError('Duplicate episode in cost aggregate')
  seen.add(identity)
  success=entry.get('success')
  if success is not None and type(success) is not bool:raise ValueError('success must be boolean or null')
  if success is True and run['status']!='completed':raise ValueError('Incomplete attempt cannot succeed')
  c=run.get('cost') or {}
  key=(run.get('version'),run.get('model'),run['condition'],run.get('pilot',False),c.get('pricingPolicyDigest'))
  groups.setdefault(key,[]).append((c,success))
 result=[]
 for key,items in groups.items():
  totals=[c.get('estimatedTotalUsd') for c,_ in items];models=[c.get('estimatedModelUsd') for c,_ in items]
  success_count=sum(s is True for _,s in items);judged=all(s is not None for _,s in items)
  total=sum(totals) if all(number(x) for x in totals) else None
  model=sum(models) if all(number(x) for x in models) else None
  result.append({'version':key[0],'model':key[1],'condition':key[2],'pilot':key[3],'pricingPolicyDigest':key[4],'attempts':len(items),'judgedAttempts':sum(s is not None for _,s in items),'successes':success_count,'estimatedTotalUsd':total,'estimatedModelUsd':model,'estimatedUsdPerSuccess':total/success_count if total is not None and judged and success_count else None,'estimatedModelUsdPerSuccess':model/success_count if model is not None and judged and success_count else None})
 return result

if __name__=='__main__':
 import argparse
 p=argparse.ArgumentParser(description='Aggregate cost from explicit run/success manifests; never re-run participants.')
 p.add_argument('--aggregate',required=True,help='JSON: {cohortId, attempts:[{run,success}]}');p.add_argument('--output',required=True)
 a=p.parse_args();manifest=json.loads(Path(a.aggregate).read_text())
 if not isinstance(manifest.get('cohortId'),str) or not manifest['cohortId'].strip():raise ValueError('Explicit cohortId required')
 result={'schemaVersion':1,'cohortId':manifest['cohortId'],'groups':aggregate(manifest['attempts']),'basis':'estimated_api_equivalent_not_subscription_invoice'}
 with open(a.output,'x') as f:json.dump(result,f,indent=2);f.write('\n')
