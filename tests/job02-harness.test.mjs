import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import {spawnSync} from 'node:child_process';
import {read,write,hash,digest,actorAnswer,validateTargets,readiness,launchGate,assertFrozen,gates} from '../scripts/job02/core.mjs';
import {mcp,responsePayload} from '../scripts/job02/native.mjs';
import {BrowserHost} from '../scripts/job02/browser.mjs';
import {build} from '../scripts/evals/contract.mjs';
const scenario=read(new URL('../examples/job02/scenario.json',import.meta.url)),actor=read(new URL('../examples/job02/actor.json',import.meta.url));
function root(){const r=fs.mkdtempSync(path.join(os.tmpdir(),'job02-test-'));fs.mkdirSync(r+'/suite');write(r+'/suite/scenario.json',scenario);write(r+'/freeze.json',{version:'JOB02-test',files:{}});return r;}
test('unselected live targets cannot pass as synthetic fixture targets',()=>{assert.throws(()=>validateTargets(scenario),/selection pending/);});
test('actor scope prevents job-specific motivation reuse and unrelated coaching',()=>{assert.equal(actorAnswer(actor,'personal','Why do you want to apply?').factId,'motivation');assert.equal(actorAnswer(actor,'clean','Why do you want to apply?').factId,null);assert.equal(actorAnswer(actor,'personal','What is my hometown?').factId,null);});
test('actor ambiguity cannot choose an arbitrary fact',()=>{const a={...actor,facts:[...actor.facts,actor.facts[0]]};assert.equal(actorAnswer(a,'personal','Why do you want to apply?').ambiguous,true);});
test('human response preserves prior answers, binds actual card and grants no submission approval',()=>{const item={kind:'resolve_blocker',key:'application:key:revision',applicationId:'id',questions:[{fieldId:'name',question:'Name',answer:'Existing human answer'},{fieldId:'why',question:'Why do you want to apply?',answer:''}]};const r=responsePayload(item,'personal',actor);assert.deepEqual(r.payload.input.answers,['Existing human answer',actor.facts[0].answer]);assert.equal(r.payload.response,'accept');assert.equal(r.payload.input.confirmed,true);assert.equal('approval'in r.payload,false);});
test('unknown required answer stays blocked and only partial save is permitted',()=>{const r=responsePayload({kind:'resolve_blocker',key:'k',applicationId:'id',questions:[{question:'Why do you want to apply?',answer:''},{question:'Required unknown birthplace',answer:''}]},'personal',actor);assert.equal(r.payload.response,'save');assert.equal(r.eventExpected,false);assert.equal(r.payload.input.answers[1],'');});
test('readiness rejects missing receipts and a forged ready bit',()=>{const r=root();const result=readiness(r,{});assert.equal(result.ready,false);assert.equal(result.errors.filter(e=>e.startsWith('Missing')).length,gates.length);write(r+'/readiness.json',{...result,ready:true});write(r+'/receipts.json',{});assert.throws(()=>launchGate(r),/Launch blocked/);});
test('frozen file tampering is rejected before model execution',()=>{const r=root();fs.writeFileSync(r+'/input.txt','a');fs.writeFileSync(r+'/freeze.json',JSON.stringify({files:{'input.txt':digest(r+'/input.txt')}}));fs.writeFileSync(r+'/input.txt','b');assert.throws(()=>assertFrozen(r),/Frozen binding changed/);});
test('unresolved harness errors cannot be erased by passing unrelated gate receipt',()=>{const r=root();write(r+'/errors.json',[{id:'actor-event-missing',resolvedBy:'unrelated'}]);const result=readiness(r,{});assert.ok(result.errors.some(e=>e.includes('actor-event-missing')));});
test('actual receipt artifact drift prevents readiness even with correct freeze hash',()=>{const r=root(),p=r+'/proof.json';write(p,{ok:true});const receipt={id:'native',status:'passed',synthetic:false,freezeHash:digest(r+'/freeze.json'),artifacts:{[p]:digest(p)}};fs.writeFileSync(p,'changed');assert.ok(readiness(r,{native_schemas:receipt}).errors.some(e=>e==='Gate evidence changed: native_schemas'));});
test('native HTTP failure and failed tool write never become empty-success responses',async()=>{for(const [status,body]of [[401,{error:'expired auth'}],[200,{result:{isError:true,content:[{type:'text',text:'draft write failed'}]}}]]){const s=http.createServer((q,r)=>{r.writeHead(status,{'content-type':'application/json'});r.end(JSON.stringify(body));});await new Promise(resolve=>s.listen(0,'127.0.0.1',resolve));try{await assert.rejects(mcp({mcpUrl:'http://127.0.0.1:'+s.address().port,token:'fictional'},'prepare_draft',{}),/Native operation failed/);}finally{await new Promise(resolve=>s.close(resolve));}}});
test('model has no generic browser click/key/script/submit operation',async()=>{const b=new BrowserHost({targets:[]});for(const name of ['browser_submit','browser_click','browser_evaluate','browser_press'])await assert.rejects(b.call(name,{}),/unavailable/);});
test('live navigation/mutation boundary rejects off-target URLs and submission paths',()=>{const b=new BrowserHost({targets:[]}),t={url:'https://job-boards.greenhouse.io/fictional/jobs/1',safeBeforeSubmit:true,safeUploadEndpoints:[]};const page={mainFrame:()=>frame},frame={page:()=>page};function request(url,method='GET',navigation=false){return {url:()=>url,method:()=>method,isNavigationRequest:()=>navigation,resourceType:()=>navigation?'document':'fetch',frame:()=>frame};}assert.equal(b.allowRequest(request(t.url,'GET',true),t),true);assert.equal(b.allowRequest(request(t.url+'/submit','POST'),t),false);assert.equal(b.allowRequest(request('https://other.example/','GET',true),t),false);assert.equal(b.allowRequest(request(t.url+'?submit=true','GET',true),t),false);});
test('offline common telemetry preserves pilot exclusion and missing quality',()=>{const r={schemaVersion:1,campaignId:'JOB02-pilot',suiteId:'JOB02',suiteVersion:scenario.version,scenarioId:'JOB02',scenarioVersion:scenario.version,condition:'baseline',episodeId:'fixture',model:scenario.model,reasoning:scenario.reasoning,harnessVersion:'JOB02-host-v1',graderVersion:scenario.graderVersion,repeat:1,evidenceDigest:'a'.repeat(64),pilot:true,synthetic:false,startedAt:1,endedAt:2,status:'completed',evaluation:{reviewed:false,taskSuccess:null,quality:null,activeSeconds:1,toolCalls:0,wakesUsed:2}};const b=build(r);assert.equal(b.environment,'benchmark-pilot');assert.equal(b.scores.some(s=>s.name==='eval_v1_quality'),false);});

