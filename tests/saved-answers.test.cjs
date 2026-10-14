const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
function model() { const c={window:{JB:{}},crypto:require('node:crypto').webcrypto,Date}; vm.runInNewContext(fs.readFileSync('lib/saved-answers-model.js','utf8'),c); return c.window.JB.savedAnswerModel; }
const answer={id:'a',question:'Are you willing to relocate?',answer:'Yes',policy:'auto',verifiedAt:'2026-10-13',companyScope:'',version:1};
test('autofill requires one exact reviewed match and never infers similar questions',()=>{
 const m=model(); assert.equal(m.automatic([answer],'  ARE YOU willing to relocate?  ','Example').id,'a');
 assert.equal(m.automatic([answer],'Are you willing to relocate internationally?','Example'),null);
 assert.equal(m.automatic([{...answer,verifiedAt:null}],answer.question,'Example'),null);
 assert.equal(m.automatic([{...answer,policy:'ask'}],answer.question,'Example'),null);
 assert.equal(m.automatic([answer,{...answer,id:'b',policy:'ask'}],answer.question,'Example'),null);
});
test('company-specific answers stay scoped to that company',()=>{
 const m=model(); const scoped={...answer,companyScope:'NVIDIA'};
 assert.equal(m.automatic([scoped],answer.question,'Google'),null);
 assert.equal(m.automatic([scoped],answer.question,'nvidia').id,'a');
});
test('saved answer edits require fresh verification and preserve version provenance',()=>{
 const m=model(); const fields={question:answer.question,answer:'New',policy:'auto',verified:false,companyScope:''};
 assert.throws(()=>m.save(fields,answer),/Review/);
 const next=m.save({...fields,verified:true},answer); assert.equal(next.id,answer.id); assert.equal(next.version,2); assert.equal(answer.answer,'Yes');
});
