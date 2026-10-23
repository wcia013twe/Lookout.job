import {test} from 'node:test';import assert from 'node:assert/strict';
import {parseDocument,profileDocument,compactBrief} from '../lib/search/documents.mjs';
import {SEARCH_TOOLS,prepareSearch,searchResponse} from '../supabase/functions/agent-gateway/search.mjs';
import {validateRequest} from '../supabase/functions/agent-gateway/contract.mjs';
import {TOOLS,createHandler} from '../supabase/functions/agent-mcp/protocol.mjs';
import {readGuide} from '../supabase/functions/agent-gateway/guides.mjs';
import {findToolkitSkill} from '../lib/career-toolkit.mjs';
import {execFileSync} from 'node:child_process';
test('YAML/profile canonicalization preserves narrative and produces rebuildable projections',()=>{
 const input='---\nid: general\nname: General\nactive: true\nfilters: {Location: Anywhere}\npriorities: {}\n---\n## Exceptions\nKeep my exact prose.\n';
 const d=parseDocument('profile',input);assert.equal(d.projection.instructions,'## Exceptions\nKeep my exact prose.\n');assert.equal(parseDocument('profile',d.content).content,d.content);assert.match(compactBrief(d),/Exceptions/);assert(!compactBrief(d).includes('Keep my exact prose'));assert.throws(()=>parseDocument('profile',input.replace('name: General','name: General\nname: Other')),/duplicated/);
 assert.throws(()=>parseDocument('profile',input.replace('filters:', 'secrets: no\nfilters:')),/frontmatter/);
 assert.equal(parseDocument('rules','Never invent facts.').content,'Never invent facts.');
});
test('documents and generated edge codec stay in sync',()=>execFileSync(process.execPath,['scripts/build-search-documents.mjs','--check']));
test('new accounts have explicit gaps, no candidate/template facts, and optional source templates',()=>{
 const d=searchResponse('search.context',{documents:[],profile:null,tierLists:[]});assert.equal(d.execution,'personal-agent');assert.equal(d.configurationGaps.length,2);assert.equal(d.sourceTemplates.length,3);assert(!d.documents.length);
});
test('every hosted search tool maps to bounded gateway contract; no scanner runtime required',()=>{
 for(const tool of SEARCH_TOOLS)assert(TOOLS.some(t=>t.name===tool.name&&t.operation===tool.operation));
 assert.throws(()=>validateRequest({operation:'search.run.start',payload:{profileId:'general',eventKey:'run',userId:'forged'}}));
 assert.throws(()=>prepareSearch('search.document.save',{kind:'profile',id:'general',expectedVersion:0,eventKey:'e',content:'broken'}));
 assert.throws(()=>validateRequest({operation:'search.run.start',payload:{profileId:'general',days:-1,eventKey:'x'}}));
 const d=prepareSearch('search.document.save',{kind:'profile',id:'general',expectedVersion:0,eventKey:'e',content:profileDocument({id:'general',name:'General',active:true})});assert.match(d.content,/---/);
});
test('MCP discovers the hosted sweep workflow and dispatches an agent state operation',async()=>{
 const calls=[];const handler=createHandler(async(_token,op,p)=>{calls.push([op,p]);return {status:200,data:op==='credentials.verify'?{scopes:['workspace:read','drafts:write']}:{id:'run'}};});
 const call=async(method,params)=>{const r=await handler(new Request('http://localhost/mcp',{method:'POST',headers:{Authorization:'Bearer jb_agent_'+'a'.repeat(64),'Content-Type':'application/json',Accept:'application/json, text/event-stream'},body:JSON.stringify({jsonrpc:'2.0',id:1,method,params})}));return r.json();};
 const discovered=await call('tools/list',{});assert(discovered.result.tools.some(t=>t.name==='start_search_run'));assert(!discovered.result.tools.some(t=>t.name==='save_search_document'));
 const r=await call('tools/call',{name:'start_search_run',arguments:{profileId:'general',eventKey:'run'}});assert(!r.error);assert(calls.some(([op])=>op==='search.run.start'));
});
test('discovery guide resolves dependencies and explains interruption, uncertainty and vendor-independent execution',()=>{
 const g=readGuide('career-find-jobs');assert.equal(g.version,findToolkitSkill('find-jobs').version);assert(g.dependencies.tools.includes('save_search_discoveries'));for(const text of ['No local runner','resume','preferred','partial','source age','searchListingId'])assert(g.instructions.includes(text),text);
});
test('fictional search memory is resettable and contains no real accounts or execution',async()=>{
 const {searchDemo}=await import('../lib/search/demo.mjs');const a=searchDemo(),b=searchDemo();a.documents[0].content='edited';assert.notEqual(b.documents[0].content,'edited');assert.equal(b.runs[0].state,'partial');assert.equal(b.listings[0].screening.decision,'review-needed');assert.equal(b.listings[0].observation.employer_posted_at,null);assert(b.runs[0].sources.some(s=>s.coverage==='inaccessible'));
});
