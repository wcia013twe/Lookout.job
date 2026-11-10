import test from 'node:test';import assert from 'node:assert/strict';
import {participantBudget,participantAdapterTimeout} from '../scripts/jobs/preflight.mjs';
test('completion policy removes both case coordinator deadlines without weakening fixed cases',()=>{
 const fixed={hostVersion:'jobs-host-v3'},completion={hostVersion:'jobs-host-v4',participantTurnPolicy:'until_completion'};
 assert.equal(participantBudget(fixed,300),300);assert.equal(participantAdapterTimeout(300),345000);
 assert.equal(participantBudget(completion,300),null);assert.equal(participantAdapterTimeout(null),0);
 assert.throws(()=>participantBudget({...fixed,participantTurnPolicy:'until_completion'},300),/Unsupported/);
});
import {adapter as job03Adapter} from '../scripts/job03/task.mjs';
import {adapter as job04Adapter} from '../scripts/job04/task.mjs';
test('both outer process adapters accept healthy work beyond a nominal short deadline',()=>{
 const command=[process.execPath,'-e',"setTimeout(()=>console.log(JSON.stringify({status:'completed'})),100)"];
 for(const adapter of [job03Adapter,job04Adapter]){
  assert.throws(()=>adapter(command,{},1),/adapter_timeout/);
  assert.equal(adapter(command,{},participantAdapterTimeout(null)).status,'completed');
 }
});
