import test from 'node:test';
import assert from 'node:assert/strict';
import {connectionClipboardText,AGENT_MCP_URL} from '../next-app/lib/agent-connection-handoff.mjs';
test('default chat handoff never contains the connection token or bearer configuration',()=>{
 const secret='jb_agent_'+'a'.repeat(64);
 for(const token of [secret,'another-private-value','']){
  const text=connectionClipboardText(token);
  assert.ok(text.includes(AGENT_MCP_URL));assert.ok(text.includes('secure credential form'));
  if(token)assert.ok(!text.includes(token));
  assert.ok(!text.includes('Bearer '));assert.ok(!text.includes('jb_agent_'));
 }
 assert.equal(connectionClipboardText(secret),connectionClipboardText('different-secret'));
});
test('only an explicit secure token copy returns the raw credential, without JSON or a Bearer prefix',()=>{
 const secret='jb_agent_'+'b'.repeat(64);
 assert.equal(connectionClipboardText(secret,true),secret);
});

import contract from '../supabase/functions/agent-gateway/instructions.json' with {type:'json'};
import {createDemoServices} from '../next-app/lib/muse-demo-fixtures.mjs';
import {createMemoryStore,demoFixtures} from '../next-app/lib/demo.mjs';
test('setup instructions configure saved automations and stop without doing their work',()=>{
 const text=connectionClipboardText('not-a-real-token');
 for(const phrase of ['connection_test','automationSetup.schedule','Do not run the tasks now','actual scheduler receipts','then stop','avoiding duplicates'])assert.ok(text.includes(phrase),phrase);
 assert.ok(contract.quickstart[0].includes('connection_test'));
 assert.ok(contract.quickstart[0].includes('Do not run searches'));
 assert.ok(contract.instructions[0].includes('do not execute tasks now')||contract.instructions[0].includes('execute searches now'));
});
test('fictional connection setup exposes only its isolated schedule and never queues discovery',async()=>{
 const store=createMemoryStore(demoFixtures('2026-10-23').state,()=>{}),api=createDemoServices(store);
 const before=await api.onboardingAction('onboarding.get_state');
 const after=await api.onboardingAction('onboarding.submit_step',{expectedRevision:before.revision,eventKey:'demo-setup',event:'connection_test',data:{}});
 assert.ok(after.data.connectionTest.checkedAt);assert.equal(after.step,before.step);assert.deepEqual(after.tasks,before.tasks);
});
