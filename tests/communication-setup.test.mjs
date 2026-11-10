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
  malformed={**spec,'qualityGroups':{'broken':[]}};(p/'suite/scenario.json').write_text(json.dumps(malformed))
  try:setup.validate_setup(p,case)
  except ValueError:pass
  else:raise AssertionError('Invalid outcome partition accepted before inference')
  (p/'suite/scenario.json').write_text(json.dumps(spec))
  grader['taskId']=grader.pop('benchmarkTaskId');(p/'grader.private.json').write_text(json.dumps(grader));assert setup.validate_setup(p,case)['readOnlyGrader'] is True
  grader['scopes'].append('network:write');(p/'grader.private.json').write_text(json.dumps(grader))
  try:setup.validate_setup(p,case)
  except ValueError:pass
  else:raise AssertionError('Writable grader accepted')
`;
const r=spawnSync('python3',['-c',code],{encoding:'utf8'});assert.equal(r.status,0,r.stderr);
});


test('revised COM01 and COM02 runners accept current setups and reject stale versions',()=>{
 const code=`import sys,json,tempfile
from pathlib import Path
folder,task=sys.argv[1:]
sys.path.insert(0,str(Path('scripts')/folder));import runner
spec=json.loads((Path('examples')/folder/'scenario.json').read_text())
with tempfile.TemporaryDirectory() as directory:
 root=Path(directory);(root/'suite').mkdir();(root/'suite/initial-state.json').write_text('{}')
 config={'taskId':task,'version':spec['version'],'suiteByTask':False}
 (root/'account.private.json').write_text(json.dumps({'benchmarkTaskId':task}))
 (root/'runtime-config.json').write_text(json.dumps(config))
 runner.configure(root)
 assert runner.CONFIG['version']==spec['version']
 config['version']='obsolete';(root/'runtime-config.json').write_text(json.dumps(config))
 try:runner.configure(root)
 except RuntimeError as error:assert str(error)=='Wrong runtime configuration'
 else:raise AssertionError('Stale runtime version accepted')
`;
 for(const [folder,task] of [['n01','COM1'],['com2','COM2']]){
  const result=spawnSync('python3',['-B','-c',code,folder,task],{encoding:'utf8'});
  assert.equal(result.status,0,result.stderr);
 }
});
