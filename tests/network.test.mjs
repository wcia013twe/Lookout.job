import {test} from 'node:test';
import assert from 'node:assert/strict';
import {emptyCompany,validateCompany,companyIndex,companyFollowUps,encodeCompany,decodeCompany,isCompanyRecord,contactsForProcess,processContactDraft} from '../lib/network-model.mjs';
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
 const index=companyIndex(records,[{id:'contact',company:'Company Alias',contact:'A'}],[{id:'app',backendId:'backend-app',company:' COMPANY ',title:'SWE'}]);
 assert.equal(index[0].contacts[0].id,'contact');assert.equal(index[0].applications.length,1);assert.equal(index.length,1);
});
test('follow-ups require a due action and exclude archived records',()=>{
 const rows=[{id:'due',record:{...emptyCompany('A'),nextAction:'Reply',followUpDate:'2026-10-19'}},{id:'later',record:{...emptyCompany('B'),nextAction:'Research',followUpDate:'2026-10-22'}},{id:'archived',record:{...emptyCompany('C'),nextAction:'Paused',followUpDate:'2026-10-19',archived:true}}];
 assert.deepEqual(companyFollowUps(rows,'2026-10-20').map(r=>r.id),['due']);
});
test('company briefs retain scoped contact-note compatibility projections',()=>{
 const row={id:'company-example',revision:4,record:{...emptyCompany('Example'),research:'Sourced research',nextAction:'Ask about team'}};
 const encoded=encodeCompany(row);assert.equal(isCompanyRecord(encoded),true);assert.equal(encoded.contact,undefined);
 assert.deepEqual(decodeCompany({...encoded,_revision:4}).record,row.record);
 assert.equal(decodeCompany({...encoded,_revision:4}).revision,4);
 assert.doesNotThrow(()=>validateRequest({operation:'contacts.save',payload:{id:row.id,expectedRevision:4,record:Object.fromEntries(Object.entries(encoded).filter(([k])=>k!=='id'))}}));
 assert.equal(TOOLS.find(t=>t.name==='save_contact').scope,'network:write');
 assert.equal(TOOLS.some(t=>t.name==='save_network_company'),false);
 assert.equal(decodeCompany({...encoded,notes:'Legacy company notes'}).record.research,'Legacy company notes');
});
test('demo company notes are private, resettable and distinct from people',()=>{
 const a=demoFixtures('2026-10-20'),b=demoFixtures('2026-10-20');
 const companies=a.state.network.companies;
 assert.equal(companies.length,2);assert.ok(companies.every(r=>r.record.sources.length));assert.deepEqual(companies.map(r=>r.record.name).sort(),['Robinhood','Stripe']);
 a.state.network.companies[0].record.research='Edited';
 assert.notEqual(b.state.network.companies[0].record.research,'Edited');
 assert.equal(companyFollowUps(companies,'2026-10-20').length,1);
});
test('legacy contacts without a company remain accessible',()=>{const rows=companyIndex([],[{id:'unassigned',name:'Example Contact'}],[]);assert.equal(rows[0].record.name,'Other contacts');assert.equal(rows[0].contacts[0].id,'unassigned');});

test('process outreach keeps requisitions and explicit process references separate',()=>{
 const a={id:'a',backendId:'owned-a',company:'Example',title:'Backend',applicationUrl:'https://example.com/jobs?gh_jid=1'};
 const b={...a,id:'b',backendId:'owned-b',applicationUrl:'https://example.com/jobs?gh_jid=2'};
 const contacts=[{id:'general',company:'Example',title:'Backend'},{id:'url',jobUrl:'https://example.com/jobs?utm_source=test&gh_jid=1'},{id:'tag',tags:['application:owned-b'],jobUrl:a.applicationUrl}];
 assert.deepEqual(contactsForProcess(contacts,a).map(c=>c.id),['url']);
 assert.equal(contactsForProcess([{id:'local-draft',tags:['application:a']}],a).length,1,'Local process references survive backend hydration');
 assert.deepEqual(contactsForProcess(contacts,b).map(c=>c.id),['tag']);
 const old={id:'person',company:'Example',contact:'Morgan',contactType:'engineer',message:'Existing message',status:'Referred',connection:'Shared club'};
 const draft=processContactDraft(old,a,'new-draft');
 assert.equal(draft.message,'');assert.equal(draft.status,'Not asked');assert.equal(old.message,'Existing message');
 assert.deepEqual(contactsForProcess([draft],a),[draft]);assert.deepEqual(contactsForProcess([draft],b),[]);
 const {id,...record}=draft;assert.doesNotThrow(()=>validateRequest({operation:'contacts.save',payload:{id,expectedRevision:0,record}}));
});
