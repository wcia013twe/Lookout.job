import test from 'node:test';
import assert from 'node:assert/strict';
import {createBackend} from '../backend/client.mjs';
import {actionBoardMessageFields} from '../lib/action-board.mjs';

function fixture(){
 const row={id:'contact',user_id:'owner',revision:4,record:{contact:'Fictional person',message:'Old draft',subject:'Old subject',status:'Not asked',notes:'Keep history',unknownField:{keep:true}}};
 let rpc;
 const client={auth:{getUser:async()=>({data:{user:{id:'owner'}}})},from(table){assert.equal(table,'outreach_contacts');const filters={};return {select(){return this;},eq(key,value){filters[key]=value;return this;},async single(){assert.deepEqual(filters,{user_id:'owner',id:'contact'});return {data:structuredClone(row)};}};},async rpc(name,payload){rpc={name,payload};return {data:{revision:5}};}};
 return {row,client,api:createBackend(client,'owner'),get rpc(){return rpc;}};
}
test('board message edits preserve full contact history and use the existing owned revision writer',async()=>{
 const f=fixture();await f.api.saveActionBoardMessage({id:'contact',expectedRevision:4,subject:'New subject',message:'New draft'});
 assert.equal(f.rpc.name,'save_outreach_contact');assert.equal(f.rpc.payload.p_expected_owner,'owner');assert.equal(f.rpc.payload.p_expected_revision,4);
 assert.deepEqual(f.rpc.payload.p_record,{...f.row.record,subject:'New subject',message:'New draft'});
 assert.equal(f.rpc.payload.p_deleted,false);
});
test('stale, deleted, wrong-account and invalid message edits cannot reach the writer',async()=>{
 for(const patch of [{revision:5},{deleted_at:'2026-11-07'}]){
  const f=fixture();Object.assign(f.row,patch);await assert.rejects(f.api.saveActionBoardMessage({id:'contact',expectedRevision:4,subject:'',message:'New draft'}),/changed/);assert.equal(f.rpc,undefined);
 }
 const switched=fixture();switched.client.auth.getUser=async()=>({data:{user:{id:'other'}}});
 await assert.rejects(switched.api.saveActionBoardMessage({id:'contact',expectedRevision:4,subject:'',message:'Draft'}),/Account changed/);assert.equal(switched.rpc,undefined);
 for(const fields of [{subject:'',message:' '},{subject:'x'.repeat(501),message:'Draft'},{subject:'',message:'x'.repeat(10001)}])assert.throws(()=>actionBoardMessageFields(fields));
 assert.deepEqual(actionBoardMessageFields({subject:'',message:'Draft'}),{subject:'',message:'Draft'});
});
test('saving a changed detached draft invalidates exact review without sending and fences stale edits',async()=>{
 const {demoFixtures,createMemoryStore,createDemoServices}=await import('../next-app/lib/demo.mjs');
 const {withActionBoardDemo}=await import('../next-app/lib/action-board-demo.mjs');
 const store=createMemoryStore(demoFixtures('2026-11-07').state),api=withActionBoardDemo(createDemoServices(store),store);
 const item=(await api.readActionBoard()).items.find(i=>i.kind==='review_outreach');
 await api.respondActionBoard({key:item.key,response:'review',eventKey:crypto.randomUUID()});
 const before=structuredClone(store.get('network.referrals').find(c=>c.id===item.sourceId));
 await api.saveActionBoardMessage({id:item.sourceId,expectedRevision:Number(item.version),subject:'Revised',message:'A changed fictional message.'});
 const edited=(await api.readActionBoard()).items.find(i=>i.sourceId===item.sourceId);
 assert.notEqual(edited.key,item.key);assert.equal(edited.reviewed,false);
 const saved=store.get('network.referrals').find(c=>c.id===item.sourceId);assert.equal(saved.status,before.status);assert.equal(saved.notes,before.notes);
 await assert.rejects(api.respondActionBoard({key:edited.key,response:'accept',eventKey:crypto.randomUUID()}),/Review/);
 await assert.rejects(api.saveActionBoardMessage({id:item.sourceId,expectedRevision:Number(item.version),subject:'',message:'Stale overwrite'}),/changed/);
});
