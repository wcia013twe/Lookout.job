import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {packet as packet4,read,prepare,runtimeBinding} from '../scripts/job04/task.mjs';
import {packet as packet3,additionalInteractions} from '../scripts/job03/task.mjs';
import {verifyHostGates} from '../scripts/jobs/preflight.mjs';
const spec4=read(new URL('../examples/job04/scenario.json',import.meta.url)),evidence=read(new URL('../examples/job04/evidence.json',import.meta.url));
const spec3=read(new URL('../examples/job03/scenario.json',import.meta.url)),fixture=read(new URL('../examples/job03/fixture.json',import.meta.url));
test('JOB03/04 match every task request and evidence release without scheduled-intent advantage',()=>{
 assert.equal(spec4.productConfiguration.scheduledInterviewReview,false);
 for(const s of spec4.stages){const a=packet4(spec4,evidence,s,'baseline','context'),b=packet4(spec4,evidence,s,'lookout','context');assert.equal(a.prompt,b.prompt);assert.deepEqual(a.events,b.events);assert.equal(a.permissions,b.permissions);}
 for(const s of spec3.stages){const a=packet3(spec3,fixture,s,'baseline'),b=packet3(spec3,fixture,s,'lookout');assert.deepEqual(a.input,b.input);assert(a.input.message.trim());assert(spec3.stageQuality[s.id].length);}
});
test('preflight rejects missing or altered gate evidence rather than trusting ready:true',t=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'jobs-gates-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));fs.mkdirSync(path.join(root,'receipts'));fs.writeFileSync(path.join(root,'configuration.json'),JSON.stringify({benchmarkTaskId:'JOB04'}));
 const result={ready:true,participantExecuted:false,model:'gpt-5.6-terra',reasoning:'medium',gates:[]};assert.throws(()=>verifyHostGates(root,result),/incomplete/);
 const p=path.join(root,'receipts/changed.json');fs.writeFileSync(p,'changed');result.gates=[{name:'context_parity',status:'passed',path:p,sha256:'bad'}];assert.throws(()=>verifyHostGates(root,result),/changed/);
});
test('JOB03 visible demands cannot silently disappear from effort totals',()=>{
 assert.throws(()=>additionalInteractions({checkpoints:[]},{},{},'/unused'),/all visible/);
 assert.deepEqual(additionalInteractions({checkpoints:[{stage:'initial'}]},{interactionReviewComplete:true,additionalInteractions:[{id:'prose-1',stage:'initial',answered:false,reason:'Specific question in final response',evidenceFiles:['initial/response.json']}]},{'initial/response.json':'hash'},'/unused'),{turns:1,answered:0});
});
test('owner-specific JOB04 IDs remap released event links consistently',t=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'jobs-owner-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));const candidate=path.join(root,'candidate');fs.mkdirSync(candidate);fs.writeFileSync(path.join(candidate,'profile.md'),'Fictional candidate');fs.writeFileSync(path.join(candidate,'resume.pdf'),'%PDF fixture');
 const mapping=Object.fromEntries(evidence.applications.map((a,i)=>[a.id,`55555555-5555-4555-8555-55555555550${i}`]));
 prepare(path.join(root,'prepared'),{benchmarkTaskId:'JOB04',dedicated:true,model:'gpt-5.6-terra',reasoning:'medium',applicationIdMapping:mapping},candidate);
 const actual=read(path.join(root,'prepared/suite/evidence.json'));assert.equal(actual.events[0].applicationId,mapping[evidence.events[0].applicationId]);assert.deepEqual(actual.applications.map(a=>a.id),Object.values(mapping));
});
test('runtime binding hashes the installed interpreter target behind a symlink',t=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'jobs-interpreter-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));const script=path.join(root,'adapter.py'),link=path.join(root,'interpreter');fs.writeFileSync(script,'# fixture');fs.symlinkSync(process.execPath,link);
 const binding=runtimeBinding([link,script],{runtimeFiles:[script]});assert.equal(binding.files[fs.realpathSync(link)],createHash('sha256').update(fs.readFileSync(fs.realpathSync(link))).digest('hex'));
});
