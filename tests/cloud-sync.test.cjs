const {test,beforeEach,afterEach}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const one='11111111-1111-4111-8111-111111111111',two='22222222-2222-4222-8222-222222222222';
const clone=value=>JSON.parse(JSON.stringify(value));
function deferred(){let resolve;const promise=new Promise(done=>resolve=done);return {promise,resolve};}
async function environment(batch=null,reactUI=false,preferences=[],initialReadFailure=false){
 const listeners=new Map(),timers=new Map(),elements=new Map(),windowEvents=new Map();let next=0,owner=one,gate=null,fail=false,writes=0,readGate=null,failRead=initialReadFailure;
 const document={getElementById:id=>element(id),querySelector:selector=>element(selector),addEventListener:(type,fn)=>listeners.set(type,fn),dispatchEvent:event=>listeners.get(event.type)?.(event)};
 function element(id){if(!elements.has(id))elements.set(id,{hidden:false,disabled:false,textContent:'',addEventListener(){}});return elements.get(id);}
 const timeout=fn=>{timers.set(++next,fn);return next;};
 const ctx={document,window:{addEventListener:(type,fn)=>windowEvents.set(type,fn)},setTimeout:timeout,clearTimeout:id=>timers.delete(id),CustomEvent:function(type,options){this.type=type;this.detail=options?.detail;},localStorage:{getItem:()=>null,setItem(){},removeItem(){},length:0}};
 vm.runInNewContext(fs.readFileSync('lib/store.js','utf8'),ctx);const store=ctx.window.JB.store;store.switchAccount(one);
 const db={profiles:[],preferences:clone(preferences),resumes:[],answer_library:[],applications:[],activity_events:[],submission_attempts:[],application_milestones:[],job_batches:[]};
 const client={async rpc(name,args){
  if(name!=='save_preferences_preserving_quiet')throw Error('Unexpected RPC');
  const previous=db.preferences[0]||{};
  const search={...args.search_next};
  for(const key of ['profiles','quietMode','targets','targetsVersion']) {delete search[key];if(previous.search && key in previous.search)search[key]=previous.search[key];}
  const row={user_id:owner,search,tier_lists:args.lists_next,active_tier_list_id:args.active_next,theme:args.theme_next};
  db.preferences=[clone(row)];return {data:row};
 },auth:{getUser:async()=>({data:{user:{id:owner}}})},from(table){
  let operation='select',fields=null,filters=[],start=0,end=Infinity,single=false;
  const query={select(){return query;},eq(key,value){filters.push([key,value]);return query;},order(){return query;},range(a,b){start=a;end=b;return query;},limit(n){end=n-1;return query;},single(){single=true;return query;},upsert(value){operation='upsert';fields=value;return query;},insert(value){operation='insert';fields=value;return query;},delete(){operation='delete';return query;},then(resolve,reject){return (async()=>{
   if(operation==='upsert'){writes++;if(gate){const pending=gate;gate=null;await pending.promise;}if(fail){fail=false;return {error:Error('Offline')};}db[table]=[clone(fields)];return {data:clone(fields)};}
   if(table==='profiles' && readGate){const pending=readGate;readGate=null;await pending.promise;}
   if(table==='profiles' && failRead){failRead=false;return {error:Error('Offline')};}
   const rows=db[table].filter(row=>filters.every(([key,value])=>row[key]===value)).slice(start,end+1);return {data:single?rows[0]:clone(rows)};
  })().then(resolve,reject);}};return query;
 }};
 global.JB={store,auth:{get userId(){return owner;}},catalogReady:Promise.resolve(),setBatch(){}};
 global.document=document;global.window=ctx.window;global.location={href:'https://example.com/'+(batch?'?batch='+batch:'')};global.CustomEvent=ctx.CustomEvent;
 global.setTimeout=timeout;global.clearTimeout=ctx.clearTimeout;
 const ui={retry:{addEventListener(){}},reload:{addEventListener(){}},feedback:{textContent:''},error:{textContent:''},locks:[],locked(value){this.locks.push(value);}};
 const {connectCloud}=await import('../lib/cloud.mjs');connectCloud(client,reactUI?ui:null);
 async function flush(){const pending=[...timers.values()];timers.clear();pending.forEach(fn=>fn());for(let i=0;i<100;i++)await Promise.resolve();}
 await flush();
 return {store,db,ui,flush,event:type=>windowEvents.get(type)?.(),blockRead(){readGate=deferred();return readGate;},failRead(){failRead=true;},get writes(){return writes;},block(){gate=deferred();return gate;},fail(){fail=true;},switch(id){owner=id;store.switchAccount(id);}};
}
const globals = ['JB', 'document', 'window', 'location', 'CustomEvent', 'setTimeout', 'clearTimeout'];
let savedGlobals;
beforeEach(() => { savedGlobals = globals.map(key => [key, Object.getOwnPropertyDescriptor(global, key)]); });
afterEach(() => {
 for (const [key, descriptor] of savedGlobals) {
  if (descriptor) Object.defineProperty(global, key, descriptor);
  else delete global[key];
 }
});
test('sync serializes concurrent callers and drains edits made during a request',async()=>{
 const env=await environment();const hold=env.block();env.store.set('workflow.profile.name','First');const first=JB.cloud.save();env.store.set('workflow.profile.name','Latest');assert.equal(JB.cloud.save(),first);hold.resolve();await first;assert.equal(env.db.profiles[0].facts.name,'Latest');assert.equal(env.store.get('workflow.cloudDirty'),false);assert.equal(env.writes,2);
});
test('failed sync preserves edits and retries in the background',async()=>{
 const env=await environment();env.fail();env.store.set('workflow.profile.name','Retained');await assert.rejects(JB.cloud.save(),/Offline/);assert.equal(env.store.get('workflow.cloudDirty'),true);await env.flush();assert.equal(env.db.profiles[0].facts.name,'Retained');assert.equal(env.store.get('workflow.cloudDirty'),false);
});
test('an account switch prevents an old sync from overwriting the new account workspace',async()=>{
 const env=await environment();const hold=env.block();env.store.set('workflow.profile.name','Private one');const pending=JB.cloud.save();for(let i=0;i<10;i++)await Promise.resolve();env.switch(two);await env.flush();hold.resolve();await assert.rejects(pending,/Account changed/);assert.equal(env.store.get('workflow.profile.name'),'');assert.equal(env.store.get('workflow.cloudDirty'),false);
});

