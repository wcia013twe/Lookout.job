// Read-only live provider smoke check through the real batch executor.
// Fictional memory dispatch: no account, queue, backend writes or applications.
import assert from 'node:assert/strict';
import {executeSearch} from '../backend/runtime/worker.ts';
import {writeFile} from 'node:fs/promises';
const context={personalVersion:1,documents:[{kind:'profile',id:'smoke',version:1,projection:{filters:{Employment:'Full-time',Location:'United States','Experience level':'Entry-level'}}}]};
const source={source_id:'portal:hiringcafe-smoke',source:{name:'HiringCafe',careers_url:'https://hiringcafe.com/',keywords:['backend engineer']},version:0,state:'pending'};
const run={id:'fictional-memory-run',profile_id:'smoke',state:'active',days:1,version:0,sources:[source]},listings=[],operations=[];
const dispatch=async(operation,payload)=>{
 operations.push(operation);
 if(operation==='search.run.start'||operation==='search.run.read')return structuredClone(run);
 if(operation==='search.context')return context;
 if(operation==='search.discoveries.read')return {listings,nextOffset:null};
 if(operation==='search.discoveries.save'){listings.push(...payload.listings.map((row,index)=>({...row,id:'smoke-'+index,canonical_url:row.url,observation:{id:'smoke-observation-'+index,description:row.description,employer_posted_at:row.employerPostedAt}})));return {};}
 if(operation==='search.progress'){Object.assign(source,payload);run.version++;return {};}
 if(operation==='search.screenings.read')return null;
 if(operation==='search.screenings.commit')return {screenings:payload.screenings,evaluatedProfileVersion:1,personalVersion:1};
 if(operation==='search.run.finish'){run.state=payload.state;return {};}
 throw Error('Unexpected smoke operation '+operation);
};
let apiSearchCalls=0;
const request=async(url,init)=>{if(String(url)==='https://hiringcafe.com/api/chatgpt/mcp'&&JSON.parse(init.body).params.name==='search_hiringcafe_jobs')apiSearchCalls++;return fetch(url,init);};
const outcome=await executeSearch({id:'fictional-memory-job',kind:'search_ats',input:{profileId:'smoke'},version:1,attempts:1},dispatch,{request});
assert.equal(apiSearchCalls,1);assert(outcome.result.provenance.some(p=>p.aggregate==='HiringCafe public MCP'),'HiringCafe search must succeed, not merely return an inaccessible source');assert(operations.includes('search.progress'));assert(outcome.result.shortlist);
const proof={checkedAt:new Date().toISOString(),liveProvider:true,persistence:'fictional memory only; no private-account or queue writes',apiSearchCalls,status:outcome.status,observed:outcome.result.observed,saved:outcome.result.saved,shortlist:outcome.result.shortlist,provenance:outcome.result.provenance,sourceCoverage:source.coverage,sourceBlocker:source.blocker,diagnostics:source.checkpoint.diagnostics};
if(process.argv[2])await writeFile(process.argv[2],JSON.stringify(proof,null,2)+'\n');
console.log(JSON.stringify(proof,null,2));