test('final grading rejects wrong live values and accepts a supported frozen blocker outcome',async()=>{
 for(const supportedBlocker of [false,true]){
 const {handoff,assignGrader,finalize}=await import('../scripts/job02/grade.mjs');
 const r=fs.mkdtempSync(path.join(os.tmpdir(),'job02-grade-'));fs.mkdirSync(r+'/suite');
 const spec={...scenario,targets:scenario.targets.map(t=>({...t,url:'https://example.test/'+t.id}))};
 const ref={outcomes:{personal:supportedBlocker?'ready_or_supported_blocker':'ready'},criteria:Object.fromEntries(spec.stages.map(s=>[s.id,Object.fromEntries(spec.targets.map(t=>[t.id,['routing']]))])),fields:{manual:[],personal:[{fieldId:'email',acceptedValues:['right@example.test']}],clean:[{fieldId:'email',acceptedValues:['right@example.test']}]}};
 write(r+'/suite/scenario.json',spec);write(r+'/reference.private.json',ref);fs.writeFileSync(r+'/suite/grader-instructions.md','Frozen review rules');write(r+'/freeze.json',{version:spec.version,files:{}});write(r+'/pilot-attempt.json',{pairId:'fixture'});
 for(const c of ['baseline','lookout']){
  const dir=r+'/runs/'+c;write(dir+'/run.json',{episodeId:c+'-fixture',condition:c,status:'completed',startedAt:1,endedAt:3,toolCalls:1,prescribedInitiations:1,simulatedWaitingMinutes:5,interactions:[],stages:spec.stages.map((s,i)=>({id:s.id,index:i+1,durationSeconds:1}))});
  for(let index=1;index<=2;index++)write(dir+'/stage-'+index+'/browser/final.json',{targets:spec.targets.map(t=>({targetId:t.id,observed:true,readyToSubmit:!(supportedBlocker&&t.id==='personal'),fields:[{fieldId:'email',value:!supportedBlocker&&c==='baseline'&&t.id==='personal'?'wrong@example.test':'right@example.test'}]}))});
 }
 const h=handoff(r);assert.throws(()=>assignGrader(r,'operator','operator',['operator']),/Fresh reviewer/);const assignment=assignGrader(r,'fresh-reviewer','operator',['operator','implementer']);write(r+'/grading/native-confirmation.json',{status:'confirmed',handoffHash:hash(h)});
 const submission={attestation:{reviewerAgentId:'fresh-reviewer',assignmentHash:hash(assignment),didImplement:false,didOperate:false,didParticipate:false,freshContext:true},conditions:{}};
 for(const c of ['baseline','lookout']){const cite={evidenceFiles:['stage-2/browser/final.json'],explanation:'Synthetic field proof'};submission.conditions[c]={checkpoints:Object.fromEntries(spec.stages.map(s=>[s.id,Object.fromEntries(spec.targets.map(t=>[t.id,{...cite,complete:true,checks:{routing:{...cite,rating:2}}}]))])),additionalTurns:[],adherence:Object.fromEntries(spec.adherence.map(k=>[k,{...cite,status:'used_correctly'}]))};}
 const result=finalize(r,submission);assert.equal(result[0].result.taskSuccess,supportedBlocker);assert.equal(result[1].result.taskSuccess,true);
 }
});

