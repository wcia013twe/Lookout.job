import test from 'node:test';import assert from 'node:assert/strict';
import {validateSearchIntake,SEARCH_INTAKE_TOOLS} from '../supabase/functions/agent-gateway/search-intake.mjs';
import {validateRequest} from '../supabase/functions/agent-gateway/contract.mjs';
import {TOOLS} from '../supabase/functions/agent-mcp/protocol.mjs';
import {operationService} from '../lib/mcp-services.mjs';
const p={runId:'12345678-1234-1234-1234-123456789abc',sourceId:'query-1',eventKey:'test:lead:1',leads:[{url:'https://job-boards.greenhouse.io/example/jobs/123'}]};
test('lead intake is scoped, advertised and owned by the bounded Node service',()=>{
 assert.equal(validateSearchIntake('search.leads.submit',p),true);assert.doesNotThrow(()=>validateRequest({operation:'search.leads.submit',payload:p}));
 const tool=TOOLS.find(t=>t.name==='submit_search_leads');assert.ok(tool);assert.equal(tool.scope,'drafts:write');assert.ok(tool.requiredScopes.includes('workspace:read'));assert.equal(operationService(tool.operation).handler,'node');assert.equal(SEARCH_INTAKE_TOOLS.length,2);
});
test('lead intake rejects malformed, duplicate, oversized and local-network requests',()=>{
 for(const patch of [{runId:'bad'},{sourceId:''},{eventKey:'bad key'},{leads:[]},{leads:Array(26).fill(p.leads[0])},{leads:[p.leads[0],p.leads[0]]},{leads:[{url:'http://example.com'}]},{leads:[{url:'https://localhost/job'}]},{leads:[{url:'https://user:secret@example.com'}]},{leads:[{url:'https://example.com',owner:'forged'}]},{userId:'forged'}])assert.throws(()=>validateSearchIntake('search.leads.submit',{...p,...patch}));
});

test('aggregate lead paging has an owned bounded read boundary',()=>{
 assert.doesNotThrow(()=>validateSearchIntake('search.source.leads',{runId:p.runId,sourceId:p.sourceId,offset:0,limit:25}));
 for(const patch of [{limit:101},{offset:-1},{runId:'bad'},{sourceId:''},{url:'https://arbitrary.test'}])assert.throws(()=>validateSearchIntake('search.source.leads',{runId:p.runId,sourceId:p.sourceId,...patch}));
});
