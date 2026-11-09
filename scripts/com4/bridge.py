"""Host-side scoped transport. Instrumentation is never sent to participants."""
import argparse,json,re,sys,time,urllib.request
from pathlib import Path
from user_actor import answer as user_answer
p=argparse.ArgumentParser();p.add_argument('--root',type=Path,required=True);p.add_argument('--capture',type=Path,required=True);p.add_argument('--condition',choices=['baseline','lookout'],required=True);p.add_argument('--inputs',type=Path,required=True);a=p.parse_args()
account=json.loads((a.root/'account.private.json').read_text());config=json.loads((a.root/'runtime-config.json').read_text())
if account['status']!='verified' or account['mcpUrl']!='http://127.0.0.1:8080/mcp':raise SystemExit('Verified local account required')
allowed=set(config['allowedTools']);sequence=0
spec=json.loads((a.root/'suite/scenario.json').read_text())

def scrub(v):
 if isinstance(v,dict):return {k:('[REDACTED]' if re.search(r'token|password|credential|authorization|secret|signed.?url',k,re.I) else scrub(x)) for k,x in v.items()}
 if isinstance(v,list):return [scrub(x) for x in v]
 if isinstance(v,str):return re.sub(r'jb_agent_[A-Za-z0-9_-]+','[REDACTED]',v)
 return v

def record(kind,data):
 global sequence
 sequence+=1
 target=a.capture
 pointer=a.capture.parent.parent/'active-stage.json'
 if pointer.exists():target=a.capture.parent.parent/f"stage-{json.loads(pointer.read_text())['stage']}"/'lookout-trace.jsonl'
 with target.open('a') as f:f.write(json.dumps({'sequence':sequence,'timestamp':time.time(),'type':kind,'data':scrub(data)})+'\n')

def clean(v):
 if isinstance(v,list):return [clean(x) for x in v if not (isinstance(x,dict) and (x.get('id')=='agent-audit' or ('inputSchema' in x and x.get('name') not in allowed)))]
 if isinstance(v,dict):
  out={k:clean(x) for k,x in v.items()}
  if out.get('name')=='save_profile_package' and 'inputSchema' in out and config.get('profileIntroductionOnly'):
   props=out['inputSchema']['properties']
   out['inputSchema']['properties']={k:v for k,v in props.items() if k in ['eventKey','expectedPersonalVersion','facts','source']}
   out['inputSchema']['properties']['facts']['properties']={'introduction':props['facts']['properties']['introduction']}
   out['description']+=' This connection permits facts.introduction only; other profile fields and preferences are outside its permissions.'

  if isinstance(out.get('instructions'),list):out['instructions']=[x for x in out['instructions'] if 'Assignment data collection is enabled' not in str(x)]
  return out
 if isinstance(v,str):
  if v.startswith('{') or v.startswith('['):
   try:return json.dumps(clean(json.loads(v)))
   except ValueError:pass
  return v.replace('For authorized work load agent-audit to record the run.','Audit-writing tools are not available on this connection.')
 return v

def upstream(message):
 req=urllib.request.Request(account['mcpUrl'],data=json.dumps(message).encode(),headers={'Content-Type':'application/json','Accept':'application/json, text/event-stream','Authorization':'Bearer '+account['token']})
 with urllib.request.urlopen(req,timeout=90) as response:body=response.read().decode()
 if body.lstrip().startswith('data:'):body=next(x[6:] for x in body.splitlines() if x.startswith('data: ') and x[6:].startswith('{'))
 return json.loads(body)

def unwrap(result):
 value=result.get('structuredContent')
 if value is None:
  for block in result.get('content',[]):
   if block.get('type')=='text':
    try:value=json.loads(block['text']);break
    except ValueError:pass
 if isinstance(value,dict):return value.get('data',value)
 return value

