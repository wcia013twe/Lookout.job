// Hosted release verification using disposable fictional accounts only.
// Prepare prints SQL containing hashes, never credentials; fixture secrets are
// mode-0600 and must live outside the checkout. Cleanup SQL removes only these users.
import assert from 'node:assert/strict';
import {randomBytes,randomUUID,createHash} from 'node:crypto';
import {readFile,writeFile,unlink,stat} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const endpoint='https://umhqfqzpwmszhcknwtrs.supabase.co/functions/v1/agent-mcp';
const [phase,file]=process.argv.slice(2);
if(!file || resolve(file).startsWith(resolve(fileURLToPath(new URL('..',import.meta.url))))) throw Error('Provide a temporary fixture path outside the checkout.');
const token=()=>`jb_agent_${randomBytes(32).toString('hex')}`;
const hash=value=>createHash('sha256').update(value).digest('hex');
if(phase==='prepare') {
  const fixture={kind:'lookout-search-release-fixture',primary:{id:randomUUID(),token:token()},reader:{id:randomUUID(),token:token()},other:{id:randomUUID(),token:token()}};
  await writeFile(file,JSON.stringify(fixture),{mode:0o600,flag:'wx'});
  const all=[fixture.primary,fixture.reader,fixture.other];
  const seedSQL=`begin; insert into auth.users(id) values ${all.map(c=>`('${c.id}')`).join(',')}; insert into private.agent_connections(user_id,name,token_hash,scopes,expires_at) values ${all.map(c=>`('${c.id}','Lookout search release smoke','${hash(c.token)}',array[${(c===fixture.reader?['workspace:read']:['workspace:read','profile:write','preferences:write','drafts:write','batches:write','activity:write','resumes:read','approvals:read']).map(s=>`'${s}'`).join(',')}],now()+interval '1 hour')`).join(',')}; commit;`;
  console.log(JSON.stringify({seedSQL}));
  process.exit(0);
}
if((await stat(file)).mode&0o077)throw Error('Fixture secrets must be private (0600).');
const fixture=JSON.parse(await readFile(file,'utf8'));
assert.equal(fixture.kind,'lookout-search-release-fixture');
for(const c of [fixture.primary,fixture.reader,fixture.other])assert.match(c.id,/^[a-f0-9-]{36}$/);
if(phase==='cleanup-sql') {
  console.log(`begin; delete from auth.users u where u.id in (${[fixture.primary,fixture.reader,fixture.other].map(c=>`'${c.id}'`).join(',')}) and exists(select 1 from private.agent_connections c where c.user_id=u.id and c.name='Lookout search release smoke'); commit;`);
  process.exit(0);
}
if(phase==='revoke-sql') {
  console.log(`update private.agent_connections set revoked_at=now() where user_id='${fixture.primary.id}' and name='Lookout search release smoke';`);
  process.exit(0);
}
if(phase==='erase') {await unlink(file);console.log('Temporary credentials erased.');process.exit(0);}
function client(credential) {
  let id=0;
  async function request(method,params) {
    const response=await fetch(endpoint,{method:'POST',headers:{Authorization:`Bearer ${credential}`,'Content-Type':'application/json',Accept:'application/json, text/event-stream','MCP-Protocol-Version':'2025-06-18'},body:JSON.stringify({jsonrpc:'2.0',id:++id,method,params}),signal:AbortSignal.timeout(30000)});
    const json=await response.json();
    return {status:response.status,...json};
  }
  return {
    request,
    async tools(){const r=await request('tools/list',{});assert.equal(r.status,200);assert(!r.error);return r.result.tools;},
    async call(name,args={}){const r=await request('tools/call',{name,arguments:args});assert.equal(r.status,200,`${name}: HTTP failure`);assert(!r.error,`${name}: RPC rejection`);assert(!r.result.isError,`${name}: tool rejected request`);return JSON.parse(r.result.content[0].text);},
    async denied(name,args={}){const r=await request('tools/call',{name,arguments:args});assert(r.status!==200 || r.error || r.result?.isError,`${name}: expected denial`);},
  };
}
const agent=client(fixture.primary.token),reader=client(fixture.reader.token),other=client(fixture.other.token);
if(phase==='revoked') {
  assert.equal((await agent.request('tools/list',{})).status,401);
  console.log('PASS revoked credential cannot discover tools.');
  process.exit(0);
}
assert.equal(phase,'run','Use prepare/run/revoke-sql/revoked/cleanup-sql/erase.');
const initialized=await agent.request('initialize',{protocolVersion:'2025-06-18',capabilities:{},clientInfo:{name:'lookout-isolated-release-smoke',version:'1'}});
assert.equal(initialized.status,200);assert(!initialized.error);
const tools=await agent.tools();
for(const name of ['read_search_context','save_search_document','start_search_run','record_search_progress','save_search_discoveries','save_search_screening','finish_search_run','read_agent_tasks','claim_agent_task','report_agent_task_result','save_profile_package'])assert(tools.some(t=>t.name===name),`Missing ${name}`);
assert(!(await reader.tools()).some(t=>t.name==='start_search_run'));
await reader.denied('start_search_run',{profileId:'release-test',eventKey:'forbidden'});
console.log('PASS hosted initialize, discovery and read-only scope isolation.');
const developer=await agent.call('read_developer_context');assert(developer.developerVersion>=14);
assert(developer.capabilities.agentSearchSweeps);assert(developer.guides.some(g=>g.id==='career-find-jobs'));
const guide=await agent.call('read_guide',{id:'career-find-jobs'});assert.equal(guide.id,'career-find-jobs');
const personal=await agent.call('read_personal_context');
await agent.call('save_profile_package',{eventKey:'release-profile',expectedPersonalVersion:personal.personalVersion,facts:{name:'Fictional Lookout release test'},source:'Isolated release fixture; not a real candidate.'});
const workspace=await agent.call('workspace_read');assert.equal(workspace.profile.facts.name,'Fictional Lookout release test');assert.equal(workspace.profile.verified_at,null);
console.log('PASS versioned developer guide and legacy unverified profile import.');
const profileId='release-test';
const header={id:profileId,name:'Release check (fictional)',active:true,filters:{},priorities:{}};
await agent.call('save_search_document',{kind:'profile',id:profileId,expectedVersion:0,eventKey:'release-targeting',content:`---\n${JSON.stringify(header)}\n---\nFictional release test. No real job recommendation or submission.`});
const portals={tracked_companies:[{id:'fixture',name:'Fictional test source',kind:'careers',careers_url:'https://example.com/careers',enabled:true}],search_queries:['fictional release verification']};
await agent.call('save_search_document',{kind:'portals',id:'shared',expectedVersion:0,eventKey:'release-portals',content:JSON.stringify(portals)});
const context=await agent.call('read_search_context',{profileId});assert.equal(context.execution,'personal-agent');assert.equal(context.configurationGaps.length,0);
const start={profileId,mode:'fresh',eventKey:'release-run'};
const run=await agent.call('start_search_run',start);assert.equal(run.sources.length,2);
assert.deepEqual(await agent.call('start_search_run',start),run);
await other.denied('read_search_run',{runId:run.id});
console.log('PASS context documents, run start, retry deduplication and owner isolation.');
const discovery={runId:run.id,eventKey:'release-discovery',listings:[{sourceId:'portal:fixture',url:'https://example.com/jobs/fictional-release-test',company:'Fictional release employer',title:'Fictional release role',location:null,checkedAt:new Date().toISOString(),liveness:'uncertain',evidence:'Fictional integration fixture, not an observed employer posting.',employerPostedAt:null,sourceListAgeDays:null,description:'Fictional test data. No candidate suitability is claimed.'}]};
const saved=await agent.call('save_search_discoveries',discovery);assert.deepEqual(await agent.call('save_search_discoveries',discovery),saved);
let found=await agent.call('read_search_discoveries',{runId:run.id});assert.equal(found.listings.length,1);assert.equal(found.listings[0].observationCount,1);assert.equal(found.listings[0].observation.employer_posted_at,null);
await agent.denied('save_search_screening',{runId:run.id,listingId:found.listings[0].id,expectedVersion:0,eventKey:'release-invalid-eligible',decision:'eligible',checks:[{requirement:'experience',status:'unknown',evidence:'No real eligibility established.'}],explanation:'Fictional fixture.'});
await agent.call('save_search_screening',{runId:run.id,listingId:found.listings[0].id,expectedVersion:0,eventKey:'release-screening',decision:'review-needed',checks:[{requirement:'experience',status:'unknown',evidence:'No real eligibility established.'}],explanation:'Fictional fixture; unknown evidence stays unresolved.'});
await agent.call('record_search_progress',{runId:run.id,sourceId:'portal:fixture',expectedVersion:0,eventKey:'release-checkpoint',state:'blocked',checkpoint:{page:1},counts:{found:1},coverage:'inaccessible',blocker:'Simulated blocked source for release verification.'});
const reconnected=client(fixture.primary.token);
let resumed=await reconnected.call('read_search_run',{runId:run.id});assert.equal(resumed.sources.find(s=>s.source_id==='portal:fixture').checkpoint.page,1);
await reconnected.call('record_search_progress',{runId:run.id,sourceId:'query:1',expectedVersion:0,eventKey:'release-query',state:'completed',checkpoint:{complete:true},counts:{found:0},coverage:'exhaustive'});
resumed=await reconnected.call('read_search_run',{runId:run.id});
await reconnected.denied('finish_search_run',{runId:run.id,expectedVersion:resumed.version,eventKey:'release-false-complete',state:'completed',summary:'Cannot complete blocked coverage.'});
const finished=await reconnected.call('finish_search_run',{runId:run.id,expectedVersion:resumed.version,eventKey:'release-finish',state:'partial',summary:'Fictional integration check; one simulated blocked source, no applications.'});assert.equal(finished.state,'partial');
console.log('PASS discoveries, unknown dates, screening guards, checkpoint resume and partial completion.');
const task=await agent.call('request_search_sweep',{profileId,eventKey:'release-task',mode:'fresh'});
const claim=await agent.call('claim_agent_task',{taskId:task.id});
const reported=await agent.call('report_agent_task_result',{taskId:task.id,claimToken:claim.claim_token,expectedRevision:claim.revision,state:'completed',result:{searchRunId:run.id,summary:'Finished fictional release check.'}});assert.equal(reported.state,'completed');
const after=await agent.call('workspace_read');assert.equal(after.applications.length,0);
console.log('PASS queued request, agent claim and evidence-linked completion; no applications created.');
