"""Read-only post-termination verification; no writer credential or write operation accepted."""
import hashlib,json,shutil,time,urllib.request
from pathlib import Path
READS={'read_personal_context','read_application_record','list_contacts','list_artifacts','read_artifact'}
TERMINAL={'completed','execution_failed','timed_out','setup_failed','artifact_failed'}
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
def files(root):
 result={}
 for p in sorted(root.rglob('*')):
  if p.is_symlink():raise ValueError('Symlink in final files')
  if p.is_file():result[str(p.relative_to(root))]=sha(p)
 return result

def lookup(config,name,args):
 if name not in READS or config.get('scopes')!=['workspace:read'] or 'token' in config:raise ValueError('Read-only grader capability required')
 request=urllib.request.Request(config['mcpUrl'],data=json.dumps({'jsonrpc':'2.0','id':1,'method':'tools/call','params':{'name':name,'arguments':args}}).encode(),headers={'Content-Type':'application/json','Accept':'application/json, text/event-stream','Authorization':'Bearer '+config['readToken']})
 with urllib.request.urlopen(request,timeout=90) as response:body=response.read().decode()
 if body.lstrip().startswith('data:'):body=next(x[6:] for x in body.splitlines() if x.startswith('data: ') and x[6:].startswith('{'))
 reply=json.loads(body)
 if reply.get('error') or reply.get('result',{}).get('isError'):raise RuntimeError('Read-only lookup unavailable')
 result=reply['result'];data=result.get('structuredContent')
 if data is None:data=next(json.loads(x['text']) for x in result.get('content',[]) if x.get('type')=='text')
 return data.get('data',data) if isinstance(data,dict) else data

def capture(run,root):
 run,root=Path(run),Path(root);m=json.loads((run/'run.json').read_text());config=json.loads((root/'grader.private.json').read_text())
 if m['status'] not in TERMINAL or not m.get('participantEndedAt'):raise ValueError('Participant must be terminal before capture')
 if config['userId']!=m['ownerId'] or config.get('taskId')!='COM2' or config.get('apiUrl')!='http://127.0.0.1:54321' or config.get('mcpUrl')!='http://127.0.0.1:8080/mcp':raise ValueError('Terminal owner mismatch')
 target=run/'terminal-capture.json'
 if target.exists() or (run/'final-files').exists():raise ValueError('Preserve earlier terminal capture')
 started=time.time();shutil.copytree(run/'output',run/'final-files')
 receipt=dict(version=1,episodeId=m['episodeId'],ownerId=m['ownerId'],condition=m['condition'],participantEndedAt=m['participantEndedAt'],startedAt=started,files=files(run/'final-files'),nativeLookups=[],limitations=[])
 if m['condition']=='lookout':
  snapshot=json.loads((run/'final-state.json').read_text())
  if snapshot.get('userId')!=config['userId'] or not all(isinstance(snapshot.get('tables',{}).get(k),list) for k in ['profiles','applications','application_milestones','outreach_contacts','career_artifacts']):raise ValueError('Incomplete or foreign final native snapshot')
  receipt['nativeSnapshotSha256']=sha(run/'final-state.json')
  requests=[('read_personal_context',{}),('list_contacts',{})]+[('read_application_record',{'applicationId':app['id']}) for app in snapshot['tables']['applications']]+[('read_artifact',{'id':artifact['id']}) for artifact in snapshot['tables']['career_artifacts']]
  for name,args in requests:
   try:
    value=lookup(config,name,args)
    if name=='read_personal_context' and value.get('settings',{}).get('profile',{}).get('user_id')!=config['userId']:raise ValueError('Personal context owner mismatch')
    receipt['nativeLookups'].append(dict(tool=name,arguments=args,capturedAt=time.time(),result=value))
   except ValueError:raise
   except Exception as error:receipt['limitations'].append(dict(tool=name,reason=type(error).__name__,fallback='bound complete native snapshot'))
 receipt['completedAt']=time.time();receipt['verification']='bound_terminal_state';target.write_text(json.dumps(receipt,indent=2)+'\n');target.chmod(0o600)
 validate(run,m);return receipt

def validate(run,m):
 run=Path(run);p=run/'terminal-capture.json'
 if not p.is_file():raise ValueError('Terminal verification unavailable; missing bound capture')
 c=json.loads(p.read_text())
 if c.get('episodeId')!=m['episodeId'] or c.get('ownerId')!=m.get('ownerId') or c.get('condition')!=m['condition']:raise ValueError('Terminal capture identity mismatch')
 if c.get('participantEndedAt')!=m.get('participantEndedAt') or c.get('startedAt',0)<m.get('participantEndedAt',float('inf')) or c.get('completedAt',0)<c.get('startedAt',0):raise ValueError('Terminal capture time mismatch')
 if c.get('files')!=files(run/'final-files') or not (run/'final-files').is_dir():raise ValueError('Terminal file capture changed')
 if m['condition']=='lookout':
  snapshot=json.loads((run/'final-state.json').read_text())
  if c.get('nativeSnapshotSha256')!=sha(run/'final-state.json') or snapshot.get('userId')!=m['ownerId']:raise ValueError('Terminal native capture changed or foreign')
 return c
