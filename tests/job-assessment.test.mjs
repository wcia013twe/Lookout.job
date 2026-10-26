import test from 'node:test';
import assert from 'node:assert/strict';
import {validateJobRecommendation,savedJobAssessment} from '../lib/job-assessment.mjs';
import {batchRoles} from '../lib/cloud-model.mjs';
import {companyRanking} from '../next-app/lib/role-display.js';
import {validateRequest} from '../supabase/functions/agent-gateway/contract.mjs';
import {createHandler} from '../supabase/functions/agent-mcp/protocol.mjs';
import {batchPackDrops} from '../lib/card-packs.mjs';
const assessment={percent:73,assessedAt:'2026-10-23T19:00:00Z',evidence:'Profile database project matches the official posting.',factors:[{label:'Database systems',value:73,rating:'Good',reason:'PostgreSQL project evidence.'},{label:'Team scope',value:null,rating:'Unknown',reason:'Not disclosed in the posting.'}]};
const rec={matchAssessment:assessment,materialGap:'Production ownership is not established.',sourceFreshness:'Observed today',priority:'Apply Now',searchProfileId:'systems'};
const batch={eventKey:'assessment-test',label:'Verified research',jobs:[{jobId:'role',recommendation:rec}]};
test('saved recommendations preserve role-specific evidence and unknown factors',()=>{
 const role=batchRoles([{job_id:'role',jobs:{employer:{company:'Example',sourceFreshness:'Old observation'}},recommendation:rec}],'2026-10-23')[0];
 assert.deepEqual(role.matchAssessment,assessment);assert.equal(role.materialGap,rec.materialGap);assert.equal(role.sourceFreshness,'Observed today');assert.equal(role.searchProfileId,'systems');
 const old=batchRoles([{job_id:'old',jobs:{employer:{sourceFreshness:'Observed over 72 hours ago'}}}],'2026-10-23')[0];
 assert.equal(old.sourceFreshness,'Observed over 72 hours ago');assert.equal(old.priority,'');assert.equal(old.matchAssessment,undefined);assert.equal(old.materialGap,'');
 assert.equal(batchRoles([{job_id:'empty',jobs:{employer:{}}}],'2026-10-23')[0].sourceFreshness,'Not recorded');
 assert.equal(savedJobAssessment({percent:90}),undefined);
});
test('gateway rejects unsupported scores, missing evidence and fabricated defaults',()=>{
 assert.doesNotThrow(()=>validateRequest({operation:'batches.publish',payload:batch}));
 for(const patch of [{percent:101},{percent:'73'},{evidence:''},{assessedAt:'yesterday'},{factors:[]},{factors:[{label:'Unknown',value:120,rating:'Good',reason:'Evidence'}]}])assert.throws(()=>validateJobRecommendation({...rec,matchAssessment:{...assessment,...patch}}));
 assert.throws(()=>validateJobRecommendation({...rec,priority:'Recommended'}));
 assert.throws(()=>validateJobRecommendation({...rec,materialGap:null}));
});
test('existing MCP publication carries the same validated recommendation contract',async()=>{
 const calls=[];const handler=createHandler(async(_token,operation,payload)=>{
  if(operation==='credentials.verify')return {status:200,data:{scopes:['batches:write']}};
  validateRequest({operation,payload});calls.push(payload);return {status:200,data:{saved:true}};
 });
 const response=await handler(new Request('http://local/mcp',{method:'POST',headers:{Authorization:'Bearer jb_agent_'+ 'a'.repeat(64),'Content-Type':'application/json',Accept:'application/json, text/event-stream'},body:JSON.stringify({jsonrpc:'2.0',id:1,method:'tools/call',params:{name:'publish_batch',arguments:batch}})}));
 const result=await response.json();assert.ok(result.result&&!result.result.isError,JSON.stringify(result));assert.deepEqual(calls[0].jobs[0].recommendation,rec);
});
test('rankings follow saved track/profile placements, never company name tables',()=>{
 const list=(id,type,tier)=>({id,employmentType:type,companies:[{id:'company',name:'Google'}],placements:{[tier]:['company']}});
 const workflow={tierLists:[list('full','FT','D'),list('intern','Internship','S')],searchPreferences:{profiles:[{id:'systems',active:true,instructions:'## Company priorities\n- Tier list ID: full'}]}};
 assert.deepEqual(companyRanking('Google','FT',workflow),{rarity:'common',label:'D tier'});
 assert.deepEqual(companyRanking('Google','Internship',workflow),{rarity:'mythic',label:'S tier'});
 assert.equal(companyRanking('Google','Internship',workflow,'systems').label,'D tier');
 assert.equal(companyRanking('NVIDIA','FT',workflow).label,'Unranked');
 assert.equal(companyRanking('Google','FT',workflow,'missing').label,'Unranked');
 workflow.tierLists[0].placements={A:['company']};assert.equal(companyRanking('Google','FT',workflow).rarity,'legendary');
 const drops=batchPackDrops([{id:'batch',batch_date:'2026-10-23'}],[{batch_id:'batch',recommendation:rec,jobs:{employer:{company:'Google'}}}]);assert.equal(drops[0].searchProfileId,'systems');
});

test('detached demo covers ranked and unranked cards through saved fictional placements',async()=>{
 const {demoFixtures}=await import('../next-app/lib/demo.mjs');
 const workflow=demoFixtures('2026-10-23').state.workflow;
 assert.equal(companyRanking('NVIDIA','FT',workflow).label,'A tier');
 assert.equal(companyRanking('Oracle','FT',workflow).label,'D tier');
 assert.equal(companyRanking('Unlisted demo company','FT',workflow).label,'Unranked');
});

test('compact four-score agent JSON survives the existing batch/card path without generating an overall score',()=>{
 const compact={assessedAt:'2026-10-26T18:00:00Z',skillsExperience:{score:82,reasoning:'Database project aligns; ownership needs verification.'},compensation:{score:null,reasoning:'Compensation is undisclosed.'},wellbeingCulture:{score:null,reasoning:'No reliable culture evidence.'},locationWorkSetting:{score:0,reasoning:'Does not match the recorded location preference.'}};
 assert.doesNotThrow(()=>validateRequest({operation:'batches.publish',payload:{...batch,jobs:[{jobId:'role',recommendation:{matchAssessment:compact}}]}}));
 const mapped=batchRoles([{job_id:'role',jobs:{employer:{company:'Example'}},recommendation:{matchAssessment:compact}}],'2026-10-26')[0];
 assert.deepEqual(mapped.matchAssessment,compact);assert.equal(mapped.matchAssessment.percent,undefined);
 const bads=[{...compact,skillsExperience:{score:101,reasoning:'Outside bounds.'}},{...compact,compensation:{score:'82',reasoning:'String score.'}},{...compact,compensation:{score:null,reasoning:'x'.repeat(241)}},{...compact,locationWorkSetting:undefined},{...compact,extra:{score:80,reasoning:'Unapproved dimension.'}},{...compact,assessedAt:'yesterday'},{...compact,compensation:{score:null,reasoning:'Missing evidence',rating:'Good'}}];
 for(const bad of bads)assert.throws(()=>validateJobRecommendation({matchAssessment:bad}));
 assert.equal(savedJobAssessment({...compact,compensation:{score:null,reasoning:''}}),undefined);
});
