import test from 'node:test';import assert from 'node:assert/strict';import {spawnSync} from 'node:child_process';
test('shared setup enforces case, permissions, model, tools and frozen cost policy',()=>{
const code=`import sys,json,tempfile
from pathlib import Path
sys.path.insert(0,'scripts/communication');import setup
for case,folder in setup.CASES.items():
 with tempfile.TemporaryDirectory() as t:
  p=Path(t);(p/'suite').mkdir();(p/'account.lock').symlink_to(p/'owner.lock')
  spec=json.loads((setup.REPO/'examples'/folder/'scenario.json').read_text())
  a={'status':'verified','apiUrl':'http://127.0.0.1:54321','mcpUrl':'http://127.0.0.1:8080/mcp','email':'fictional@example.test','userId':'fictional'}
  grader={'userId':'fictional','scopes':['workspace:read'],'benchmarkTaskId':case,'mcpUrl':a['mcpUrl']}
  config={'taskId':case,'allowedTools':['check_context_versions','read_personal_context','read_developer_context','read_guide','list_contacts','save_contact'],'requiredGuidance':{'developerVersion':156,'outreachGuideVersion':10}}
  for name,value in [('account.private.json',a),('grader.private.json',grader),('suite/scenario.json',spec),('runtime-config.json',config),('cost-policy.json',{'schemaVersion':1,'currency':'USD','rates':[]})]:(p/name).write_text(json.dumps(value))
  assert setup.normalize(case.replace('COM','COM0'))==case
  assert setup.validate_setup(p,case)['inferenceExecuted'] is False
  grader['scopes'].append('network:write');(p/'grader.private.json').write_text(json.dumps(grader))
  try:setup.validate_setup(p,case)
  except ValueError:pass
  else:raise AssertionError('Writable grader accepted')
`;
const r=spawnSync('python3',['-c',code],{encoding:'utf8'});assert.equal(r.status,0,r.stderr);
});
