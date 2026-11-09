import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {extract} from '../scripts/job01/extract.mjs';
test('host release isolates future evidence and onboarding while matching email evidence and task intent',()=>{
 const result=spawnSync('python3',['-B','-c',String.raw`
import importlib.util,tempfile,json
from pathlib import Path
s=importlib.util.spec_from_file_location('pilot','scripts/job01/pilot.py');p=importlib.util.module_from_spec(s);s.loader.exec_module(p)
a=p.load('actor',Path('scripts/job01/pilot_actor.py'))
with tempfile.TemporaryDirectory() as t:
 root=Path(t);p.PRIVATE=root;(root/'candidate').mkdir();(root/'packets').mkdir();(root/'candidate/profile.md').write_text('PRIVATE_INITIAL_CONTEXT');(root/'candidate/resume.pdf').write_bytes(b'fixture')
 (root/'runtime-config.json').write_text(json.dumps({'productConfiguration':{'wakePrompt':'Scheduled check'}}))
 stage={'id':'initial_search','_index':1,'kind':'external','baseline':'Review uploaded email'}
 payload={'jobs':[{'id':'released'}],'email':{'id':'shared-email','body':'Shared evidence'}}
 for c in ['baseline','lookout']:(root/'packets'/f'initial_search-{c}.json').write_text(json.dumps(payload))
 inputs=root/'inputs';inputs.mkdir();p.release(stage,'baseline',inputs)
 assert (inputs/'email.json').exists() and (inputs/'sources.json').exists()
 assert 'PRIVATE_INITIAL_CONTEXT' in p.prompt(stage,'baseline')
 stage['_index']=4;assert 'PRIVATE_INITIAL_CONTEXT' not in p.prompt(stage,'baseline')
 p.release(stage,'lookout',inputs)
 assert (inputs/'email.json').exists() and json.loads((inputs/'sources.json').read_text())['inbox'][0]==payload['email']
 assert not (inputs/'profile.md').exists()
 assert 'PRIVATE_INITIAL_CONTEXT' not in p.prompt(stage,'lookout')
 assert 'Use Lookout tools' in p.prompt(stage,'lookout')
 assert p.prompt(stage,'baseline').endswith(stage['baseline']) and p.prompt(stage,'lookout').endswith(stage['baseline'])
 assert 'persist across sessions' in p.prompt(stage,'baseline')
 spec={'stages':[{'kind':'external'},{'kind':'user_update','request':'Platform first'},{'kind':'user_update','request':'Concise style'}]}
 assert 'Platform first' not in a.answer('What are my preferences?',1,spec)[0]
 assert 'Concise style' in a.answer('What are my preferences?',3,spec)[0]
 assert 'not confirmed' in a.answer('Am I a citizen?',3,spec)[0]
`],{encoding:'utf8',env:{...process.env,PYTHONDONTWRITEBYTECODE:'1'}});assert.equal(result.status,0,result.stderr);
});
test('extraction binds frozen saved evidence and never treats missing review as zero targets',()=>{
 const root=mkdtempSync(path.join(tmpdir(),'job01-extract-'));
 try{
 const spec={gradingStages:['initial_search'],stages:[{id:'initial_search',minute:0}],policy:{userResponseDelayMinutes:5}};
 const run={checkpoints:[{stage:'initial_search',status:'completed',executionSeconds:60,interactionTurnIds:['ask1'],answeredTurnCount:1,interactions:{uniqueTurns:1,questions:1,repeatedContext:0,reminders:0,corrections:0,approvals:0}}]};
 writeFileSync(path.join(root,'run.json'),JSON.stringify(run));writeFileSync(path.join(root,'saved.json'),'["job-a"]');
 const hash=x=>createHash('sha256').update(x).digest('hex');
 writeFileSync(path.join(root,'evidence-hashes.json'),JSON.stringify({'run.json':hash(JSON.stringify(run)),'saved.json':hash('["job-a"]')}));
 assert.throws(()=>extract(root,{reviewer:'reviewer'},spec),/Cited/);
 const review={reviewer:'reviewer',checkpoints:{initial_search:{savedJobIds:['job-a'],evidence:['saved.json'],outcomeComplete:true,additionalTurns:[{id:'extra1',evidence:['saved.json'],answered:true,categories:['questions','repeatedContext','approvals']}]}}};
 const result=extract(root,review,spec);assert.deepEqual(result.checkpoints[0].savedJobIds,['job-a']);assert.equal(result.checkpoints[0].simulatedCompletionMinute,11);
 assert.equal(result.checkpoints[0].interactions.uniqueTurns,2);assert.equal(result.checkpoints[0].interactions.repeatedContext,1);assert.equal(result.checkpoints[0].interactions.approvals,1);
 const duplicate=structuredClone(review);duplicate.checkpoints.initial_search.additionalTurns.push(duplicate.checkpoints.initial_search.additionalTurns[0]);assert.throws(()=>extract(root,duplicate,spec),/Unique additional/);
 writeFileSync(path.join(root,'saved.json'),'tampered');assert.throws(()=>extract(root,review,spec),/Evidence changed/);
 }finally{rmSync(root,{recursive:true,force:true});}
});
test('post-turn capture failure retains reached stage duration and interaction evidence',()=>{
 const result=spawnSync('python3',['-B','-c',String.raw`
import importlib.util,tempfile,json
from pathlib import Path
s=importlib.util.spec_from_file_location('pilot','scripts/job01/pilot.py');p=importlib.util.module_from_spec(s);s.loader.exec_module(p)
with tempfile.TemporaryDirectory() as t:
 root=Path(t);p.PRIVATE=root
 for n in ['suite','runs','candidate','packets','grading']:(root/n).mkdir()
 (root/'candidate/resume.pdf').write_bytes(b'fictional')
 (root/'freeze.json').write_text('{}')
 (root/'readiness.json').write_text(json.dumps({'readyForPilot':True,'freezeHash':p.digest(root/'freeze.json')}))
 stage={'id':'initial_search','session':1,'kind':'external'}
 (root/'suite/scenario.json').write_text(json.dumps({'version':'unit-test','policy':{'stageBudgetSeconds':30},'stages':[stage]}))
 (root/'source-manifest.json').write_text(json.dumps({'snapshotId':'fixture','files':{'jobs.json':'fixture'}}))
 for c in ['baseline','lookout']:(root/'packets'/f'initial_search-{c}.json').write_text(json.dumps({'jobs':[],'email':None}))
 p.verify=lambda:None;p.infrastructure=lambda:None;p.close_infrastructure=lambda:None;p.ORIGINAL_COMMAND=lambda *a,**k:None;p.subprocess.run=lambda *a,**k:None
 p.runtime.CONFIG={'model':'fixture','reasoning':'medium'};p.runtime.cost.persist=lambda *a,**k:{'coverage':{'status':'unknown'}}
 def snap(destination):
  if destination.name=='after-state.json':raise RuntimeError('Injected post-turn capture failure')
  destination.write_text('{}')
 p.snapshot=snap
 class Session:
  def __init__(self,*a):pass
  def close(self):pass
  def turn(self,sd,stage,resume):
   (sd/'lookout-trace.jsonl').write_text(json.dumps({'type':'user.interaction','data':{'category':'clarification'}})+'\n')
   return {'startedAt':100,'durationSeconds':12.5,'status':'completed'}
 p.runtime.Session=Session;p.run_pair('fixture-pair')
 for run in (root/'runs').iterdir():
  m=json.loads((run/'run.json').read_text());assert m['status']=='harness_failed'
  assert len(m['checkpoints'])==1
  cp=m['checkpoints'][0];assert cp['stage']=='initial_search' and cp['executionSeconds']==12.5
  assert cp['interactions']['uniqueTurns']==1 and cp['answeredTurnCount']==1
  assert cp['captureStatus']=='failed' and cp['captureError']=='RuntimeError'
  assert cp['status']=='completed' # Participant result stays distinct from harness capture failure.
`],{encoding:'utf8',env:{...process.env,PYTHONDONTWRITEBYTECODE:'1'}});assert.equal(result.status,0,result.stderr);
});

