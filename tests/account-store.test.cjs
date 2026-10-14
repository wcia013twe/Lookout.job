const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const one='11111111-1111-4111-8111-111111111111',two='22222222-2222-4222-8222-222222222222';
function store() {
 const data=new Map();
 const context={window:{addEventListener(){}},document:{addEventListener(){},dispatchEvent(){}},CustomEvent:function(){},setTimeout:()=>1,clearTimeout(){},localStorage:{getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k),length:0}};
 vm.runInNewContext(fs.readFileSync('lib/store.js','utf8'),context);return context.window.JB.store;
}
test('account workspaces isolate profile, answers and drafts and preserve the guest workspace',()=>{
 const s=store();s.set('workflow.profile',{name:'Guest'});
 s.switchAccount(one); assert.equal(s.get('workflow.profile').name,'');
 s.set('workflow.profile',{name:'One'});s.set('workflow.savedAnswers',[{answer:'Private'}]);s.set('workflow.applications',{job:{status:'Draft'}});
 s.switchAccount(two);assert.equal(s.get('workflow.profile').name,'');assert.equal(s.get('workflow.savedAnswers').length,0);assert.equal(Object.keys(s.get('workflow.applications')).length,0);
 s.set('workflow.profile',{name:'Two'});s.switchAccount(one);assert.equal(s.get('workflow.profile').name,'One');assert.equal(s.get('workflow.savedAnswers')[0].answer,'Private');
 s.switchAccount(null);assert.equal(s.get('workflow.profile').name,'Guest');
});
test('invalid account namespace cannot overwrite guest state',()=>{
 const s=store();s.set('workflow.profile',{name:'Guest'});assert.throws(()=>s.switchAccount('../guest'),/Invalid account/);assert.equal(s.get('workflow.profile').name,'Guest');
});
