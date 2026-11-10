"""Shared structural diagnostics; no private payloads are emitted."""
import json,hashlib,subprocess,uuid
from pathlib import Path

def call_metrics(stages):
 counts={k:0 for k in ['tool_discovery_calls','tool_read_calls','tool_write_calls','tool_user_calls','tool_other_calls','mcp_control_requests','tool_failed_calls','tool_unanswered_calls','tool_exact_retries_after_failure','tool_calls_after_same_tool_failure']}
 counts.update(shell_commands=0,shell_failed_commands=0)
 measured=0;timing={k:0 for k in ['mcp_startup_seconds','mcp_startup_response_bytes','mcp_discovery_seconds','mcp_discovery_response_bytes','mcp_task_tools_seconds','mcp_task_tools_response_bytes']}
 for stage in stages:
  trace=Path(stage)/'trace.jsonl'
  for line in trace.read_text().splitlines() if trace.exists() else []:
   event=json.loads(line).get('event',{});item=event.get('item',{})
   if event.get('type')=='item.completed' and item.get('type')=='command_execution':
    counts['shell_commands']+=1
    if item.get('exit_code') not in [None,0] or item.get('status')=='failed':counts['shell_failed_commands']+=1
  pending={};failed=set();failed_names=set()
  p=Path(stage)/'lookout-trace.jsonl'
  for line in p.read_text().splitlines() if p.exists() else []:
   row=json.loads(line);d=row.get('data',{})
   if row.get('type')=='mcp.measurement':
    measured+=1
    group='startup' if d['method'] in ['initialize','tools/list'] else 'discovery' if d.get('tool') in ['discover_tools','discover_toolkit','read_guide','read_developer_context'] else 'task_tools'
    timing['mcp_'+group+'_seconds']+=d['durationSeconds'];timing['mcp_'+group+'_response_bytes']+=d['responseBytes']
   if row.get('type')=='mcp.request':
    if d.get('method')!='tools/call':counts['mcp_control_requests']+=1;continue
    params=d.get('params',{});name=params.get('name','');args=params.get('arguments',{})
    if name=='call_discovered_tool':name=args.get('name','');args=args.get('arguments',{})
    fingerprint=hashlib.sha256(json.dumps([name,args],sort_keys=True).encode()).hexdigest()
    if fingerprint in failed:counts['tool_exact_retries_after_failure']+=1
    if name in failed_names:counts['tool_calls_after_same_tool_failure']+=1
    category='write' if name in ['start_agent_audit_run','append_agent_audit_events'] else 'discovery' if name in ['discover_tools','discover_toolkit','read_guide','read_developer_context'] else 'user' if name=='ask_user' else 'read' if name.startswith(('read_','list_','check_','search_')) else 'write' if name.startswith(('save_','update_','record_','create_','delete_','propose_')) else 'other'
    counts['tool_'+category+'_calls']+=1;pending[d['id']]=(name,fingerprint)
   elif row.get('type')=='mcp.response' and d.get('id') in pending:
    name,fingerprint=pending.pop(d['id'])
    if d.get('error') or d.get('result',{}).get('isError'):
     counts['tool_failed_calls']+=1;failed.add(fingerprint);failed_names.add(name)
   elif row.get('type')=='mcp.error':
    # A transport error has no trustworthy request identity; unresolved calls stay explicit.
    pass
  counts['tool_unanswered_calls']+=len(pending)
 if measured:counts.update(timing,mcp_measured_requests=measured)
 return counts

def verify_contact_writer(root):
 """Probe the real scoped DB dispatch in a rolled-back transaction, before inference."""
 a=json.loads((Path(root)/'account.private.json').read_text())
 if a.get('status')!='verified' or a.get('apiUrl')!='http://127.0.0.1:54321' or not a.get('email','').endswith('@example.test'):raise RuntimeError('Verified local fictional owner required')
 token_hash=hashlib.sha256(a['token'].encode()).hexdigest()
 record={'company':'Contract Probe','contact':'Fictional Probe','message':'Unsent fixture','nextAction':'Review draft','relationshipUpdates':[{'id':'probe-message','date':'2026-11-09','body':'Fictional received message'}]}
 payload=json.dumps({'id':'contract-probe-'+uuid.uuid4().hex,'expectedRevision':0,'record':record})
 sql="BEGIN; SELECT public.agent_dispatch('"+token_hash+"','contacts.save',$probe$"+payload+"$probe$::jsonb); ROLLBACK;"
 result=subprocess.run(['docker','exec','-i','supabase_db_lookout-local','psql','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1','-Atq'],input=sql,text=True,capture_output=True,timeout=30)
 if result.returncode:raise RuntimeError('Contact writer contract probe failed; align local migrations/runtime before inference (probe rolled back)')
 try:body=json.loads(result.stdout.strip());saved=body.get('data',body)
 except (ValueError,AttributeError):raise RuntimeError('Contact writer probe returned an invalid receipt')
 if saved.get('record')!=record or saved.get('user_id')!=a.get('userId'):raise RuntimeError('Contact writer probe owner/readback mismatch')
 return {'version':'communication-contact-contract-v1','verified':True,'fields':['message','nextAction','relationshipUpdates'],'rolledBack':True}

