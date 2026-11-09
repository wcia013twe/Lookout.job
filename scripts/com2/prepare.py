"""Freeze COM2 private inputs without inference, account reset or domain writes."""
import argparse,hashlib,json,os,shutil,subprocess
from pathlib import Path
import sys
sys.path.append(str(Path(__file__).resolve().parents[1]/"n01"))
from cost import validate_policy

def prepare(source,background,destination,cost_policy=None):
 source,background,destination=[Path(p).resolve() for p in [source,background,destination]]
 if destination.exists():raise ValueError('Use a new destination; preserve prior versions')
 account=json.loads((source/'account.private.json').read_text())
 if account.get('status')!='verified' or account.get('apiUrl')!='http://127.0.0.1:54321' or account.get('mcpUrl')!='http://127.0.0.1:8080/mcp' or account.get('benchmarkTaskId')!='COM2' or not account.get('email','').endswith('@example.test'):raise ValueError('Verified dedicated local COM2 account receipt required; never relabel an account running another case')
 clone=json.loads((source/'cloned-context.private.json').read_text())
 for name in ['profile.md','resume.pdf']:
  if not (background/name).is_file():raise ValueError('Complete background and resume required')
 repo=Path(__file__).resolve().parents[2];spec=json.loads((repo/'examples/com2/scenario.json').read_text());fixture=json.loads((repo/'examples/com2/fixture.json').read_text())
 # A source must provide the exact equivalent native profile facts, not a handwritten summary.
 initial_source=json.loads((source/'suite/initial-state.json').read_text())
 profile=initial_source['profileFacts']
 if profile!=clone['settings']['profile']['facts']:raise ValueError('Native initial profile differs from cloned manifest')
 destination.mkdir(mode=0o700,parents=True)
 for name in ['suite','background','runs']:(destination/name).mkdir()
 for name in ['account.private.json','grader.private.json','cloned-context.private.json','source-manifest.private.json']:shutil.copyfile(source/name,destination/name)
 (destination/'account.lock').symlink_to(source/'account.lock')
 apps=[fixture['application'],fixture['sentinelApplication']]
 for app in apps:app['jobId']+='-'+account['userId']
 initial=dict(profileFacts=profile,contacts=fixture['contacts'],applications=apps)
 (destination/'suite/initial-state.json').write_text(json.dumps(initial,indent=2)+'\n')
 (destination/'suite/scenario.json').write_text(json.dumps(spec,indent=2)+'\n')
 (destination/'suite/contract.md').write_text('Private recruiting workspace. Resume and currently released inbox/calendar evidence are in /inputs. Save work in /workspace/output or available connected records. Do not send messages, submit forms, or create interview preparation materials.\n')
 app_text='\n'.join(f"I reported applying to {a['company']} for {a['title']} ({a['role']}) on {a['submittedAt']}. The current tracker status is {a['status']}; no employer receipt is available. The application record is {a['id']}, and its posting is {a['url']}." for a in apps)
 contact_text='\n'.join(f"{c['record']['contact']}: {c['record']['relationship']} Current contact status: {c['record']['status']}."+(f" Email: {c['record']['email']}." if c['record'].get('email') else '')+(f" Existing draft: {c['record']['draft']}" if c['record'].get('draft') else '') for c in fixture['contacts'])
 onboarding=(background/'profile.md').read_text()+'\n\n'+fixture['onboarding']+'\n\n'+app_text+'\n\n'+contact_text
 # Preserve every source fact, including values absent from an older readable profile export.
 import parity
 onboarding,receipt=parity.complete_and_verify(source,background,onboarding,initial)
 (destination/'context-parity.json').write_text(json.dumps(receipt,indent=2)+'\n')
 (destination/'background/onboarding.md').write_text(onboarding)
 shutil.copyfile(background/'resume.pdf',destination/'background/resume.pdf')
 for name in ['reset.mjs','snapshot.mjs']:shutil.copyfile(repo/'scripts/com2'/name,destination/name)
 config=dict(version=spec['version'],taskId='COM2',suiteByTask=False,resetArgs=[],publicFiles=[],productConfiguration=spec['policy']['productConfiguration'],databaseContainer='supabase_db_lookout-local',allowedTools=['check_context_versions','read_personal_context','read_developer_context','read_guide','discover_toolkit','discover_tools','call_discovered_tool','read_application_record','record_application_milestone','list_contacts','save_contact','list_artifacts','read_artifact','save_artifact'])
 config['requiredGuidance']={'developerVersion':json.loads((repo/'supabase/functions/agent-gateway/instructions.json').read_text())['developerVersion'],'outreachGuideVersion':json.loads((repo/'supabase/functions/agent-gateway/skills/cold-outreach.json').read_text())['version']}
 (destination/'runtime-config.json').write_text(json.dumps(config,indent=2)+'\n')
 pricing=Path(cost_policy) if cost_policy else repo/'examples/evals/cost-policy.json'
 validate_policy(json.loads(pricing.read_text()))
 shutil.copyfile(pricing,destination/'cost-policy.json')
 files=[p for p in destination.rglob('*') if p.is_file() and not p.is_symlink()]
 files+=list((repo/'scripts/com2').glob('*.py'))+list((repo/'scripts/com2').glob('*.mjs'))
 files += [repo/'scripts/n01/cost.py',repo/'scripts/n01/cost-export.mjs']
 files+=list((repo/'scripts/communication').glob('*.py'))
 files += [repo/'supabase/functions/agent-gateway/instructions.json', repo/'supabase/functions/agent-gateway/skills/cold-outreach.json', repo/'supabase/migrations/20261103224016_network_person_cards.sql']
 files+=list((repo/'scripts/evals').glob('*.mjs'))+[repo/'backend/runtime/trace-policy.mjs']
 sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
 image=subprocess.run(['docker','image','inspect','lookout-benchmark:0.164.0','--format','{{.Id}}'],check=True,capture_output=True,text=True,timeout=30).stdout.strip()
 lock=dict(version=spec['version'],files={os.path.relpath(p,destination):sha(p) for p in files},background={n:sha(destination/'background'/n) for n in ['onboarding.md','resume.pdf']},imageId=image)
 (destination/'freeze.json').write_text(json.dumps(lock,indent=2)+'\n')
 for p in destination.rglob('*'):
  if p.is_file() and not p.is_symlink():p.chmod(0o600)
 return destination
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('--source',required=True);p.add_argument('--background',required=True);p.add_argument('--destination',required=True);p.add_argument('--cost-policy');a=p.parse_args();print(prepare(a.source,a.background,a.destination,a.cost_policy))