test('frozen form drift rejects reinspection, fill and upload before any mutation',async t=>{
 const output=fs.mkdtempSync(path.join(os.tmpdir(),'job02-frozen-form-'));t.after(()=>fs.rmSync(output,{recursive:true,force:true}));
 const shape={fieldId:'name',index:0,fieldType:'text',question:'Full name',required:true,disabled:false,visible:true,options:[],maxLength:null};
 let data={url:'https://example.test/form',fields:[{...shape,value:'',files:[],valid:false,validationMessage:'Required'}],alerts:[],busy:false,formCount:1,iframeCount:0,nextControl:false,submitControls:[]},mutations=0;
 const target={id:'clean',kind:'greenhouse',url:data.url,expectedFingerprint:hash([shape])};const b=new BrowserHost({targets:[target],output,synthetic:false});b.pages.set('clean',{evaluate:async()=>structuredClone(data),locator:()=>{mutations++;throw Error('Unexpected write');}});
 assert.equal((await b.inspect('clean')).fingerprint,target.expectedFingerprint);
 data.fields[0].question='A changed employer question';const current=hash([{...shape,question:data.fields[0].question}]);
 await assert.rejects(b.inspect('clean'),/Frozen form drift/);
 await assert.rejects(b.fill('clean','name','Candidate',current),/Frozen form drift/);
 await assert.rejects(b.upload('clean','resume',current),/Frozen form drift/);
 data.fields[0].question=shape.question;await assert.rejects(b.inspect('clean'),/Frozen form drift/);
 assert.equal(mutations,0);assert.equal(read(output+'/form-drift.json').observedFingerprint,current);
});
test('only pre-reviewed conditional fingerprints are accepted and live forms require a freeze',async t=>{
 const output=fs.mkdtempSync(path.join(os.tmpdir(),'job02-conditional-'));t.after(()=>fs.rmSync(output,{recursive:true,force:true}));
 const shape={fieldId:'extra',index:0,fieldType:'text',question:'Other details',required:false,disabled:false,visible:false,options:[],maxLength:null};let fields=[{...shape,value:'',files:[],valid:true,validationMessage:''}];
 const target={id:'personal',expectedFingerprint:hash([shape]),expectedFingerprints:[hash([{...shape,visible:true}])]};const b=new BrowserHost({targets:[target],output,synthetic:false});b.pages.set('personal',{evaluate:async()=>({fields,formCount:1,iframeCount:0,nextControl:false,alerts:[],busy:false})});
 await b.inspect('personal');fields=[{...fields[0],visible:true}];assert.equal((await b.inspect('personal')).fingerprint,target.expectedFingerprints[0]);
 await assert.rejects(b.fill('personal','extra','x',target.expectedFingerprint),/Form changed/);
 const missing=new BrowserHost({targets:[{id:'personal'}],output:output+'/missing',synthetic:false});missing.pages.set('personal',b.pages.get('personal'));await assert.rejects(missing.inspect('personal'),/Frozen form drift/);
});
test('frozen-form failure stops pair before launching the second participant condition',()=>{
 const r=spawnSync('python3',['-B','-c',String.raw`
import importlib.util,tempfile,json
from pathlib import Path
s=importlib.util.spec_from_file_location('job02_test_runner','scripts/job02/runner.py');j=importlib.util.module_from_spec(s);s.loader.exec_module(j)
with tempfile.TemporaryDirectory() as t:
 root=Path(t);j.ROOT=root
 for n in ['suite','candidate','runs']:(root/n).mkdir()
 spec={'version':'unit-drift','targets':[],'stages':[{'id':'prepare','session':1}],'stageBudgetSeconds':30}
 (root/'suite/scenario.json').write_text(json.dumps(spec));(root/'candidate/resume.pdf').write_bytes(b'fixture');(root/'runtime.private.json').write_text('{}')
 calls=[];j.node=lambda action,*args:calls.append(action);j.snapshot=lambda p:p.write_text('{}');j.capture=lambda *a:(_ for _ in ()).throw(AssertionError('Should stop before final capture'))
 j.host.infrastructure=lambda:None;j.host.close_infrastructure=lambda:None;j.runtime.cost.persist=lambda *a:{'coverage':{'status':'unknown'}}
 class Session:
  def __init__(self,*args):pass
  def close(self):pass
  def turn(self,sd,stage,resume):
   (sd/'lookout-trace.jsonl').write_text('');(sd/'browser/form-drift.json').write_text(json.dumps({'kind':'frozen_form_drift'}))
   return {'status':'completed','durationSeconds':1,'startedAt':100}
 j.runtime.Session=Session;j.run('unit-drift')
 assert not (root/'runs/lookout').exists()
 stop=json.loads((root/'pair-stop.json').read_text());assert stop['reason']=='frozen_form_drift' and stop['unexecutedConditions']==['lookout']
 meta=json.loads((root/'runs/baseline/run.json').read_text());assert meta['status']=='harness_failed' and meta['sourceDrift'] is True
 assert meta['stages'][0]['durationSeconds']==1
 assert 'handoff' not in calls and 'confirm' not in calls
`],{encoding:'utf8',env:{...process.env,PYTHONDONTWRITEBYTECODE:'1'}});assert.equal(r.status,0,r.stderr);
});
