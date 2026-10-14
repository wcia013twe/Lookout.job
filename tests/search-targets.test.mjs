import test from 'node:test';
import assert from 'node:assert/strict';
import { validateTargets, scanningStatus } from '../lib/search-targets.mjs';
import { validateRequest } from '../supabase/functions/agent-gateway/contract.mjs';
import { TOOLS } from '../supabase/functions/agent-mcp/protocol.mjs';
const t = {id:'board',name:'HiringCafe',kind:'board',address:'https://hiring.cafe'};
test('target list validation rejects unsafe URLs, duplicates and capability injection', () => {
  assert.deepEqual(validateTargets([t,{id:'social',name:'Community',kind:'social',address:'@zero2sudo'}]).length,2);
  for (const bad of [[{...t,address:'javascript:alert(1)'}],[{...t,address:'@handle'}],[t,{...t,id:'second',address:'https://HIRING.CAFE/'}],[{...t,automatic:true}]]) assert.throws(() => validateTargets(bad));
});
test('MCP edit exposes bounded, versioned private targets only', () => {
  assert.ok(TOOLS.find(v => v.name === 'save_search_targets'));
  assert.doesNotThrow(() => validateRequest({operation:'preferences.targets.save',payload:{expectedVersion:0,targets:[t]}}));
  for (const payload of [{targets:[t]},{expectedVersion:-1,targets:[t]},{expectedVersion:0,targets:[t],public:true}]) assert.throws(() => validateRequest({operation:'preferences.targets.save',payload}));
  assert.equal(scanningStatus({kind:'social'}).label,'Forward content');
  assert.match(scanningStatus(t).label,/verification/);
});
