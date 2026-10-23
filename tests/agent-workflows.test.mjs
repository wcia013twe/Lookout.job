import test from 'node:test';
import assert from 'node:assert/strict';
import {FIELD_UPDATE_TOOLS,validateFieldUpdate,buildUserBrief,readUserBrief} from '../lib/agent-workflows.mjs';
import {validateRequest} from '../supabase/functions/agent-gateway/contract.mjs';
import {TOOLS} from '../supabase/functions/agent-mcp/protocol.mjs';
import {createBackend} from '../backend/client.mjs';
const now=new Date('2026-10-23T12:00:00Z');
const bundle={settings:{cadence:'daily',timezone:'UTC',digestHour:9,digestDay:1,urgentDeadlineHours:24},lastDigestAt:now.toISOString(),deliveries:[],events:[{id:'event1',kind:'agent_note',occurred_at:now.toISOString(),payload:{text:'Saved an analysis, team scope still unknown.'}}],applications:[],plans:[]};
test('field tools are registered once and reject unknown ownership, authority and malformed fields',()=>{
 for(const t of FIELD_UPDATE_TOOLS)assert.equal(TOOLS.filter(x=>x.name===t.name).length,1);
 const p={id:'target',expectedRevision:2,fields:{research:'Agent assessment with a dated source and a gap.'}};
 assert.doesNotThrow(()=>validateRequest({operation:'company_workspaces.fields.update',payload:p}));
 for(const bad of [{...p,ownerId:'foreign'},{...p,fields:{approved:true}},{...p,fields:{}},{...p,expectedRevision:-1},{...p,fields:{research:null}}])assert.throws(()=>validateFieldUpdate('company_workspaces.fields.update',bad));
 assert.throws(()=>validateFieldUpdate('profile.fields.update',{expectedUpdatedAt:now.toISOString(),fields:{projects:[{owner:'foreign'}]}}));
 assert.equal(validateFieldUpdate('profile.fields.update',{expectedUpdatedAt:now.toISOString(),fields:{projects:[{name:'Query Lab'}]}}),true);
});
test('on-demand briefs remain useful during quiet time; notifications defer without acknowledgment',()=>{
 const explicit=buildUserBrief(bundle,null,{},now),notification=buildUserBrief(bundle,null,{mode:'notification'},now);
 assert.equal(explicit.status,'ready');assert.equal(explicit.items[0].evidence.type,'agent_observation');assert.equal(explicit.delivery.acknowledge,null);
 assert.equal(notification.status,'deferred');assert.deepEqual(notification.items,[]);assert.equal(notification.delivery.acknowledge,null);
 assert.equal(explicit.authority.nativeClientConfirmation,'not_implemented');
});
test('brief compression acknowledges only represented eligible events and treats urgent as length, not invented urgency',()=>{
 const b={...bundle,settings:{cadence:'immediate'},events:Array.from({length:5},(_,i)=>({id:'e'+i,kind:'note',payload:{text:'Saved note '+i}}))};
 const short=buildUserBrief(b,null,{mode:'notification'},now);
 assert.equal(short.items.length,3);assert.equal(short.coverage.omitted,2);assert.deepEqual(short.delivery.acknowledge.eventIds,['e0','e1','e2']);
 assert.equal(buildUserBrief(b,null,{style:'urgent'},now).items.length,1);
 assert.deepEqual(buildUserBrief(b,null,{style:'urgent'},now).delivery.urgentEventIds,[]);
 assert.equal(buildUserBrief(b,null,{style:'detailed'},now).items.length,5);
});
test('decision review wins over routine events without forging an approval',()=>{
 const b={...bundle,applications:[{id:'app',status:'Awaiting approval',revision:7}]};
 const brief=buildUserBrief(b,null,{mode:'notification'},now);
 assert.equal(brief.items[0].id,'decision:app:7');assert.equal(brief.items[0].confirmation.status,'human_review_required');
 assert.equal(brief.nextAction.tool,'read_application_record');assert.equal(brief.delivery.acknowledge.kind,'immediate');
});
test('brief reads use the same snapshot operation and surface failures instead of claiming no activity',async()=>{
 let called;
 const read=await readUserBrief(async(op,args)=>{called={op,args};return {data:{notifications:bundle,batch:null,sourceTruncated:true}};},{style:'short'},now);
 assert.equal(called.op,'brief.read');assert.equal(read.data.coverage.sourceTruncated,true);
 const failure={error:{code:'42501'}};assert.equal(await readUserBrief(async()=>failure),failure);
});
test('browser patch and briefing adapters share bounded RPCs and reject account switches',async()=>{
 for(const method of ['updateFields','readUserBrief']){
  let id='one',calls=[];
  const backend=createBackend({auth:{getUser:async()=>({data:{user:{id}}})},rpc:async(name,args)=>{calls.push({name,args});id='two';return {data:method==='readUserBrief'?{notifications:bundle,batch:null}:{record:{notes:'saved'}}};}},'one');
  await assert.rejects(method==='readUserBrief'?backend.readUserBrief():backend.updateFields('contacts.fields.update',{id:'contact',expectedRevision:1,fields:{notes:'saved'}}),/Account changed/);
  assert.equal(calls[0].args.expected_owner,'one');assert.equal(calls[0].name,method==='readUserBrief'?'read_user_brief_snapshot':'update_workspace_fields');
 }
});
