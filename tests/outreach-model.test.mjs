import { test } from 'node:test';
import assert from 'node:assert/strict';
import { groupContacts, draftOutreach, importOutreach, safeUrl, contactType, outreachSentences, OUTREACH_TAGS } from '../lib/outreach-model.mjs';
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

test('sentence annotations preserve exact message text and highlight complete sentences', () => {
 const message = 'Hi Sam,\n\nWe are both Example University alumni. I built a backend service. Would you refer me?\n\nThanks,\nWes';
 const spans = outreachSentences({message});
 assert.equal(spans.map(s=>s.text).join(''),message);
 assert.deepEqual(spans.filter(s=>s.kind).map(s=>[s.kind,s.text.trim()]),[
  ['Connection','We are both Example University alumni.'],['Achievement','I built a backend service.'],['Ask','Would you refer me?']
 ]);
 assert.equal(outreachSentences({message:'Hi Sam, thank you.'})[0].kind,null);
 assert.equal(outreachSentences({message:'Our robotics club connected us.',connection:'Our robotics club connected us.'})[0].kind,'Connection');
 assert.equal(outreachSentences({message:'Reduced latency by 30%.',evidence:'Reduced latency by 30%.'})[0].kind,'Achievement');
 assert.deepEqual(outreachSentences({}),[]);
});

test('shared employer sentence is annotated as a connection without changing the text', () => {
 const message = 'I saw that you also worked at Oracle. I built a backend service.';
 const spans = outreachSentences({message});
 assert.equal(spans[0].kind,'Connection');
 assert.equal(spans[1].kind,'Achievement');
 assert.equal(spans.map(s=>s.text).join(''),message);
});

test('six-tag examples cover all categories without changing text or inventing a timeline', async () => {
 const {outreachDemoMessages} = await import('../next-app/lib/outreach-demo.mjs');
 assert.deepEqual(OUTREACH_TAGS.map(tag=>tag.kind),['Background','Connection','Achievement','Why them','Timing','Ask']);
 for (const example of outreachDemoMessages) {
  const spans=outreachSentences(example);
  assert.equal(spans.map(span=>span.text).join(''),example.message);
  const kinds=spans.filter(span=>span.kind).map(span=>span.kind);
  assert.deepEqual(kinds,example.id==='recruiter' ? OUTREACH_TAGS.map(tag=>tag.kind) : OUTREACH_TAGS.filter(tag=>tag.kind!=='Timing').map(tag=>tag.kind));
 }
 assert.equal(outreachSentences({message:'I’d like to interview for the backend role.'})[0].kind,'Ask');
 assert.equal(outreachSentences({message:'Which database does the team use?'})[0].kind,null);
 assert.equal(outreachSentences({message:'I built a service.'})[0].kind,'Achievement');
 assert.equal(outreachSentences({message:'I’m a computer science student.'})[0].kind,'Background');
});
