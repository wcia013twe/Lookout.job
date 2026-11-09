"""Host-side scoped transport. Instrumentation is never sent to participants."""
import argparse,json,re,sys,time,urllib.request
from pathlib import Path
from user_actor import answer as user_answer
from search import search,read_source
search_counts={}
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
 {'name':'search_sources','description':'Search available public source snapshots by text. Read sources to verify details.','inputSchema':{'type':'object','properties':{'query':{'type':'string'},'limit':{'type':'integer','minimum':1,'maximum':10},'cursor':{'type':'string'}},'required':['query'],'additionalProperties':False}},
 {'name':'read_source','description':'Read an available source by its returned ID or URL.','inputSchema':{'type':'object','properties':{'sourceId':{'type':'string'}},'required':['sourceId'],'additionalProperties':False}},
 {'name':'read_calendar','description':'Read released historical calendar evidence; reconcile later updates.','inputSchema':{'type':'object','properties':{},'additionalProperties':False}},
 {'name':'read_inbox','description':'Read all released emails deduplicated by ID; currentNotifications in sources.json identifies new deliveries.','inputSchema':{'type':'object','properties':{},'additionalProperties':False}},
 {'name':'ask_user','description':'Ask the user a question when an answer is needed.','inputSchema':{'type':'object','properties':{'question':{'type':'string'}},'required':['question'],'additionalProperties':False}}
]
def local_call(name,args):
 if name in ['search_sources','read_source']:
  pointer=a.capture.parent.parent/'active-stage.json'
  index=json.loads(pointer.read_text())['stage'] if pointer.exists() else 1
  stage=spec['stages'][index-1];session=stage['session']
  count=search_counts.get(session,0)
  if count>=spec['policy']['searchCallsPerSession']:raise ValueError('Source-tool budget exhausted for this session')
  search_counts[session]=count+1
  corpus=json.loads((a.root/'suite/corpus.json').read_text())
  result=search(corpus,stage['corpusVersion'],args.get('query'),args.get('limit',8),args.get('cursor')) if name=='search_sources' else read_source(corpus,stage['corpusVersion'],args.get('sourceId'))
  record('source.access',{'stage':index,'session':session,'operation':name,'arguments':args,'result':result,'callNumber':count+1})
  return result
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
 # Retrieve genuine registered schemas, expose allowed gated tools as direct named calls.
 reply=upstream({'jsonrpc':'2.0','id':mid,'method':'tools/list','params':{}})
 if reply.get('error'):return reply
 byname={t['name']:t for t in reply.get('result',{}).get('tools',[]) if t.get('name') in allowed}
 discovered=upstream({'jsonrpc':'2.0','id':mid,'method':'tools/call','params':{'name':'discover_tools','arguments':{'workflow':'all'}}})
 if discovered.get('error') or discovered.get('result',{}).get('isError'):raise RuntimeError('Tool discovery unavailable')
 value=unwrap(discovered['result']);registered=value.get('tools',[]) if isinstance(value,dict) else []
 for t in registered:
  if t.get('name') in allowed:byname[t['name']]={k:v for k,v in t.items() if k in ['name','description','inputSchema','annotations']}
 missing=allowed-set(byname)
 if missing:raise RuntimeError('Required tools unavailable: '+','.join(sorted(missing)))
 if config.get('profileIntroductionOnly') and 'save_profile_package' in byname:
  t=byname['save_profile_package'];props=t['inputSchema']['properties']
  t['inputSchema']['properties']={k:v for k,v in props.items() if k in ['eventKey','expectedPersonalVersion','facts','source']}
  t['inputSchema']['properties']['facts']['properties']={'introduction':props['facts']['properties']['introduction']}
  t['description']='Save a user-authorized change to the personal introduction. Read current personalVersion first and preserve unrelated introduction text. Supply facts.introduction only with expectedPersonalVersion and a stable eventKey. This does not change other profile facts, search preferences or human verification.'
 return {'jsonrpc':'2.0','id':mid,'result':{'tools':clean(list(byname.values()))+LOCAL_TOOLS}}

for line in sys.stdin:
 try:
  msg=json.loads(line);mid=msg.get('id');method=msg.get('method')
  if mid is None:continue
  record('mcp.request',msg)
  if method=='initialize':reply={'jsonrpc':'2.0','id':mid,'result':{'protocolVersion':msg.get('params',{}).get('protocolVersion','2024-11-05'),'capabilities':{'tools':{}},'serverInfo':{'name':'workspace','version':'1'},'instructions':'Calendar, inbox and user questions are available. '+('Connected Lookout records store personal context and recruiting work. Preserve unrelated facts and history when updating records.' if a.condition=='lookout' else '')}}
  elif method=='ping':reply={'jsonrpc':'2.0','id':mid,'result':{}}
  elif method=='tools/list':reply=visible_tools(mid)
  elif method=='tools/call':
   params=msg.get('params',{});name=params.get('name');args=params.get('arguments',{})
   actual=args.get('name') if name=='call_discovered_tool' else name
   payload=args.get('arguments',{}) if name=='call_discovered_tool' else args
   if name in {x['name'] for x in LOCAL_TOOLS}:
    reply={'jsonrpc':'2.0','id':mid,'result':{'content':[{'type':'text','text':json.dumps(local_call(name,args))}]}}
    record('mcp.response',reply);print(json.dumps(reply),flush=True);continue
   deny=a.condition!='lookout' or actual not in allowed
   if actual=='save_profile_package' and config.get('profileIntroductionOnly'):
    deny=deny or set(payload.get('facts',{}))!={'introduction'} or not set(payload)<={'eventKey','expectedPersonalVersion','facts','source'}
   if deny:reply={'jsonrpc':'2.0','id':mid,'result':{'isError':True,'content':[{'type':'text','text':'This operation is outside the current workspace permissions.'}]}}
   else:reply=clean(upstream(msg))
  else:reply={'jsonrpc':'2.0','id':mid,'error':{'code':-32601,'message':'Method not supported'}}
  record('mcp.response',reply);print(json.dumps(reply),flush=True)
 except Exception as e:
  record('mcp.error',{'errorType':type(e).__name__,'detail':str(e)[:400]})
  print(json.dumps({'jsonrpc':'2.0','id':locals().get('mid'),'error':{'code':-32603,'message':'Workspace service failed: '+type(e).__name__}}),flush=True)