test('an unavailable morning link falls back to public jobs without blocking autosync',async()=>{
 const env=await environment('invalid-batch');assert.equal(JB.cloud.ready,true);env.store.set('workflow.profile.name','Still syncs');await JB.cloud.save();assert.equal(env.db.profiles[0].facts.name,'Still syncs');
});
test('search preference edits autosync with the existing theme and tier configuration',async()=>{
 const tiers=[{id:'custom',name:'My companies',placements:{S:['example']}}];
 const env=await environment(null,false,[{user_id:one,search:{locations:['SF']},theme:{pack:'custom'},tier_lists:tiers,active_tier_list_id:'custom'}]);
 env.store.set('workflow.searchPreferences',{locations:['Remote'],employmentTypes:['Internship'],agentFilters:{visa:false}});
 await JB.cloud.save();
 assert.deepEqual(env.db.preferences[0].search,{locations:['Remote'],employmentTypes:['Internship'],agentFilters:{visa:false}});
 assert.equal(env.db.preferences[0].theme.pack,'custom');
 assert.deepEqual(env.db.preferences[0].tier_lists,tiers);
 assert.equal(env.db.preferences[0].active_tier_list_id,'custom');
 assert.equal(env.store.get('workflow.cloudDirty'),false);
});
test('pack texture edits sync through the existing theme preference service',async()=>{
 const env=await environment(null,false,[{user_id:one,search:{},theme:{pack:'base',messages:{batch_ready:'Ready'}},tier_lists:[],active_tier_list_id:null}]);
 env.store.set('workflow.theme',{...env.store.get('workflow.theme'),pack:'spectrum'});
 await JB.cloud.save();
 assert.deepEqual(env.db.preferences[0].theme,{pack:'spectrum',messages:{batch_ready:'Ready'}});
 assert.equal(env.store.get('workflow.cloudDirty'),false);
});

