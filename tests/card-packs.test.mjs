import test from 'node:test';
import assert from 'node:assert/strict';
import {validateAutomationSchedule,validateCardPacks,validatePackRecommendation,packAgentRequest,batchPackDrops} from '../lib/card-packs.mjs';
import {validateRequest} from '../supabase/functions/agent-gateway/contract.mjs';
import {TOOLS,createHandler} from '../supabase/functions/agent-mcp/protocol.mjs';
import {createBackend} from '../backend/client.mjs';
import {demoPack,demoPackTask,DEMO_PACK_ID} from '../next-app/lib/card-pack-demo.mjs';
import {dropKey} from '../next-app/lib/drop-pack.ts';
test('card packs validate bounded configuration without executable code or new permissions',()=>{
 assert.deepEqual(validateCardPacks([]),[]);assert.doesNotThrow(()=>validateCardPacks([demoPack]));
 for(const change of [{id:'other'},{html:'<script>bad()</script>'},{enabled:'true'},{title:''},{connectionIds:['secret-token']},{sourceIds:['https://wrong']},{taskId:''}])assert.throws(()=>validateCardPacks([{...demoPack,...change}]));
 assert.throws(()=>validateCardPacks([demoPack,demoPack]));
 assert.throws(()=>validateCardPacks(Array.from({length:9},()=>demoPack)));
 const theme={cardPacks:[demoPack],cardPacksVersion:1};
 assert.doesNotThrow(()=>validateRequest({operation:'preferences.theme.save',payload:{theme,expectedUpdatedAt:null}}));
 assert.throws(()=>validateRequest({operation:'preferences.theme.save',payload:{theme:{cardPacks:[demoPack]},expectedUpdatedAt:null}}));
});
test('agents configure and publish packs using existing scoped tools and structured recommendation data',async()=>{
 assert.equal(TOOLS.find(t=>t.name==='save_theme_preferences').scope,'preferences:write');assert.equal(TOOLS.find(t=>t.name==='publish_batch').scope,'batches:write');
 const calls=[];const handler=createHandler(async(_token,operation,payload)=>{calls.push(operation);if(operation==='credentials.verify')return {status:200,data:{scopes:['preferences:write','batches:write']}};validateRequest({operation,payload});return {status:200,data:{saved:true}};});
 for(const [name,args] of [['save_theme_preferences',{theme:{cardPacks:[demoPack],cardPacksVersion:1},expectedUpdatedAt:null}],['publish_batch',{eventKey:'pack-day',label:'Pack',jobs:[{jobId:'existing',recommendation:{cardPackId:demoPack.id,sourceId:'demo-social',note:'Agent assessment'}}]}]]){
  const response=await handler(new Request('http://local/mcp',{method:'POST',headers:{Authorization:'Bearer jb_agent_'+ 'a'.repeat(64),'Content-Type':'application/json',Accept:'application/json, text/event-stream'},body:JSON.stringify({jsonrpc:'2.0',id:1,method:'tools/call',params:{name,arguments:args}})}));
  const body=await response.json();assert.ok(body.result&&!body.result.isError,JSON.stringify(body));
 }
 assert.ok(calls.includes('preferences.theme.save'));assert.ok(calls.includes('batches.publish'));
 assert.throws(()=>validatePackRecommendation({cardPackId:demoPack.id}));
 assert.throws(()=>validatePackRecommendation({cardPackId:demoPack.id,sourceId:'demo-social',dropStatus:'applied'}));
 assert.match(packAgentRequest(demoPack),/does not activate a schedule/);
});
test('batch cards reuse canonical jobs and private notes without borrowing another pack reveal state',()=>{
 const cards=batchPackDrops([{id:'batch',batch_date:'2026-10-23'}],[{batch_id:'batch',recommendation:{note:'Private fit',dropStatus:'pending'},jobs:{id:'job',canonical_url:'https://example.com/job',employer:{company:'Example',title:'Engineer',employmentType:'FT'}}}]);
 assert.equal(cards[0].note,'Private fit');assert.equal(cards[0].url,'https://example.com/job');assert.equal(cards[0].dateSeen,'2026-10-23');
 assert.notEqual(dropKey({...cards[0],packId:DEMO_PACK_ID}),dropKey({...cards[0],packId:'other'}));
});
test('pack settings and saves reject account switches after the API response',async()=>{
 let id='one';const query={select(){return this},eq(){return this},async maybeSingle(){id='two';return {data:{theme:{cardPacks:[]},search:{}}};}};
 const client={auth:{getUser:async()=>({data:{user:{id}}})},from:()=>query,rpc:async()=>{id='two';return {data:{theme:{}}};}};
 await assert.rejects(createBackend(client,'one').readCardPackSettings(),/Account changed/);
 id='one';await assert.rejects(createBackend(client,'one').performPlatformAction('preferences.theme.save',{theme:{pack:'solar'},expectedUpdatedAt:null}),/Account changed/);
});

test('automation tasks keep source assignments in one versioned definition and permit on-demand runs',()=>{
 const schedule={enabled:false,timezone:'UTC',routines:[demoPackTask],configVersion:1};
 assert.doesNotThrow(()=>validateAutomationSchedule(schedule));
 for(const change of [{routines:[{...demoPackTask,mode:'scheduled',time:''}]},{routines:[{...demoPackTask,connectionIds:undefined}]},{routines:[demoPackTask,demoPackTask]},{timezone:'not-a-zone'},{configVersion:0}])assert.throws(()=>validateAutomationSchedule({...schedule,...change}));
 assert.doesNotThrow(()=>validateRequest({operation:'preferences.notifications.save',payload:{settings:{schedule},expectedUpdatedAt:null}}));
});
