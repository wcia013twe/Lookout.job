import test from 'node:test';
import assert from 'node:assert/strict';
import { validateRequest } from '../supabase/functions/agent-gateway/contract.mjs';
import { TOOLS } from '../supabase/functions/agent-mcp/protocol.mjs';
const id='11111111-1111-1111-1111-111111111111';
const settings={cadence:'daily',timezone:'America/New_York',digestHour:9,digestDay:1,urgentDeadlineHours:24};
test('parity tools expose narrow scopes and explicit human boundary',()=>{
 const mappings=[['selection.reconsider','activity:write'],['quiet.read','workspace:read'],['quiet.update','profile:write'],['applications.human_action','workspace:read']];
 for(const [operation,scope] of mappings) assert.equal(TOOLS.find(t=>t.operation===operation)?.scope,scope);
 assert.match(TOOLS.find(t=>t.operation==='applications.human_action').description,/Never grants approval/);
});
test('quiet update accepts bounded settings/version and rejects owner or unrelated preferences',()=>{
 validateRequest({operation:'quiet.update',payload:{settings,expectedPersonalVersion:2}});
 for(const payload of [{settings,expectedPersonalVersion:0},{settings:{...settings,autoSubmitApproved:true},expectedPersonalVersion:2},{settings:{...settings,timezone:'invalid'},expectedPersonalVersion:2},{settings,expectedPersonalVersion:2,userId:id}]) assert.throws(()=>validateRequest({operation:'quiet.update',payload}));
});
test('reconsideration requires current token and boundary requires owned action enum',()=>{
 validateRequest({operation:'selection.reconsider',payload:{decisionId:id,expectedReconsideredAt:''}});
 assert.throws(()=>validateRequest({operation:'selection.reconsider',payload:{decisionId:id}}));
 assert.throws(()=>validateRequest({operation:'selection.reconsider',payload:{decisionId:id,expectedReconsideredAt:'made-up'}}));
 validateRequest({operation:'applications.human_action',payload:{applicationId:id,action:'resolve_submission'}});
 assert.throws(()=>validateRequest({operation:'applications.human_action',payload:{applicationId:id,action:'submit'}}));
});
