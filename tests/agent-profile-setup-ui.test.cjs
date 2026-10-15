const test=require('node:test');const assert=require('node:assert/strict');const vm=require('node:vm');const fs=require('node:fs');
test('existing connection enables profile setup using human auth without issuing a replacement token',async()=>{
 const elements={};
 const element=selector=>elements[selector] ||= {value:'',hidden:false,disabled:false,inert:false,innerHTML:'',textContent:'',listeners:{},addEventListener(name,handler){this.listeners[name]=handler;},querySelector(){return element('#submit');}};
 const form=element('#agent-connection-form');form.elements={name:{value:'Muse'},access:{value:'prepare'}};
 const connection={id:'11111111-1111-1111-1111-111111111111',name:'Muse',scopes:['workspace:read','drafts:write'],expires_at:'2099-01-01',revoked_at:null};
 const calls=[];
 const JB={esc:text=>text,auth:{userId:'owner',client:{auth:{getSession:async()=>({data:{session:{user:{id:'owner'},access_token:'synthetic-human-jwt'}}})},functions:{invoke:async(_,request)=>{
  assert.equal(request.headers.Authorization,'Bearer synthetic-human-jwt');calls.push(request.body);
  if(request.body.operation==='connections.profile_setup') {connection.scopes.push('profile:write');return {data:{data:connection}};}
  return {data:{data:[connection]}};
 }}}}};
 const document={querySelector:element,addEventListener(){}};
 vm.runInNewContext(fs.readFileSync('legacy/agent-connections.js','utf8'),{JB,document,navigator:{},setTimeout});
 await new Promise(setImmediate);
 assert.match(element('#agent-connection-list').innerHTML,/Enable profile setup/);
 const button={disabled:false,dataset:{profileSetupAgent:connection.id,enabled:'true'}};
 await element('#agent-connection-list').listeners.click({target:{closest:selector=>selector==='[data-profile-setup-agent]'?button:null}});
 assert.deepEqual(JSON.parse(JSON.stringify(calls.find(call=>call.operation==='connections.profile_setup').payload)),{id:connection.id,enabled:true});
 assert.equal(calls.some(call=>call.operation==='connections.issue'),false);
 assert.match(element('#agent-connection-list').innerHTML,/Disable profile setup/);
 assert.match(element('#agent-connection-feedback').textContent,/existing token still works/);
});
