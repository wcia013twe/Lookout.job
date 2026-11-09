"""JOB02 stdio MCP bridge. No human credentials enter participant containers."""
import argparse,json,re,subprocess,sys,time,urllib.request
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument('--root',type=Path,required=True);p.add_argument('--capture',type=Path,required=True);p.add_argument('--condition',required=True);p.add_argument('--run',type=Path,required=True);a=p.parse_args()
spec=json.loads((a.root/'suite/scenario.json').read_text());account=json.loads((a.root/'account.private.json').read_text());allowed=set(spec['allowedTools'])
browser=subprocess.Popen(['node',str(Path(__file__).with_name('browser.mjs')),str(a.run/'browser-config.private.json')],stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=(a.run/'browser-stderr.log').open('a'),text=True)
seq=0
def scrub(x):
 if isinstance(x,dict):return {k:('[REDACTED]' if re.search('token|password|secret|signed.?url|hostOnly|hostKey',k,re.I) else scrub(v)) for k,v in x.items()}
 if isinstance(x,list):return [scrub(v) for v in x]
 if isinstance(x,str):return re.sub(r'jb_agent_[A-Za-z0-9_-]+','[REDACTED]',x)
 return x

def trace(kind,data):
 global seq
 seq+=1;stage=json.loads((a.run/'active-stage.json').read_text())['stage'];target=a.run/f'stage-{stage}'/'lookout-trace.jsonl'
 with target.open('a')as f:f.write(json.dumps({'sequence':seq,'timestamp':time.time(),'type':kind,'data':scrub(data)})+'\n')

def upstream(msg):
 req=urllib.request.Request(account['mcpUrl'],data=json.dumps(msg).encode(),headers={'Content-Type':'application/json','Accept':'application/json, text/event-stream','Authorization':'Bearer '+account['token']})
 with urllib.request.urlopen(req,timeout=60)as r:body=r.read().decode()
 if body.lstrip().startswith('data:'):body=next(x[6:] for x in body.splitlines() if x.startswith('data: {'))
 return json.loads(body)

def unwrap(r):
 if r.get('error')or r.get('result',{}).get('isError'):raise RuntimeError('Native tool discovery failed')
 x=r['result'].get('structuredContent')
 if x is None:x=json.loads(next(c['text'] for c in r['result']['content'] if c['type']=='text'))
 return x.get('data',x)

def obj(props,required):return {'type':'object','properties':props,'required':required,'additionalProperties':False}
text={'type':'string'}
tools=[{'name':'ask_user','description':'Save a specific missing-information question for the controlled user response at the next session. Do independent work meanwhile.','inputSchema':obj({'targetId':text,'question':text},['targetId','question'])},{'name':'read_user_updates','description':'Read actual user responses currently released to this session.','inputSchema':obj({},[])}]
for name,props,required in [('browser_open',{'targetId':text},['targetId']),('browser_inspect',{'targetId':text},['targetId']),('browser_fill',{'targetId':text,'fieldId':text,'value':{'oneOf':[text,{'type':'boolean'}]},'expectedFingerprint':text},['targetId','fieldId','value','expectedFingerprint']),('browser_upload_resume',{'targetId':text,'fieldId':text,'expectedFingerprint':text},['targetId','fieldId','expectedFingerprint'])]:tools.append({'name':name,'description':'Bounded live application operation; no Submit, click, keyboard or arbitrary scripts. Use exact inspected fields.','inputSchema':obj(props,required)})
def clean(x):
 if isinstance(x,list):return [clean(y)for y in x if not isinstance(y,dict)or 'inputSchema'not in y or y.get('name')in allowed]
 if isinstance(x,dict):return {k:clean(v)for k,v in x.items()}
 if isinstance(x,str)and x.startswith(('{','[')):
  try:return json.dumps(clean(json.loads(x)))
  except ValueError:pass
 return x

def schemas(mid):
 native=[]
 if a.condition=='lookout':
  reply=upstream({'jsonrpc':'2.0','id':mid,'method':'tools/list','params':{}});by={t['name']:t for t in reply['result']['tools']if t['name']in allowed}
  more=unwrap(upstream({'jsonrpc':'2.0','id':mid,'method':'tools/call','params':{'name':'discover_tools','arguments':{'workflow':'all'}}}))
  for t in more.get('tools',[]):
   if t.get('name')in allowed:by[t['name']]={k:v for k,v in t.items()if k in ['name','description','inputSchema','annotations']}
  if allowed-set(by):raise RuntimeError('Required actual native schemas missing: '+','.join(sorted(allowed-set(by))))
  native=list(by.values())
 return tools+native

def call(name,args):
 if name=='ask_user':
  if args.get('targetId')not in {t['id']for t in spec['targets']}or not args.get('question','').strip():raise ValueError('Specific fixed-target question required')
  entry={'turnId':'ask-'+str(time.time_ns()),'stage':json.loads((a.run/'active-stage.json').read_text())['stage'],**args}
  with (a.run/'questions.jsonl').open('a')as f:f.write(json.dumps(entry)+'\n')
  trace('user.interaction',entry);return {'status':'question_saved','answer':'The user will respond at the fixed next-session boundary. Continue independent work.'}
 if name=='read_user_updates':
  f=a.run/'released-responses.json';return json.loads(f.read_text())if f.exists()else []
 if name.startswith('browser_'):
  browser.stdin.write(json.dumps({'name':name,'arguments':args})+'\n');browser.stdin.flush();line=browser.stdout.readline()
  if not line:raise RuntimeError('Browser service exited')
  reply=json.loads(line)
  if reply.get('error'):raise RuntimeError(reply['error'])
  return reply['result']
 if name=='capture':
  browser.stdin.write(json.dumps({'name':'capture','arguments':args})+'\n');browser.stdin.flush();reply=json.loads(browser.stdout.readline());
  if reply.get('error'):raise RuntimeError(reply['error'])
  return reply['result']
 raise ValueError('Unsupported local operation')

try:
 for line in sys.stdin:
  mid=None
  try:
   msg=json.loads(line);mid=msg.get('id');method=msg.get('method')
   if mid is None:continue
   trace('mcp.request',msg)
   if method=='initialize':result={'protocolVersion':msg.get('params',{}).get('protocolVersion','2024-11-05'),'capabilities':{'tools':{}},'serverInfo':{'name':'workspace','version':'JOB02-host-v1'}}
   elif method=='ping':result={}
   elif method=='tools/list':result={'tools':schemas(mid)}
   elif method=='tools/call':
    q=msg.get('params',{});name=q.get('name');args=q.get('arguments',{});actual=args.get('name')if name=='call_discovered_tool'else name
    if name in {t['name']for t in tools}or name=='capture'and msg.get('_hostOnly')==account.get('hostKey'):result={'content':[{'type':'text','text':json.dumps(call(name,args))}]}
    elif a.condition=='lookout'and actual in allowed:
     reply=clean(upstream(msg));trace('mcp.response',reply);print(json.dumps(reply),flush=True);continue
    else:raise PermissionError('Outside JOB02 permissions')
   else:raise ValueError('Method unavailable')
   reply={'jsonrpc':'2.0','id':mid,'result':result}
  except Exception as e:
   trace('mcp.error',{'errorType':type(e).__name__,'detail':str(e)[:300]});reply={'jsonrpc':'2.0','id':mid,'error':{'code':-32603,'message':str(e)[:300]}}
  trace('mcp.response',reply);print(json.dumps(reply),flush=True)
finally:
 browser.stdin.close()
 try:browser.wait(timeout=10)
 except subprocess.TimeoutExpired:browser.kill();browser.wait()