LOCAL_TOOLS=[
 {'name':'read_calendar','description':'Read currently available calendar events.','inputSchema':{'type':'object','properties':{},'additionalProperties':False}},
 {'name':'read_inbox','description':'Read currently available inbox notifications. Repeated IDs represent the same message.','inputSchema':{'type':'object','properties':{},'additionalProperties':False}},
 {'name':'ask_user','description':'Ask the user a question when an answer is needed.','inputSchema':{'type':'object','properties':{'question':{'type':'string'}},'required':['question'],'additionalProperties':False}}
]
def local_call(name,args):
 if name in ['read_calendar','read_inbox']:
  return json.loads((a.inputs/'sources.json').read_text()).get('calendar' if name=='read_calendar' else 'inbox',[])
 question=args.get('question')
 pointer=a.capture.parent.parent/'active-stage.json'
 stage_index=json.loads(pointer.read_text())['stage'] if pointer.exists() else int(a.capture.parent.name.split('-')[-1])
 answer,category=user_answer(question,stage_index,spec)
 record('user.interaction',{'question':question,'answer':answer,'category':category,'simulatedDelayMinutes':spec['policy']['userResponseDelayMinutes']})
 return {'answer':answer}

def visible_tools(mid):
 if a.condition=='baseline':return {'jsonrpc':'2.0','id':mid,'result':{'tools':LOCAL_TOOLS}}
 # Preserve the native default surface. Supporting schemas are discovered by the participant.
 reply=clean(upstream({'jsonrpc':'2.0','id':mid,'method':'tools/list','params':{}}))
 if reply.get('error'):return reply
 reply['result']['tools']+=LOCAL_TOOLS
 return reply

def respond(msg,reply,started):
 params=msg.get('params',{});name=params.get('name')
 actual=params.get('arguments',{}).get('name') if name=='call_discovered_tool' else name
 encoded=json.dumps(reply)
 record('mcp.measurement',{'id':msg.get('id'),'method':msg.get('method'),'tool':actual,'wrapper':name if actual!=name else None,'durationSeconds':time.monotonic()-started,'responseBytes':len(encoded.encode()),'failed':bool(reply.get('error') or reply.get('result',{}).get('isError'))})
 record('mcp.response',reply);print(encoded,flush=True)

for line in sys.stdin:
 msg={};request_started=time.monotonic()
 try:
  msg=json.loads(line);mid=msg.get('id');method=msg.get('method')
  if mid is None:continue
  record('mcp.request',msg)
  request_started=time.monotonic()
  if method=='initialize':
   if a.condition=='lookout':
    reply=clean(upstream(msg))
    if not reply.get('error'):reply['result']['instructions']+='\nCalendar, inbox and user questions are available through the local tools.'
   else:reply={'jsonrpc':'2.0','id':mid,'result':{'protocolVersion':msg.get('params',{}).get('protocolVersion','2024-11-05'),'capabilities':{'tools':{}},'serverInfo':{'name':'workspace','version':'1'},'instructions':'Calendar, inbox and user questions are available.'}}
  elif method=='ping':reply={'jsonrpc':'2.0','id':mid,'result':{}}
  elif method=='tools/list':reply=visible_tools(mid)
  elif method=='tools/call':
   params=msg.get('params',{});name=params.get('name');args=params.get('arguments',{})
   actual=args.get('name') if name=='call_discovered_tool' else name
   payload=args.get('arguments',{}) if name=='call_discovered_tool' else args
   if name in {x['name'] for x in LOCAL_TOOLS}:
    reply={'jsonrpc':'2.0','id':mid,'result':{'content':[{'type':'text','text':json.dumps(local_call(name,args))}]}}
    respond(msg,reply,request_started);continue
   deny=a.condition!='lookout' or actual not in allowed or actual=='call_discovered_tool'
   if actual=='save_profile_package' and config.get('profileIntroductionOnly'):
    deny=deny or set(payload.get('facts',{}))!={'introduction'} or not set(payload)<={'eventKey','expectedPersonalVersion','facts','source'}
   if deny:reply={'jsonrpc':'2.0','id':mid,'result':{'isError':True,'content':[{'type':'text','text':'This operation is outside the current workspace permissions.'}]}}
   else:reply=clean(upstream(msg))
  else:reply={'jsonrpc':'2.0','id':mid,'error':{'code':-32601,'message':'Method not supported'}}
  respond(msg,reply,request_started)
 except Exception as e:
  record('mcp.error',{'errorType':type(e).__name__,'detail':str(e)[:400]})
  respond(msg,{'jsonrpc':'2.0','id':msg.get('id'),'error':{'code':-32603,'message':'Workspace service failed: '+type(e).__name__}},request_started)