def verify_runtime_guidance(root):
 """Fail on stale runtime instructions rather than measuring an unintended product version."""
 import urllib.request
 root=Path(root);a=json.loads((root/'account.private.json').read_text());config=json.loads((root/'runtime-config.json').read_text())
 expected=config.get('requiredGuidance')
 if not expected:raise RuntimeError('Missing frozen product guidance versions; prepare a fresh setup')
 def call(name,args):
  req=urllib.request.Request(a['mcpUrl'],data=json.dumps({'jsonrpc':'2.0','id':1,'method':'tools/call','params':{'name':name,'arguments':args}}).encode(),headers={'Content-Type':'application/json','Accept':'application/json, text/event-stream','Authorization':'Bearer '+a['token']})
  with urllib.request.urlopen(req,timeout=30) as response:body=response.read().decode()
  if body.lstrip().startswith('data:'):body=next(x[6:] for x in body.splitlines() if x.startswith('data: ') and x[6:].startswith('{'))
  reply=json.loads(body)
  if reply.get('error') or reply.get('result',{}).get('isError'):raise RuntimeError('Runtime guidance read failed')
  value=reply['result'].get('structuredContent')
  if value is None:value=json.loads(next(b['text'] for b in reply['result']['content'] if b.get('type')=='text'))
  return value.get('data',value)
 context=call('read_developer_context',{});guide=call('read_guide',{'id':'cold-outreach'})
 if context.get('developerVersion')!=expected['developerVersion'] or guide.get('version')!=expected['outreachGuideVersion']:raise RuntimeError('Runtime guidance differs from frozen configuration; activate the intended runtime or prepare a new version')
 return expected


def verify_seed_contacts(root):
 """Roundtrip exact prospective contact records through scoped dispatch, rolled back."""
 root=Path(root);a=json.loads((root/'account.private.json').read_text())
 if a.get('status')!='verified' or a.get('apiUrl')!='http://127.0.0.1:54321' or not a.get('email','').endswith('@example.test'):raise RuntimeError('Local fictional owner required')
 contacts=json.loads((root/'suite/initial-state.json').read_text())['contacts']
 q=lambda x:"'"+str(x).replace("'","''")+"'"
 th=hashlib.sha256(a['token'].encode()).hexdigest()
 statements=['BEGIN;']
 for c in contacts:
  base=json.dumps({'id':c['id'],'record':c['record']})
  payload=q(base)+"::jsonb || jsonb_build_object('expectedRevision',coalesce((select revision from public.outreach_contacts where user_id="+q(a['userId'])+"::uuid and id="+q(c['id'])+"),0))"
  statements.append("SELECT public.agent_dispatch("+q(th)+",'contacts.save',"+payload+");")
 statements.append('ROLLBACK;')
 result=subprocess.run(['docker','exec','-i','supabase_db_lookout-local','psql','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1','-Atq'],input='\n'.join(statements),text=True,capture_output=True,timeout=30)
 if result.returncode:raise RuntimeError('Exact seeded contact validation failed; transaction rolled back')
 rows=[json.loads(line) for line in result.stdout.splitlines() if line.strip()]
 if len(rows)!=len(contacts):raise RuntimeError('Incomplete exact contact validation')
 for c,row in zip(contacts,rows):
  row=row.get('data',row)
  if row.get('user_id')!=a['userId'] or row.get('record')!=c['record']:raise RuntimeError('Exact contact roundtrip mismatch')
 return {'verified':True,'contacts':len(contacts),'rolledBack':True}
