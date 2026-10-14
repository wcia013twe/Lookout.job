import { test } from 'node:test';
import assert from 'node:assert/strict';
import { groupContacts, draftOutreach, importOutreach, safeUrl, contactType } from '../outreach-model.mjs';
test('company grouping retains contacts and legacy role types', () => {
 const groups = groupContacts([{id:'1',company:' Google ',path:'Engineer (cold)'},{id:'2',company:'google',path:'Recruiter'}]);
 assert.equal(groups.length,1); assert.equal(groups[0].contacts.length,2);
 assert.equal(contactType(groups[0].contacts[0]),'engineer');
});
test('draft requires actual fit and name rather than inventing experience', () => {
 const record={contact:'Sam Smith',company:'Acme',title:'Backend Engineer',contactType:'recruiter',evidence:'I built a query engine.',reason:'Your database team interests me.'};
 assert.ok(draftOutreach(record,{}).missing.includes('Your profile name'));
 const draft=draftOutreach(record,{name:'Wes'}); assert.equal(draft.missing.length,0);
 assert.match(draft.message,/I built a query engine/); assert.match(draft.message,/next step to interview/);
 assert.doesNotMatch(draft.message,/Oracle|Goldman|\[/);
});
test('import preserves existing history, updates duplicates and rejects invalid contacts atomically', () => {
 const existing=[{id:'old',company:'Acme',contact:'Sam',status:'Referred',message:'Old'}];
 const next=importOutreach(JSON.stringify({contacts:[{company:'acme',contact:'Sam',contactType:'engineer',message:'New',linkedin:'https://www.linkedin.com/in/sam/'}]}),existing,()=> 'new');
 assert.equal(next.length,1); assert.equal(next[0].status,'Referred'); assert.equal(next[0].id,'old'); assert.equal(next[0].message,'New'); assert.equal(existing[0].message,'Old');
 assert.throws(()=>importOutreach(JSON.stringify({contacts:[{company:'Acme',contact:'Sam',message:'Changed'},{company:'Acme'}]}),existing,()=> 'new'));
 assert.equal(existing[0].message,'Old');
});
test('unsafe and fabricated link shapes are rejected',()=> {
 for(const url of ['javascript:alert(1)','https://linkedin.com.evil/in/sam','https://www.linkedin.com/company/acme','https://user:pass@linkedin.com/in/sam']) assert.equal(safeUrl(url,true),'');
 assert.throws(()=>importOutreach(JSON.stringify([{company:'Acme',contact:'Sam',linkedin:'https://example.com'}]),[],()=> 'new'));
});
