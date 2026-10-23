import test from 'node:test';
import assert from 'node:assert/strict';
import {createPackTask,savePackWithTask,PACK_DISCOVERY_PROMPT} from '../lib/card-pack-setup.mjs';
import {validateRequest} from '../supabase/functions/agent-gateway/contract.mjs';
import {createHandler} from '../supabase/functions/agent-mcp/protocol.mjs';
import {demoPack,demoPackTask,demoPackConnections} from '../lib/card-pack-demo.mjs';

const task=createPackTask({packId:demoPack.id,title:'Infrastructure',sources:[{id:'demo-social'}],connections:demoPackConnections});
const pack={...demoPack,title:'Infrastructure',taskId:task.id};
const initial=()=>({theme:{pack:'solar',cardPacks:[],cardPacksVersion:1},schedule:{enabled:false,timezone:'America/New_York',configVersion:2,routines:[structuredClone(demoPackTask)]},updatedAt:'2026-10-23T01:00:00Z'});
function harness(value=initial()) {
 let current=structuredClone(value),writes=[];
 return {readSettings:async()=>structuredClone(current),get:()=>current,writes,
  performAction:async(operation,payload)=>{
   validateRequest({operation,payload});
   assert.equal(payload.expectedUpdatedAt,current.updatedAt,'Every write uses the latest preference timestamp');
   writes.push(operation);
   current.updatedAt=new Date(Date.parse(current.updatedAt)+1000).toISOString();
   if(operation==='preferences.notifications.save') {current.schedule=structuredClone(payload.settings.schedule);return {search:{schedule:current.schedule},updated_at:current.updatedAt};}
   current.theme=structuredClone(payload.theme);return {theme:current.theme,updated_at:current.updatedAt};
  }};
}
const args=h=>({...h,pack,task,expectedPackVersion:1});
test('new packs prefill a bounded discovery task using only active publishing connections',()=>{
 const result=createPackTask({packId:pack.id,title:pack.title,sources:Array.from({length:10},(_,i)=>({id:'s'+i})),connections:[...demoPackConnections,{...demoPackConnections[0],id:'expired',expires_at:'2000-01-01'},{...demoPackConnections[0],id:'revoked',revoked_at:'2020-01-01'},{...demoPackConnections[0],id:'read-only',scopes:['workspace:read']}]});
 assert.equal(result.mode,'scheduled');assert.equal(result.time,'09:00');assert.equal(result.description,PACK_DISCOVERY_PROMPT);
 assert.equal(result.sourceIds.length,8);assert.deepEqual(result.connectionIds,[demoPackConnections[0].id]);assert.equal(result.id,task.id);
 assert.deepEqual(createPackTask({packId:pack.id,title:'Empty'}).sourceIds,[]);
});
test('one save appends the linked task and preserves existing routines, pauses, timezone and theme',async()=>{
 const h=harness();await savePackWithTask(args(h));
 assert.deepEqual(h.writes,['preferences.notifications.save','preferences.theme.save']);
 assert.equal(h.get().schedule.routines.length,2);assert.deepEqual(h.get().schedule.routines[0],demoPackTask);
 assert.equal(h.get().schedule.enabled,false);assert.equal(h.get().schedule.timezone,'America/New_York');
 assert.equal(h.get().theme.pack,'solar');assert.equal(h.get().theme.cardPacks[0].taskId,h.get().schedule.routines[1].id);
});
test('an interrupted pack save retries without duplicating its saved task',async()=>{
 const h=harness();let notified=0;
 await assert.rejects(savePackWithTask({...args(h),onTaskSaved:()=>notified++,performAction:(op,payload)=>op==='preferences.theme.save'?Promise.reject(Error('offline')):h.performAction(op,payload)}),/offline/);
 assert.equal(notified,1);assert.equal(h.get().schedule.routines.length,2);assert.equal(h.get().theme.cardPacks.length,0);
 await savePackWithTask(args(h));assert.equal(h.get().schedule.routines.length,2);assert.equal(h.get().theme.cardPacks.length,1);
 assert.equal(h.writes.filter(op=>op==='preferences.notifications.save').length,1);
});
test('lost success responses reconcile stable task and pack IDs',async()=>{
 for(const failingOp of ['preferences.notifications.save','preferences.theme.save']){
  const h=harness();
  await assert.rejects(savePackWithTask({...args(h),performAction:async(op,payload)=>{const result=await h.performAction(op,payload);if(op===failingOp)throw Error('response lost');return result;}}),/response lost/);
  await savePackWithTask(args(h));
  assert.equal(h.get().schedule.routines.length,2);assert.equal(h.get().theme.cardPacks.length,1);
  assert.equal(h.writes.filter(op=>op==='preferences.notifications.save').length,1);
 }
});
test('conflicts and capacity failures stop without overwriting tasks or creating orphan work',async()=>{
 const changed=initial();changed.theme.cardPacksVersion=2;
 const h=harness(changed);await assert.rejects(savePackWithTask(args(h)),/Pack settings changed/);assert.equal(h.writes.length,0);
 const conflict=initial();conflict.schedule.routines.push({...task,description:'Changed elsewhere'});
 const c=harness(conflict);await assert.rejects(savePackWithTask(args(c)),/task changed/);assert.equal(c.writes.length,0);
 const full=initial();full.schedule.routines=Array.from({length:30},(_,i)=>({...demoPackTask,id:'task-'+i}));
 const f=harness(full);await assert.rejects(savePackWithTask(args(f)),/30/);assert.equal(f.writes.length,0);
});
test('first pack preserves default routines when no schedule exists',async()=>{
 const state=initial();state.schedule=null;const h=harness(state);
 await savePackWithTask({...args(h),timezone:'UTC'});assert.equal(h.get().schedule.routines.length,5);
 assert.equal(h.get().schedule.configVersion,1);assert.equal(h.get().schedule.timezone,'UTC');
});
test('the same linked setup uses the existing scoped MCP task and pack tools',async()=>{
 const h=harness(),operations=[];
 const handler=createHandler(async(_token,operation,payload)=>{
  if(operation==='credentials.verify')return {status:200,data:{scopes:['preferences:write']}};
  operations.push(operation);return {status:200,data:await h.performAction(operation,payload)};
 });
 await savePackWithTask({...args(h),performAction:async(operation,payload)=>{
  const name=operation==='preferences.notifications.save'?'save_notification_preferences':'save_theme_preferences';
  const response=await handler(new Request('http://local/mcp',{method:'POST',headers:{Authorization:'Bearer jb_agent_'+'a'.repeat(64),'Content-Type':'application/json',Accept:'application/json, text/event-stream'},body:JSON.stringify({jsonrpc:'2.0',id:1,method:'tools/call',params:{name,arguments:payload}})}));
  const body=await response.json();assert.ok(body.result&&!body.result.isError,JSON.stringify(body));
  return operation==='preferences.notifications.save'?{search:{schedule:h.get().schedule},updated_at:h.get().updatedAt}:{theme:h.get().theme,updated_at:h.get().updatedAt};
 }});
 assert.deepEqual(operations,['preferences.notifications.save','preferences.theme.save']);
});