test('native startup and tool discovery are preserved without eager schema injection',()=>{
 const result=spawnSync('python3',['-B','-c',String.raw`
import ast,json
from types import SimpleNamespace
from pathlib import Path
source=Path('scripts/job01/bridge.py').read_text();tree=ast.parse(source)
functions=ast.Module(body=[n for n in tree.body if isinstance(n,ast.FunctionDef) and n.name in ['clean','visible_tools']],type_ignores=[])
calls=[]
def upstream(msg):
 calls.append(msg)
 return {'jsonrpc':'2.0','id':msg['id'],'result':{'tools':[{'name':'read_personal_context','inputSchema':{}},{'name':'submit_application','inputSchema':{}}]}}
ns={'json':json,'allowed':{'read_personal_context','discover_tools','call_discovered_tool'},'upstream':upstream,'a':SimpleNamespace(condition='lookout'),'LOCAL_TOOLS':[{'name':'ask_user'},{'name':'read_inbox'},{'name':'read_calendar'}]}
exec(compile(functions,'bridge-functions','exec'),ns)
reply=ns['visible_tools'](1)
assert [m['method'] for m in calls]==['tools/list']
assert {t['name'] for t in reply['result']['tools']}=={'read_personal_context','ask_user','read_inbox'}
native={'instructions':['Assignment data collection is enabled','For authorized work load agent-audit to record the run.'],'guides':[{'id':'agent-audit'}]}
assert ns['clean'](native)==native
assert "or name not in allowed or actual not in allowed" in source
assert "if a.condition=='lookout':reply=upstream(msg)" in source
`],{encoding:'utf8'});assert.equal(result.status,0,result.stderr);
});
