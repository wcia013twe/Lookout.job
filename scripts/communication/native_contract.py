"""Prospective COM03/04 native-contract checks; never inject host discoveries into participants."""
import hashlib,json,subprocess,urllib.request,uuid
from pathlib import Path

def capture_native_contract(root):
 root=Path(root);a=json.loads((root/'account.private.json').read_text());cfg=json.loads((root/'runtime-config.json').read_text())
 if a.get('status')!='verified' or a.get('mcpUrl')!='http://127.0.0.1:8080/mcp' or a.get('benchmarkTaskId') not in ['COM3','COM4']:raise ValueError('Dedicated local account required')
 def request(method,params):
  req=urllib.request.Request(a['mcpUrl'],data=json.dumps({'jsonrpc':'2.0','id':1,'method':method,'params':params}).encode(),headers={'Content-Type':'application/json','Accept':'application/json, text/event-stream','Authorization':'Bearer '+a['token']})
  with urllib.request.urlopen(req,timeout=90) as response:body=response.read().decode()
  if body.lstrip().startswith('data:'):body=next(x[6:] for x in body.splitlines() if x.startswith('data: ') and x[6:].startswith('{'))
  reply=json.loads(body)
  if reply.get('error') or reply.get('result',{}).get('isError'):raise RuntimeError('Native contract lookup failed')
  return reply['result']
 def call(name,args):
  result=request('tools/call',{'name':name,'arguments':args});value=result.get('structuredContent')
  if value is None:value=json.loads(next(x['text'] for x in result['content'] if x['type']=='text'))
  return value.get('data',value)
 init=request('initialize',{'protocolVersion':'2025-06-18','capabilities':{},'clientInfo':{'name':'contract-verifier','version':'1'}})
 default=request('tools/list',{})['tools'];discovered=call('discover_tools',{'workflow':'all'})['tools']
 names={t['name'] for t in default+discovered}
 if not set(cfg['allowedTools'])<=names:raise RuntimeError('Required native tool unavailable')
 bodies={'startup':init['instructions'],'tools':sorted(default+discovered,key=lambda t:t['name']),'cold-outreach':call('read_guide',{'id':'cold-outreach'}),'agent-audit':call('read_guide',{'id':'agent-audit'})}
 return {'version':1,'sha256':{k:hashlib.sha256(json.dumps(v,sort_keys=True,separators=(',',':')).encode()).hexdigest() for k,v in bodies.items()},'requiredToolsAvailable':True}

def verify_native_contract(root):
 if capture_native_contract(root)!=json.loads((Path(root)/'native-contract.json').read_text()):raise RuntimeError('Native startup/schema/guide drift; retain evidence, do not retry participant')
 return True

def verify_audit_contract(root):
 a=json.loads((Path(root)/'account.private.json').read_text())
 if a.get('status')!='verified' or a.get('apiUrl')!='http://127.0.0.1:54321' or a.get('benchmarkTaskId') not in ['COM3','COM4']:raise ValueError('Dedicated local account required')
 if not {'workspace:read','activity:write'}<=set(a['scopes']):raise ValueError('Native startup scopes missing')
 q=lambda s:"'"+s.replace("'","''")+"'"
 token_hash=hashlib.sha256(a['token'].encode()).hexdigest();key='preflight-'+uuid.uuid4().hex
 payload=json.dumps({'eventKey':key,'task':'Fictional rolled-back audit probe','area':'network','mode':'controlled'})
 sql=f"""BEGIN; DO $probe$ DECLARE r jsonb; x jsonb; BEGIN
 r:=public.agent_audit_dispatch('{token_hash}','audit.start',{q(payload)}::jsonb); r:=coalesce(r->'data',r);
 IF r->>'user_id' IS DISTINCT FROM {q(a['userId'])} THEN RAISE EXCEPTION 'Audit owner mismatch'; END IF;
 x:=public.agent_audit_dispatch('{token_hash}','audit.append',jsonb_build_object('runId',r->>'id','events',jsonb_build_array(jsonb_build_object('eventKey','done','kind','run.finished','summary','Rolled back probe'))));
 x:=public.agent_audit_dispatch('{token_hash}','audit.read',jsonb_build_object('runId',r->>'id'));x:=coalesce(x->'data',x);
 IF x->'events'->0->>'event_key' IS DISTINCT FROM 'done' THEN RAISE EXCEPTION 'Audit readback mismatch'; END IF;
 END $probe$; ROLLBACK;"""
 result=subprocess.run(['docker','exec','-i','supabase_db_lookout-local','psql','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1','-Atq'],input=sql,text=True,capture_output=True,timeout=30)
 if result.returncode:raise RuntimeError('Native audit write/read probe failed; transaction rolled back')
 return {'verified':True,'rolledBack':True}

def infrastructure_metrics(stages):
 result={'session_startup_seconds':0,'session_startup_count':0,'native_audit_calls':0,'native_audit_seconds':0,'native_audit_response_bytes':0}
 for stage in stages:
  stage=Path(stage);p=stage/'session-startup.json'
  if p.exists():
   result['session_startup_seconds']+=json.loads(p.read_text())['durationSeconds'];result['session_startup_count']+=1
  p=stage/'lookout-trace.jsonl'
  for line in p.read_text().splitlines() if p.exists() else []:
   row=json.loads(line);d=row.get('data',{})
   if row.get('type')=='mcp.measurement' and d.get('tool') in ['start_agent_audit_run','append_agent_audit_events','read_agent_audit_run']:
    result['native_audit_calls']+=1;result['native_audit_seconds']+=d['durationSeconds'];result['native_audit_response_bytes']+=d['responseBytes']
 return result
