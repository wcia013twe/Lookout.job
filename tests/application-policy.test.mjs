import test from 'node:test';
import assert from 'node:assert/strict';
import { applicationPolicy } from '../supabase/functions/agent-gateway/application-policy.mjs';
import { validateRequest } from '../supabase/functions/agent-gateway/contract.mjs';
import { createHandler } from '../supabase/functions/agent-mcp/protocol.mjs';
const list = type => ({ id: type, employmentType: type, companies: [{ id: 'nv', name: 'NVIDIA' },{ id: 'or', name: 'Oracle' }], placements: { S: ['nv'], C: ['or'], unranked: [] } });
const preferences = { search: { autoSubmitApproved: true }, tier_lists: [list('FT'),list('Internship')] };
const decide = (company = 'Oracle', employmentType = 'FT', settings = preferences) => applicationPolicy({ preferences: settings, job: { company, employmentType } });
test('routine Oracle baseline auto-applies while important NVIDIA requires focused review', () => {
  assert.equal(decide().mode, 'auto-apply'); assert.equal(decide().reviewRequired, false);
  assert.equal(decide('NVIDIA').mode, 'review'); assert.equal(decide('NVIDIA').companyTier, 'S');
  assert.equal(decide(' Oracle ').mode, 'auto-apply');
});
test('full-time and internship thresholds independently follow selected lists', () => {
  const own = structuredClone(preferences); own.search.reviewPolicy = { fullTime: { threshold: 'C', tierListId: 'FT' }, internship: { threshold: 'S', tierListId: 'Internship' } };
  assert.equal(decide('Oracle','FT',own).mode, 'review'); assert.equal(decide('Oracle','Internship',own).mode, 'auto-apply');
  own.tier_lists[1].placements = { A: ['or'], S: ['nv'] };
  own.search.reviewPolicy.internship.threshold = 'A'; assert.equal(decide('Oracle','Internship',own).mode, 'review');
});
test('off/missing or invalid policy never silently auto-applies', () => {
  assert.equal(decide('Oracle','FT',{}).mode,'review');
  for (const value of [false,'true',1,null]) assert.equal(decide('Oracle','FT',{ ...preferences, search: { autoSubmitApproved: value } }).mode,'review');
  for (const threshold of ['invalid','all']) assert.equal(decide('Oracle','FT',{ ...preferences, search: { autoSubmitApproved:true, reviewPolicy: {fullTime:{threshold}} } }).mode,'review');
});
test('unranked, ambiguous lists, wrong-type lists and duplicate placements require review', () => {
  assert.equal(decide('Unknown').mode,'review');
  const own = structuredClone(preferences); own.tier_lists.push({...list('FT'),id:'another'}); assert.equal(decide('Oracle','FT',own).mode,'review');
  own.search.reviewPolicy = {fullTime:{tierListId:'FT',threshold:'A'}}; assert.equal(decide('Oracle','FT',own).mode,'auto-apply');
  own.search.reviewPolicy.fullTime.tierListId = 'Internship'; assert.equal(decide('Oracle','FT',own).mode,'review');
  own.search.reviewPolicy.fullTime.tierListId = 'FT'; own.tier_lists[0].placements.A=['or']; assert.equal(decide('Oracle','FT',own).mode,'review');
});
test('exclusions return skip and theme labels do not affect company ranking', () => {
  assert.equal(decide('Oracle','FT',{...preferences,search:{autoSubmitApproved:true,excludedCompanies:['oracle']}}).mode,'skip');
  assert.equal(decide('Oracle','FT',{...preferences,search:{autoSubmitApproved:true,employmentTypes:['Internship']}}).mode,'skip');
  const own=structuredClone(preferences); own.theme={pack:'pokemon'}; own.tier_lists[0].tiers=[{id:'S',label:'Mythic'}]; assert.equal(decide('NVIDIA','FT',own).companyTier,'S');
});
test('policy request accepts only canonical job ID; agent cannot inject ranking or owner', () => {
  const payload={jobId:'00000000-0000-4000-8000-000000000001'};
  assert.doesNotThrow(()=>validateRequest({operation:'applications.policy',payload}));
  for (const bad of [{...payload,userId:'other'},{...payload,companyTier:'C'},{jobId:'bad'}]) assert.throws(()=>validateRequest({operation:'applications.policy',payload:bad}));
});
test('MCP policy tool is scope-gated and forwards only the validated job argument', async () => {
  const calls=[]; const handler=createHandler(async(_token,operation,payload)=>{calls.push({operation,payload}); return {status:200,data: operation==='credentials.verify'?{scopes:['workspace:read']}:{mode:'review'}};});
  const request=new Request('https://example.test/mcp',{method:'POST',headers:{Authorization:'Bearer jb_agent_'+'a'.repeat(64),'Content-Type':'application/json',Accept:'application/json, text/event-stream'},body:JSON.stringify({jsonrpc:'2.0',id:1,method:'tools/call',params:{name:'read_application_policy',arguments:{jobId:'00000000-0000-4000-8000-000000000001'}}})});
  const response=await (await handler(request)).json(); assert.equal(JSON.parse(response.result.content[0].text).mode,'review'); assert.equal(calls[1].operation,'applications.policy');
});

test('custom untyped lists work only when explicitly selected', () => {
  const own = structuredClone(preferences); own.tier_lists = [{...list('FT'),id:'custom',employmentType:undefined}];
  assert.equal(decide('Oracle','FT',own).mode,'review');
  own.search.reviewPolicy = {fullTime:{tierListId:'custom',threshold:'A'}};
  assert.equal(decide('Oracle','FT',own).mode,'auto-apply');
});
