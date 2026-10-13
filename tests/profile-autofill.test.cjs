const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
function setup() {
 const window={JB:{}};vm.runInNewContext(fs.readFileSync('profile-autofill.js','utf8'),{window});
 const listeners={},verification={};
 const form={elements:{name:{name:'name',value:'One'},email:{name:'email',value:'one@example.com'},verified:{checked:false,addEventListener:(event,fn)=>verification[event]=fn}},addEventListener:(event,fn)=>listeners[event]=fn};
 const guard=window.JB.profileAutofillGuard(form,['name','email']);
 return {form,guard,listeners,verification};
}
test('autofill events clear verification and checking current values restores it',()=>{
 const f=setup();f.guard.reset(true);assert.equal(f.guard.isReviewed(),true);
 f.form.elements.email.value='new@example.com';f.listeners.input({target:f.form.elements.email});assert.equal(f.guard.isReviewed(),false);
 f.form.elements.verified.checked=true;f.verification.change({isTrusted:true});assert.equal(f.guard.isReviewed(),true);
});
test('silent programmatic autofill cannot retain old verification',()=>{
 const f=setup();f.guard.reset(true);f.form.elements.name.value='Changed';assert.equal(f.guard.isReviewed(),false);assert.equal(f.form.elements.verified.checked,false);
});
test('account hydration resets the verification basis instead of retaining another account',()=>{
 const f=setup();f.guard.reset(true);f.form.elements.name.value='Other';f.guard.reset(false);assert.equal(f.guard.isReviewed(),false);
 f.guard.reset(true);assert.equal(f.guard.isReviewed(),true);
});

test('an extension cannot mark its own imported values as human-reviewed',()=>{
 const f=setup();f.form.elements.name.value='Imported';f.form.elements.verified.checked=true;f.verification.change({isTrusted:false});assert.equal(f.guard.isReviewed(),false);
});
