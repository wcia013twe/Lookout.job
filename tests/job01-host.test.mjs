import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {extract} from '../scripts/job01/extract.mjs';
test('host release isolates future evidence and onboarding while preserving asymmetric email delivery',()=>{
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
 assert (inputs/'email.json').exists() and not (inputs/'sources.json').exists()
 assert 'PRIVATE_INITIAL_CONTEXT' in p.prompt(stage,'baseline')
 stage['_index']=4;assert 'PRIVATE_INITIAL_CONTEXT' not in p.prompt(stage,'baseline')
 p.release(stage,'lookout',inputs)
 assert not (inputs/'email.json').exists() and json.loads((inputs/'sources.json').read_text())['inbox'][0]==payload['email']
 assert not (inputs/'profile.md').exists()
 assert 'PRIVATE_INITIAL_CONTEXT' not in p.prompt(stage,'lookout')
 assert 'Use Lookout tools' in p.prompt(stage,'lookout')
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
