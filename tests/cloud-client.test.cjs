const {test}=require('node:test');const assert=require('node:assert/strict');
test('workspace history pagination reads beyond 200 applications with stable order',async()=>{
 const {createBackend}=await import('../backend/client.mjs');const calls=[];
 const client={auth:{getUser:async()=>({data:{user:{id:'owner'}}})},from(table){let first=0,last=0;const query={select(){return query;},eq(key,value){assert.equal(key,'user_id');assert.equal(value,'owner');return query;},order(key){assert.equal(key,['profiles','preferences'].includes(table)?'user_id':'id');return query;},range(start,end){first=start;last=end;calls.push({table,start,end});return query;},then(resolve){const size=table==='applications'?425:0;return Promise.resolve({data:Array.from({length:Math.max(0,Math.min(last+1,size)-first)},(_,i)=>({id:String(first+i)}))}).then(resolve);}};return query;}};
 const rows=await createBackend(client,'owner').loadWorkspace();assert.equal(rows.applications.length,425);assert.deepEqual(calls.filter(call=>call.table==='applications').map(call=>call.start),[0,200,400]);
});
test('draft inserts and approval reject the wrong signed-in account before requests',async()=>{
 const {createBackend}=await import('../backend/client.mjs');let requested=false;
 const client={auth:{getUser:async()=>({data:{user:{id:'other'}}})},from(){requested=true;throw Error('Should not query');},rpc(){requested=true;}};
 const backend=createBackend(client,'expected');await assert.rejects(backend.createDraft('job',{}),/Account changed/);await assert.rejects(backend.approve('app',0),/Account changed/);assert.equal(requested,false);
});
test('autosync adopts an uploaded immutable resume and rejects reused IDs with different files',async()=>{
 const {createBackend}=await import('../backend/client.mjs');let inserts=0;
 const row={id:'resume',user_id:'owner',version:1,object_path:'owner/resume.pdf',reference_url:null,content_hash:'hash'};
 const client={auth:{getUser:async()=>({data:{user:{id:'owner'}}})},from(){const query={select(){return query;},eq(){return query;},maybeSingle(){return Promise.resolve({data:row});},insert(){inserts++;return query;}};return query;}};
 const backend=createBackend(client,'owner');const adopted=await backend.createResume({id:'resume',version:1,object_path:'owner/resume.pdf',content_hash:'hash'});assert.equal(adopted,row);assert.equal(inserts,0);
 await assert.rejects(backend.createResume({id:'resume',version:1,object_path:'owner/different.pdf',content_hash:'hash'}),/different version/);assert.equal(inserts,0);
});
test('planner adapters reject responses after account switches and use narrow owned RPCs',async()=>{
 const {createBackend}=await import('../backend/client.mjs');
 for(const [method,args,rpcName] of [['readPreparationPlanner',[],'read_preparation_planner'],['savePreparationBudget',[15,2],'save_preparation_budget'],['completePreparationSession',[{sessionId:'session',minutes:15,targets:[{applicationId:'application',taskId:'task',expectedVersion:1}]}],'complete_preparation_session']]){
  let owner='one';const calls=[];
  const backend=createBackend({auth:{getUser:async()=>({data:{user:{id:owner}}})},rpc:async(name,payload)=>{calls.push({name,payload});owner='two';return{data:{private:'one'}};}},'one');
  await assert.rejects(backend[method](...args),/Account changed/);assert.equal(calls.length,1);assert.equal(calls[0].name,rpcName);assert.equal(JSON.stringify(calls).includes('user_id'),false);
 }
});
