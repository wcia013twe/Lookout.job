"""Private, post-participant evidence captured while the account lock is still held.

Scoped MCP lookups are independent evidence, never sent back to the participant.
Historical grading reads this sealed receipt, never the currently reused account.
"""
import hashlib,json,time,math,urllib.request,urllib.error
from pathlib import Path

def sha(path):return hashlib.sha256(Path(path).read_bytes()).hexdigest()
def owner(snapshot):
 rows=snapshot.get('tables',{}).get('profiles',[])
 if len(rows)!=1 or not rows[0].get('user_id',rows[0].get('id')):raise ValueError('Missing unique snapshot owner')
 return rows[0].get('user_id',rows[0].get('id'))
def files(root):
 result={}
 for p in sorted(root.rglob('*')):
  if p.is_symlink():raise ValueError('Symlink terminal artifact')
  if p.is_file():result[str(p.relative_to(root))]=sha(p)
 return result

def call(account,name):
 if name not in ['check_context_versions','read_personal_context','list_contacts']:raise ValueError('Read-only tool required')
 request={'jsonrpc':'2.0','id':1,'method':'tools/call','params':{'name':name,'arguments':{}}}
 req=urllib.request.Request(account['mcpUrl'],data=json.dumps(request).encode(),headers={'Content-Type':'application/json','Accept':'application/json, text/event-stream','Authorization':'Bearer '+account['token']})
 with urllib.request.urlopen(req,timeout=60) as response:body=response.read().decode()
 if body.lstrip().startswith('data:'):body=next(x[6:] for x in body.splitlines() if x.startswith('data: ') and x[6:].startswith('{'))
 reply=json.loads(body)
 if reply.get('error') or reply.get('result',{}).get('isError'):raise RuntimeError('Scoped terminal lookup failed: '+name)
 result=reply['result'];value=result.get('structuredContent')
 if value is None:
  for block in result.get('content',[]):
   if block.get('type')=='text':
    try:value=json.loads(block['text']);break
    except ValueError:pass
 if value is None:raise ValueError('Missing scoped lookup body')
 return value.get('data',value) if isinstance(value,dict) else value

def capture_terminal_state(run,root,meta,lookup=call):
 if meta['status'] not in ['completed','execution_failed','timed_out','setup_failed','artifact_failed']:raise ValueError('Participant must be terminal')
 final=run/'final-state.json';initial=run/'initial-state.json'
 who=owner(json.loads(initial.read_text()))
 if owner(json.loads(final.read_text()))!=who:raise ValueError('Final snapshot owner mismatch')
 start=time.time();reads={};lookup_error=None
 if meta['condition']=='lookout':
  account=json.loads((root/'account.private.json').read_text())
  if account.get('status')!='verified' or account.get('mcpUrl')!='http://127.0.0.1:8080/mcp':raise ValueError('Verified local account required')
  try:
   before=lookup(account,'check_context_versions')
   reads['personal_context']=lookup(account,'read_personal_context');reads['contacts']=lookup(account,'list_contacts')
   after=lookup(account,'check_context_versions')
  except (RuntimeError,urllib.error.URLError,TimeoutError) as e:
   reads={};lookup_error=type(e).__name__+': optional scoped lookup unavailable; bound snapshot retained'
  else:
   if before!=after:raise ValueError('Native context changed during terminal lookup')
   if not isinstance(reads['contacts'],list) or any(x.get('user_id')!=who for x in reads['contacts']):raise ValueError('Scoped lookup owner mismatch')
   expected={x['id']:x for x in json.loads(final.read_text())['tables']['outreach_contacts'] if not x.get('deleted_at')}
   actual={x['id']:x for x in reads['contacts']}
   if set(actual)!=set(expected) or any(actual[k].get('record')!=expected[k].get('record') or actual[k].get('revision')!=expected[k].get('revision') for k in expected):raise ValueError('Scoped contacts differ from terminal snapshot')
   reads['context_versions']=after
 receipt={'version':'COM1-terminal-state-v1','episodeId':meta['episodeId'],'scenarioVersion':meta['version'],'scenarioDigest':meta['scenarioDigest'],'condition':meta['condition'],'ownerId':who,'participantEndedAt':meta['participantEndedAt'],'captureStartedAt':start,'captureEndedAt':time.time(),'source':'post_terminal_scoped_reads_and_snapshot' if reads else ('post_terminal_snapshot' if meta['condition']=='lookout' else 'post_terminal_files_and_snapshot'),'accountLockHeld':True,'initialSnapshotSha256':sha(initial),'finalSnapshotSha256':sha(final),'outputHashes':files(run/'output'),'reads':reads,'optionalLookupError':lookup_error,'tools':['check_context_versions','read_personal_context','list_contacts'] if meta['condition']=='lookout' else []}
 p=run/'terminal-state.json'
 if p.exists():raise ValueError('Terminal receipt already exists')
 p.write_text(json.dumps(receipt,indent=2)+'\n');p.chmod(0o600)
 return receipt

def validate_terminal_state(run,meta):
 p=run/'terminal-state.json'
 if not p.is_file() or p.is_symlink():raise ValueError('Missing terminal saved-state receipt')
 x=json.loads(p.read_text())
 if x.get('version')!='COM1-terminal-state-v1' or any(x.get(k)!=meta.get(k) for k in ['episodeId','scenarioDigest','condition','participantEndedAt']) or x.get('scenarioVersion')!=meta.get('version'):raise ValueError('Terminal receipt run/version mismatch')
 if any(not isinstance(x.get(k),(int,float)) or not math.isfinite(x[k]) for k in ['participantEndedAt','captureStartedAt','captureEndedAt']) or not x['participantEndedAt']<=x['captureStartedAt']<=x['captureEndedAt']:raise ValueError('Terminal receipt time mismatch')
 if x.get('accountLockHeld') is not True:raise ValueError('Terminal receipt not captured before account release')
 for name,key in [('initial-state.json','initialSnapshotSha256'),('final-state.json','finalSnapshotSha256')]:
  if sha(run/name)!=x.get(key) or owner(json.loads((run/name).read_text()))!=x.get('ownerId'):raise ValueError('Terminal snapshot hash/owner mismatch')
 if files(run/'output')!=x.get('outputHashes'):raise ValueError('Terminal saved files changed')
 if meta['condition']=='lookout':
  if x.get('source')=='post_terminal_snapshot':
   if not x.get('optionalLookupError') or x.get('reads'):raise ValueError('Unexplained missing scoped terminal reads')
  elif x.get('source')!='post_terminal_scoped_reads_and_snapshot' or set(x.get('reads',{}))!={'personal_context','contacts','context_versions'}:raise ValueError('Missing scoped terminal reads')
 return x
