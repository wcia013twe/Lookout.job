"""Create a new private COM1 workspace. Never changes a historical suite or account."""
import argparse,hashlib,json,shutil,subprocess
from pathlib import Path
from cost import validate_policy

def prepare(source,background,destination,cost_policy=None):
 source,background,destination=map(lambda p:Path(p).resolve(),[source,background,destination])
 if destination.exists():raise ValueError('Destination already exists; use a new version')
 if not (source/'account.private.json').is_file():raise ValueError('Verified isolated account receipt required')
 account=json.loads((source/'account.private.json').read_text())
 if account.get('status')!='verified' or account.get('apiUrl')!='http://127.0.0.1:54321' or not account.get('email','').endswith('@example.test'):raise ValueError('Only verified local demo accounts supported')
 destination.mkdir(mode=0o700,parents=True)
 (destination/'suite').mkdir();(destination/'background').mkdir();(destination/'runs').mkdir()
 repo=Path(__file__).resolve().parents[2]
 spec=json.loads((repo/'examples/n01/scenario.json').read_text())
 for name in ['account.private.json','grader.private.json','cloned-context.private.json','snapshot.mjs','reset.mjs']:
  shutil.copyfile(source/name,destination/name)
 # A shared lock prevents old and new harnesses from writing the same demo account concurrently.
 (destination/'account.lock').symlink_to(source/'account.lock')
 initial=json.loads((source/'suite/initial-state.json').read_text())
 for c in initial['contacts']:
  if c['id']=='dana':c['record'].update(company='Aster Compute',title='Inference Engineer')
  if c['id']=='ivo':c['record'].update(company='Harbor Tools',title='Developer Platform Engineer')
 (destination/'suite/initial-state.json').write_text(json.dumps(initial,indent=2)+'\n')
 (destination/'suite/scenario.json').write_text(json.dumps(spec,indent=2)+'\n')
 (destination/'suite/contract.md').write_text('Private recruiting workspace. Resume and currently available calendar/inbox evidence are in /inputs. Use the persistent storage described in your session instructions. Use only available evidence. Do not send messages or submit applications.\n')
 profile=(background/'profile.md').read_text()
 context=json.loads((source/'cloned-context.private.json').read_text())['settings']
 def readable(value):
  if isinstance(value,dict):return '\n'.join(str(k)+': '+readable(v) for k,v in value.items())
  if isinstance(value,list):return '\n'.join('- '+readable(v) for v in value)
  return str(value)
 profile+='\n\nHere are all my saved profile details:\n'+readable(initial['profileFacts'])+'\n\nHere are all my saved preferences:\n'+readable(context.get('preferences',{}))+'\n\nHere are my saved answers:\n'+readable(context.get('answers',[]))
 contacts='\n\n## My networking contacts\n'
 for c in initial['contacts']:
  contacts+='\n'+c['record']['contact']+'\n'+''.join(f"{k}: {v}\n" for k,v in c['record'].items() if k!='contact')
 goals='\n\n## My current networking preferences\n'+initial['profileFacts']['introduction'].split('## Networking goals')[-1]
 (destination/'background/onboarding.md').write_text(profile+contacts+goals+'\nI have introductory conversations with Dana and Ivo coming up. Do not send messages or submit anything without my approval.\n')
 shutil.copyfile(background/'resume.pdf',destination/'background/resume.pdf')
 config=json.loads((source/'runtime-config.json').read_text());config['version']=spec['version'];config['taskId']=spec['taskId'];config['productConfiguration']=spec['policy']['productConfiguration']
 config['requiredGuidance']={'developerVersion':json.loads((repo/'supabase/functions/agent-gateway/instructions.json').read_text())['developerVersion'],'outreachGuideVersion':json.loads((repo/'supabase/functions/agent-gateway/skills/cold-outreach.json').read_text())['version']}
 (destination/'runtime-config.json').write_text(json.dumps(config,indent=2)+'\n')
 pricing=Path(cost_policy) if cost_policy else repo/'examples/evals/cost-policy.json'
 validate_policy(json.loads(pricing.read_text()))
 shutil.copyfile(pricing,destination/'cost-policy.json')
 # Freeze the actual executable and inputs, not a parallel copy of their schemas.
 files=[p for p in destination.rglob('*') if p.is_file() and not p.is_symlink()]
 files+=list((repo/'scripts/n01').glob('*.py'))+list((repo/'scripts/n01').glob('*.mjs'))
 import os
 files+=list((repo/'scripts/communication').glob('*.py'))
 files += [repo/'scripts/evals/workspace_transport.py']
 files += [repo/'supabase/functions/agent-gateway/instructions.json', repo/'supabase/functions/agent-gateway/skills/cold-outreach.json', repo/'supabase/migrations/20261103224016_network_person_cards.sql']
 sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
 image=subprocess.run(['docker','image','inspect','lookout-benchmark:0.164.0','--format','{{.Id}}'],check=True,capture_output=True,text=True,timeout=30).stdout.strip()
 lock={'version':spec['version'],'files':{os.path.relpath(p,destination):sha(p) for p in files},'background':{n:sha(destination/'background'/n) for n in ['onboarding.md','resume.pdf']},'imageId':image}
 (destination/'freeze.json').write_text(json.dumps(lock,indent=2)+'\n')
 for p in destination.rglob('*'):
  if p.is_file() and not p.is_symlink():p.chmod(0o600)
 return destination
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('--source',required=True);p.add_argument('--background',required=True);p.add_argument('--destination',required=True);p.add_argument('--cost-policy');a=p.parse_args()
 print(prepare(a.source,a.background,a.destination,a.cost_policy))
