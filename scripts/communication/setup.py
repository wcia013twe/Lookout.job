"""One no-inference setup path for COM01–04. Existing destinations are never overwritten."""
import argparse,hashlib,json,subprocess,sys
from pathlib import Path
REPO=Path(__file__).resolve().parents[2]
CASES={'COM1':'n01','COM2':'com2','COM3':'com3','COM4':'com4'}

def normalize(value):
 value=value.upper().replace('COM0','COM')
 if value not in CASES:raise argparse.ArgumentTypeError('Choose COM01, COM02, COM03 or COM04')
 return value

def validate_setup(root,case):
 root=Path(root);read=lambda n:json.loads((root/n).read_text())
 a=read('account.private.json');g=read('grader.private.json');spec=read('suite/scenario.json');config=read('runtime-config.json')
 if config.get('taskId')!=case or spec.get('taskId')!=case:raise ValueError('Case identity mismatch')
 if a.get('status')!='verified' or a.get('apiUrl')!='http://127.0.0.1:54321' or a.get('mcpUrl')!='http://127.0.0.1:8080/mcp' or not a.get('email','').endswith('@example.test'):raise ValueError('Verified local fictional account required')
 if g.get('userId')!=a.get('userId') or g.get('scopes')!=['workspace:read'] or {g[k] for k in ['benchmarkTaskId','taskId'] if k in g}!={case} or g.get('mcpUrl')!=a['mcpUrl']:raise ValueError('Dedicated read-only grader mismatch')
 if (spec.get('model'),spec.get('reasoning'))!=('gpt-5.6-terra','medium'):raise ValueError('Participant model/reasoning mismatch')
 policy=spec['policy']
 for name,value in {'baselineNotesAllowed':True,'profileFileMounted':False,'automaticOnboardingReplay':False,'resumePersistent':True,'noStandingGoalPrompt':True,'noExternalActions':True}.items():
  if policy.get(name) is not value:raise ValueError('Shared isolation policy mismatch: '+name)
 core={'check_context_versions','read_personal_context','read_developer_context','read_guide','list_contacts','save_contact'}
 if not core<=set(config['allowedTools']):raise ValueError('Shared Lookout tool capability missing')
 if not config.get('requiredGuidance'):raise ValueError('Missing runtime version gate')
 sys.path.append(str(REPO/'scripts/n01'));from cost import validate_policy
 validate_policy(read('cost-policy.json'))
 if not (root/'account.lock').is_symlink():raise ValueError('Shared owner lock required')
 return {'case':case,'scenarioVersion':spec['version'],'model':spec['model'],'reasoning':spec['reasoning'],'turns':len(spec['stages']),'sessions':len({s['session'] for s in spec['stages']}),'nativeTools':sorted(config['allowedTools']),'localTools':['read_calendar','read_inbox','ask_user']+(['search_sources','read_source'] if case=='COM3' else []),'requiredGuidance':config['requiredGuidance'],'costPolicySha256':hashlib.sha256((root/'cost-policy.json').read_bytes()).hexdigest(),'readOnlyGrader':True,'inferenceExecuted':False}

def verify_grader(root):
 import urllib.request
 root=Path(root);g=json.loads((root/'grader.private.json').read_text());a=json.loads((root/'account.private.json').read_text())
 token=g.get('token',g.get('readToken'))
 if not token:raise ValueError('Missing read-only grader credential')
 req=urllib.request.Request(g['mcpUrl'],data=json.dumps({'jsonrpc':'2.0','id':1,'method':'tools/call','params':{'name':'read_personal_context','arguments':{}}}).encode(),headers={'Content-Type':'application/json','Accept':'application/json, text/event-stream','Authorization':'Bearer '+token})
 with urllib.request.urlopen(req,timeout=30) as response:body=response.read().decode()
 if body.lstrip().startswith('data:'):body=next(x[6:] for x in body.splitlines() if x.startswith('data: ') and x[6:].startswith('{'))
 reply=json.loads(body)
 if reply.get('error') or reply.get('result',{}).get('isError'):raise RuntimeError('Read-only grader lookup failed')
 value=reply['result'].get('structuredContent')
 if value is None:value=json.loads(next(b['text'] for b in reply['result']['content'] if b.get('type')=='text'))
 value=value.get('data',value)
 if value.get('settings',{}).get('profile',{}).get('user_id')!=a['userId']:raise ValueError('Read-only grader owner mismatch')
 return True

def main():
 p=argparse.ArgumentParser(description=__doc__);p.add_argument('--case',type=normalize,required=True);p.add_argument('--source',type=Path,required=True);p.add_argument('--background',type=Path,required=True);p.add_argument('--destination',type=Path,required=True);p.add_argument('--preflight-output',type=Path,required=True);p.add_argument('--cost-policy',type=Path);a=p.parse_args()
 if a.destination.exists() or a.preflight_output.exists():p.error('Use new setup and preflight destinations; retain earlier attempts')
 folder=REPO/'scripts'/CASES[a.case]
 command=[sys.executable,str(folder/'prepare.py'),'--source',str(a.source.resolve()),'--background',str(a.background.resolve()),'--destination',str(a.destination.resolve())]
 if a.cost_policy:command+=['--cost-policy',str(a.cost_policy.resolve())]
 subprocess.run(command,check=True)
 receipt=validate_setup(a.destination,a.case)
 receipt['graderReadVerified']=verify_grader(a.destination)
 subprocess.run([sys.executable,str(folder/'preflight.py'),'--task-dir',str(a.destination.resolve()),'--output',str(a.preflight_output.resolve())],check=True)
 receipt.update(setupVersion='communication-setup-v1',taskDir=str(a.destination.resolve()),preflight='passed',commands={'run':str(folder/'orchestrate.py'),'grade':str(folder/'grade.py'),'summary':str(folder/'summary.py'),'export':str(folder/'langfuse.mjs')})
 dest=a.preflight_output/'setup-receipt.json';dest.write_text(json.dumps(receipt,indent=2)+'\n');dest.chmod(0o600)
 print(json.dumps({'case':a.case,'ready':True,'inferenceExecuted':False,'receipt':str(dest)}))
if __name__=='__main__':main()