test('React cloud adapter receives sync and lock state without static page controls',async()=>{
 const env=await environment(null,true);assert.equal(JB.cloud.ready,true);assert.deepEqual(env.ui.locks,[true,false]);env.store.set('workflow.profile.name','React profile');await JB.cloud.save();assert.equal(env.db.profiles[0].facts.name,'React profile');assert.equal(env.ui.feedback.textContent,'Synced');
});


test('background refresh receives agent account changes without manual reload',async()=>{
 const env=await environment(null,true);
 env.db.profiles=[{user_id:one,facts:{name:'Prepared by agent'},verified:false}];
 await env.flush();
 assert.equal(env.store.get('workflow.profile.name'),'Prepared by agent');
 assert.equal(env.writes,0);
 assert.equal(env.store.get('workflow.cloudDirty'),false);
});
test('background refresh never overwrites an edit made while a read is in flight',async()=>{
 const env=await environment();const hold=env.blockRead();
 const refresh=env.event('focus');
 for(let i=0;i<10;i++)await Promise.resolve();
 env.store.set('workflow.profile.name','Local edit during refresh');
 hold.resolve();await refresh;
 assert.equal(env.store.get('workflow.profile.name'),'Local edit during refresh');
 await env.flush();
 assert.equal(env.db.profiles[0].facts.name,'Local edit during refresh');
});
test('online event retries failed reads and clears the temporary error',async()=>{
 const env=await environment(null,true);env.failRead();
 await env.event('focus');assert.match(env.ui.error.textContent,/retry automatically/);
 env.db.profiles=[{user_id:one,facts:{name:'Recovered'},verified:false}];
 await env.event('online');
 assert.equal(env.store.get('workflow.profile.name'),'Recovered');
 assert.equal(env.ui.error.textContent,'');
});


test('initial account hydration failure recovers on its automatic timer',async()=>{
 const env=await environment(null,true,[],true);
 assert.equal(JB.cloud.ready,false);
 assert.match(env.ui.error.textContent,/Retrying automatically/);
 await env.flush();
 assert.equal(JB.cloud.ready,true);
 assert.equal(env.ui.error.textContent,'');
});
test('a delayed background response cannot reveal the previous account',async()=>{
 const env=await environment();const hold=env.blockRead();
 const refresh=env.event('focus');for(let i=0;i<10;i++)await Promise.resolve();
 env.switch(two);await env.flush();hold.resolve();await refresh;
 assert.equal(env.store.get('workflow.profile.name'),'');
});

test('personal contact fields survive cloud save and hydration without becoming verified',async()=>{
 const env=await environment();
 const contact={firstName:'Demo',lastName:'Candidate',preferredName:'Demo',suffix:'Jr.',email:'demo@example.com',phone:'+1 202-555-0142',birthday:'2000-06-15',location:'Example City',address:'123 Example Street',address2:'Apt 4',address3:'Building A',postalCode:'00123'};
 env.store.set('workflow.profile',{...env.store.get('workflow.profile'),...contact,verified:false});
 await JB.cloud.save();
 const {fromCloud}=await import('../lib/cloud-model.mjs');
 const restored=fromCloud(env.db).profile;
 for(const [key,value] of Object.entries(contact)){assert.equal(env.db.profiles[0].facts[key],value);assert.equal(restored[key],value);}
 assert.equal(restored.verified,false);
});
