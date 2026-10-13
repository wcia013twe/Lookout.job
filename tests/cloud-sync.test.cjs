const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const {setImmediate:immediate}=require('node:timers/promises');
const owner='11111111-1111-4111-8111-111111111111';
function setup(){
 const elements=new Map(),listeners=new Map(),storage=new Map();
 const document={getElementById:id=>element(id),querySelector:s=>element(s.slice(1)),addEventListener:(name,fn)=>{const callbacks=listeners.get(name)||[];callbacks.push(fn);listeners.set(name,callbacks);},dispatchEvent:e=>(listeners.get(e.type)||[]).forEach(fn=>fn(e))};
 function element(id){if(!elements.has(id))elements.set(id,{disabled:false,hidden:false,textContent:'',inert:false,addEventListener(){}});return elements.get(id);}
 const window={addEventListener(){}};
 const c={window,document,CustomEvent,setTimeout:()=>1,clearTimeout(){},localStorage:{getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k),length:0}};
 vm.runInNewContext(fs.readFileSync('store.js','utf8'),c);const store=c.window.JB.store;
 const tables=Object.fromEntries(['profiles','preferences','resumes','answer_library','applications'].map(k=>[k,[]]));
 let currentOwner=owner,fail=false;
 const client={auth:{getUser:async()=>({data:{user:{id:currentOwner}}})},from(table){
  let op='select',fields={},filters=[],one=false;
  const q={select(){return q;},eq(k,v){filters.push([k,v]);return q;},limit(){return q;},single(){one=true;return q;},upsert(v){op='upsert';fields=v;return q;},insert(v){op='insert';fields=v;return q;},delete(){op='delete';return q;},update(v){op='update';fields=v;return q;},then(resolve){
   if(fail && op!=='select')return Promise.resolve({data:null,error:new Error('Offline')}).then(resolve);
   let rows=tables[table].filter(r=>filters.every(([k,v])=>r[k]===v));
   if(op==='upsert'){let r=tables[table].find(r=>fields.id ? r.id===fields.id : r.user_id===fields.user_id);if(!r){r={};tables[table].push(r);}Object.assign(r,fields);rows=[r];}
   if(op==='insert'){const r={id:crypto.randomUUID(),revision:0,status:'Queued',...fields};tables[table].push(r);rows=[r];}
   if(op==='delete')tables[table]=tables[table].filter(r=>!rows.includes(r));
   if(op==='update')rows.forEach(r=>Object.assign(r,fields,{revision:r.revision+1}));
   return Promise.resolve({data:structuredClone(one?rows[0]:rows),error:null}).then(resolve);
  }};return q;
 }};
 global.document=document;global.window=window;global.location={href:'https://example.com/'};global.JB={store,auth:{userId:owner}};
 return {client,store,tables,elements,setFail:v=>fail=v,setOwner:v=>currentOwner=v};
}
async function settle(){for(let i=0;i<5;i++)await immediate();}
test('signed-in edits autosync and offline failures preserve a dirty browser copy',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});const ctx=setup();
 const {connectCloud}=await import('../cloud.mjs');connectCloud(ctx.client);
 t.mock.timers.tick(1);await settle();assert.equal(JB.cloud.ready,true);
 ctx.store.set('workflow.profile',{name:'Cloud One',email:'one@example.com',verified:true});
 t.mock.timers.tick(651);await settle();
 assert.equal(ctx.tables.profiles[0].facts.name,'Cloud One');assert.equal(ctx.store.get('workflow.cloudDirty'),false);
 ctx.setFail(true);ctx.store.set('workflow.profile',{name:'Offline edit',email:'one@example.com',verified:true});
 t.mock.timers.tick(651);await settle();
 assert.equal(ctx.tables.profiles[0].facts.name,'Cloud One');assert.equal(ctx.store.get('workflow.profile').name,'Offline edit');assert.equal(ctx.store.get('workflow.cloudDirty'),true);
 assert.equal(ctx.elements.get('account-save').hidden,false);
 ctx.setFail(false);await JB.cloud.save();assert.equal(ctx.tables.profiles[0].facts.name,'Offline edit');
 ctx.setOwner('22222222-2222-4222-8222-222222222222');ctx.store.set('workflow.profile',{name:'Must not cross accounts',verified:false});
 t.mock.timers.tick(651);await settle();
 assert.equal(ctx.tables.profiles[0].facts.name,'Offline edit');assert.equal(ctx.tables.profiles.length,1);
 delete global.JB;delete global.window;delete global.document;delete global.location;
});
