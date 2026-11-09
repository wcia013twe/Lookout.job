"""Scoped native startup/defaults and on-demand discovery, with shared JOB services."""
import argparse,json,re,sys,time,urllib.request
from pathlib import Path
from services import Services

def clean(value,allowed):
 # Native authentication/discovery already owns scope filtering. Preserve its
 # exact strings and structures, including JSON text and Unicode, for the model.
 return value

def actor(question,released):
 if re.search(r'send|submit|approve|contact',question,re.I):return 'Read, prepare, track and save only. No external sends, application submission or approval.', 'approval'
 if 'multi_update' in released and re.search(r'birch|start',question,re.I):return 'For Birch Database, January 19, 2027. It remains unsubmitted.', 'clarification'
 if 'screen_debrief' in released and re.search(r'gap|migration|feedback',question,re.I):return 'I struggled to explain my database migration tradeoffs. No further detail is available.', 'clarification'
 return 'No additional information is available. Preserve the uncertainty.', 'clarification'

def tools(case):
 def tool(name,description,props={},required=[]):return {'name':name,'description':description,'inputSchema':{'type':'object','properties':props,'required':required,'additionalProperties':False}}
 text={'type':'string'}
 result=[tool('read_inbox','Read currently released evidence and retained earlier messages.'),tool('ask_user','Ask the user for needed information.',{'question':text},['question'])]
 if case=='JOB03':result += [tool('schedule_reminder','Schedule a follow-up in the shared local test-clock service; no external send.',{k:text for k in ['key','applicationId','dueAt','timeZone']},['key','applicationId','dueAt','timeZone']),tool('read_reminders','Read saved reminder state.'),tool('cancel_reminder','Cancel a saved reminder.',{'reminderId':text},['reminderId']),tool('preview_saved_application','Continue the existing fictional saved preview. Never submits or accesses an employer. Previously saved fields persist on failure.',{'applicationId':text,'answers':{'type':'object','additionalProperties':text}},['applicationId'])]
 return result

def main():
 p=argparse.ArgumentParser();p.add_argument('--root',type=Path,required=True);p.add_argument('--capture',type=Path,required=True);p.add_argument('--condition',choices=['baseline','lookout'],required=True);p.add_argument('--inputs',type=Path,required=True);a=p.parse_args()
 account=json.loads((a.root/'account.private.json').read_text());config=json.loads((a.root/'host-config.json').read_text());allowed=set(config['allowedTools']);local=tools(config['caseId']);seq=0
 endpoint='http://127.0.0.1:8080/mcp'
 if account.get('backendRoot'):
  from isolated_backend import inspect
  _,backend=inspect(account['backendRoot']);endpoint=backend['mcpUrl']
 if account['benchmarkTaskId']!=config['caseId'] or account['status']!='verified' or account['mcpUrl']!=endpoint:raise ValueError('Dedicated local owner mismatch')
 run=a.capture.parent.parent
 def record(kind,data):
  nonlocal seq
  seq+=1;pointer=run/'active-stage.json';target=run/f"stage-{json.loads(pointer.read_text())['stage']}"/'lookout-trace.jsonl' if pointer.exists() else a.capture
  text=json.dumps({'type':kind,'data':data,'sequence':seq,'timestamp':time.time()})
  for key in [account['token']]:text=text.replace(key,'[REDACTED]')
  with target.open('a') as f:f.write(text+'\n')
 def upstream(msg):
  req=urllib.request.Request(account['mcpUrl'],data=json.dumps(msg).encode(),headers={'Authorization':'Bearer '+account['token'],'Content-Type':'application/json','Accept':'application/json, text/event-stream'})
  with urllib.request.urlopen(req,timeout=90) as response:text=response.read().decode()
  if text.lstrip().startswith('data:'):text=next(x[6:] for x in text.splitlines() if x.startswith('data: {'))
  return clean(json.loads(text),allowed)
 for line in sys.stdin:
  mid=None
  try:
   msg=json.loads(line);mid=msg.get('id');method=msg.get('method')
   if mid is None:continue
   record('mcp.request',msg);started=time.monotonic();name=None
   if method=='initialize':
    reply=upstream(msg) if a.condition=='lookout' else {'jsonrpc':'2.0','id':mid,'result':{'protocolVersion':msg.get('params',{}).get('protocolVersion','2024-11-05'),'capabilities':{'tools':{}},'serverInfo':{'name':'workspace','version':'1'}}}
   elif method=='tools/list':
    reply=upstream(msg) if a.condition=='lookout' else {'jsonrpc':'2.0','id':mid,'result':{'tools':[]}}
    if not reply.get('error'):reply['result']['tools']+=local
   elif method=='ping':reply={'jsonrpc':'2.0','id':mid,'result':{}}
   elif method=='tools/call':
    params=msg.get('params',{});name=params.get('name');args=params.get('arguments',{});actual=args.get('name') if name=='call_discovered_tool' else name
    if name in {x['name'] for x in local}:
     sources=json.loads((a.inputs/'sources.json').read_text())
     if name=='read_inbox':result=sources
     elif name=='ask_user':
      answer,category=actor(args['question'],sources['releasedStageIds']);result={'answer':answer};record('user.interaction',{'id':'ask-'+str(time.time_ns()),'question':args['question'],'answer':answer,'answered':True,'categories':[category]})
     else:
      service=Services(run/'services.sqlite')
      if name=='schedule_reminder':result=service.schedule(**args)
      elif name=='read_reminders':result=service.read()
      elif name=='cancel_reminder':result=service.cancel(**args)
      else:result=service.preview(**args)
     reply={'jsonrpc':'2.0','id':mid,'result':{'content':[{'type':'text','text':json.dumps(result)}]}}
    elif a.condition=='lookout':reply=upstream(msg)
    else:reply={'jsonrpc':'2.0','id':mid,'result':{'isError':True,'content':[{'type':'text','text':'Operation outside connection permissions.'}]}}
   else:reply={'jsonrpc':'2.0','id':mid,'error':{'code':-32601,'message':'Method unavailable'}}
   record('mcp.measurement',{'method':method,'tool':actual if method=='tools/call' else None,'durationSeconds':time.monotonic()-started,'responseBytes':len(json.dumps(reply).encode())});record('mcp.response',reply);print(json.dumps(reply),flush=True)
  except Exception as e:
   record('mcp.error',{'errorType':type(e).__name__});print(json.dumps({'jsonrpc':'2.0','id':mid,'error':{'code':-32603,'message':'Workspace service failed: '+type(e).__name__}}),flush=True)
if __name__=='__main__':main()
