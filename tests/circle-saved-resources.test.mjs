import test from 'node:test';
import assert from 'node:assert/strict';
import {createTestDatabase} from './helpers/database.mjs';
import {createCircleKnowledgeDemo} from '../lib/circle-knowledge-demo.mjs';
import {validateRequest} from '../supabase/functions/agent-gateway/contract.mjs';

test('saved resource is private, durable, scoped and requires current membership',async()=>{
 const db=await createTestDatabase(),owner='11111111-1111-1111-1111-111111111111',peer='22222222-2222-2222-2222-222222222222',outsider='33333333-3333-3333-3333-333333333333',hash='c'.repeat(64);let n=0;
 async function human(user,op,payload={}){await db.query("select set_config('test.uid',$1,false)",[user]);await db.exec('set role authenticated');try{return (await db.query('select public.knowledge_action($1,$2::jsonb) result',[op,JSON.stringify(payload)])).rows[0].result;}finally{await db.exec('reset role');}}
 const write=(user,op,payload)=>human(user,op,{...payload,eventKey:`saved-${++n}`});
 const agent=async(op,payload)=>(await db.query('select public.agent_dispatch($1,$2,$3::jsonb) result',[hash,op,JSON.stringify(payload)])).rows[0].result;
 try{
  await db.exec('update private.knowledge_config set enabled=true');
  const {circleId}=await write(owner,'circles.create',{name:'Resources',alias:'Owner'}),invite=await write(owner,'circles.invite',{circleId});await write(peer,'circles.join',{token:invite.token,alias:'Peer'});
  const content={title:'Resource',body:'Useful notes',type:'resource',sources:[],provenance:'user_confirmed',personalDisclosure:false};
  const {postId}=await write(owner,'knowledge.propose',{circleId,expectedRevision:0,content});
  const payload={circleId,postId,saved:true,expectedSaved:false,eventKey:'bookmark'};
  await assert.rejects(()=>human(owner,'knowledge.save_resource',payload),/unavailable/i);
  await write(owner,'knowledge.publish',{circleId,postId,expectedRevision:1});
  await db.query("insert into private.agent_connections(user_id,name,token_hash,scopes,expires_at) values($1,'agent',$2,array['knowledge:read','knowledge:write'],now()+interval '1 day')",[peer,hash]);
  validateRequest({operation:'knowledge.save_resource',payload});
  assert.deepEqual(await agent('knowledge.save_resource',payload),{saved:true});assert.deepEqual(await agent('knowledge.save_resource',payload),{saved:true});
  assert.equal((await human(peer,'knowledge.read',{circleId,postId})).post.saved,true);assert.equal((await human(owner,'knowledge.read',{circleId,postId})).post.saved,false);
  await assert.rejects(()=>human(outsider,'knowledge.save_resource',{...payload,eventKey:'outsider'}),/unavailable/i);
  await assert.rejects(()=>write(peer,'knowledge.save_resource',{...payload,saved:false,expectedSaved:false}),/changed/i);
  await write(peer,'knowledge.save_resource',{circleId,postId,saved:false,expectedSaved:true});assert.equal((await agent('knowledge.read',{circleId,postId})).post.saved,false);
  await write(peer,'knowledge.save_resource',{circleId,postId,saved:true,expectedSaved:false});await write(owner,'circles.remove',{circleId,memberId:peer});
  await assert.rejects(()=>agent('knowledge.read',{circleId,postId}),/unavailable/i);await assert.rejects(()=>agent('knowledge.save_resource',{...payload,eventKey:'removed'}),/unavailable/i);
 }finally{await db.close();}
});
test('demo saved resources are resettable and isolated',()=>{
 const a=createCircleKnowledgeDemo(),b=createCircleKnowledgeDemo(),circleId='demo-circle',postId='demo-general-resource';
 a.action('knowledge.save_resource',{circleId,postId,saved:true,expectedSaved:false,eventKey:'save'});
 assert.equal(a.action('knowledge.read',{circleId,postId}).post.saved,true);assert.equal(b.action('knowledge.read',{circleId,postId}).post.saved,false);
 a.action('knowledge.save_resource',{circleId,postId,saved:false,expectedSaved:true,eventKey:'remove'});assert.equal(a.action('knowledge.read',{circleId,postId}).post.saved,false);
});
