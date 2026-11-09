"""Provision a read-only grader for the verified, legacy local COM1 owner."""
import argparse,hashlib,json,secrets,subprocess
from pathlib import Path

def provision(root):
 root=Path(root);a=json.loads((root/'account.private.json').read_text());config=json.loads((root/'runtime-config.json').read_text())
 if a.get('status')!='verified' or a.get('apiUrl')!='http://127.0.0.1:54321' or a.get('mcpUrl')!='http://127.0.0.1:8080/mcp' or not a.get('email','').endswith('@example.test') or config.get('taskId')!='COM1':raise ValueError('Verified local COM1 owner required')
 dest=root/'grader.private.json'
 if dest.exists():raise ValueError('Preserve existing grader connection')
 import uuid
 who=str(uuid.UUID(a['userId']))
 def sql(query):
  r=subprocess.run(['docker','exec','-i','supabase_db_lookout-local','psql','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1','-Atq'],input=query,text=True,capture_output=True,timeout=30)
  if r.returncode:raise RuntimeError('Local grader provisioning failed; diagnostics suppressed')
  return json.loads(r.stdout.strip())
 user=sql("select json_build_object('email',email,'task',raw_app_meta_data->>'benchmarkTaskId') from auth.users where id='"+who+"';")
 if user['email']!=a['email'] or user['task'] not in [None,'COM1']:raise ValueError('Owner assignment mismatch')
 token='jb_agent_'+secrets.token_hex(32);scopes=['workspace:read']
 payload=json.dumps({'name':'COM1 read-only terminal verification','tokenHash':hashlib.sha256(token.encode()).hexdigest(),'expiresInDays':7,'scopes':scopes})
 sql("select public.manage_agent_connection('"+who+"','connections.issue',$payload$"+payload+"$payload$::jsonb);")
 dest.write_text(json.dumps({'benchmarkTaskId':'COM1','userId':who,'mcpUrl':a['mcpUrl'],'status':'verified','scopes':scopes,'token':token},indent=2)+'\n');dest.chmod(0o600)
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('root');a=p.parse_args();provision(a.root);print('Read-only local COM1 grader provisioned.')
