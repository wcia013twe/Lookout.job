import {test} from 'node:test';
import assert from 'node:assert/strict';
import {emptyCompany,validateCompany,companyIndex,companyFollowUps} from '../lib/network-model.mjs';
import {validateRequest} from '../supabase/functions/agent-gateway/contract.mjs';
import {TOOLS} from '../supabase/functions/agent-mcp/protocol.mjs';
import {demoFixtures} from '../next-app/lib/network-demo.mjs';
test('company research preserves provenance and rejects malformed data',()=>{
 const r={...emptyCompany('Example'),sources:[{title:'Guide',url:'https://example.com/guide',observedAt:'2026-10-20',summary:'Observed evidence'}]};
 assert.equal(validateCompany(r),r);
 for(const invalid of [{...r,website:'javascript:alert(1)'},{...r,followUpDate:'2026-02-30'},{...r,consent:true},{...r,sources:[{...r.sources[0],observedAt:''}]},{...r,contactIds:['a','a']}])assert.throws(()=>validateCompany(invalid));
});
test('company index supports research-only targets, legacy matches and explicit aliases',()=>{
 const records=[{id:'c',record:{...emptyCompany('Company'),contactIds:['contact'],applicationIds:['backend-app']}}];
 const contacts=[{id:'contact',company:'Company Alias',contact:'A'}],apps=[{id:'app',backendId:'backend-app',company:' COMPANY ',title:'SWE'}];
 const index=companyIndex(records,contacts,apps),company=index.find(c=>c.id==='c');
 assert.equal(company.contacts[0].id,'contact');assert.equal(company.applications.length,1);
 assert.equal(records[0].record.research,'');
 assert.equal(index.length,1,'Explicit aliases should not create duplicate company cards');
});
test('follow-ups require a due action and exclude archived records',()=>{
 const rows=[{id:'due',record:{...emptyCompany('A'),nextAction:'Reply',followUpDate:'2026-10-19'}},{id:'later',record:{...emptyCompany('B'),nextAction:'Research',followUpDate:'2026-10-22'}},{id:'archived',record:{...emptyCompany('C'),nextAction:'Paused',followUpDate:'2026-10-19',archived:true}}];
 assert.deepEqual(companyFollowUps(rows,'2026-10-20').map(r=>r.id),['due']);
});
test('MCP advertises scoped private company tools validated by gateway',()=>{
 assert.equal(TOOLS.find(t=>t.name==='save_network_company').scope,'network:write');
 assert.equal(TOOLS.find(t=>t.name==='read_network_companies').readOnly,true);
 assert.doesNotThrow(()=>validateRequest({operation:'network.company.save',payload:{id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',expectedRevision:0,record:emptyCompany('Example')}}));
 assert.throws(()=>validateRequest({operation:'network.companies.read',payload:{limit:101}}));
});
test('demo has private company research, a research-only target, and archived follow-ups',()=>{
 const a=demoFixtures('2026-10-20'),b=demoFixtures('2026-10-20');
 assert.equal(a.state.network.companies.length,3);
 assert.ok(a.state.network.companies.some(r=>r.record.sources.length));
 a.state.network.companies[0].record.interest='Edited';
 assert.notEqual(b.state.network.companies[0].record.interest,'Edited');
 assert.equal(companyFollowUps(b.state.network.companies,'2026-10-20').length,1);
});
