import test from 'node:test';
import assert from 'node:assert/strict';
import {timelineItems,hasCallback,sortApplications,timelineDate} from '../application-timeline.mjs';
import {buildSubmissionRecord} from '../submission-record.mjs';
const receipt={source:'runner-observed-greenhouse-confirmation',marker:'#confirmation',message:'Received',jobUrl:'https://example.com/job'};
test('interview status never invents a submitted application or completed interview',()=>{
 const items=timelineItems({status:'Interview'});
 assert.equal(items.length,1);assert.equal(items[0].kind,'interview');assert.equal(items[0].phase,'received');assert.equal(items[0].occurred_at,null);
 assert.ok(!items.some(item=>item.kind==='application_submitted'));
});
test('timeline orders dates and preserves scheduled rounds, unknown dates and email provenance',()=>{
 const items=timelineItems({status:'Interview'},[
  {id:'technical',kind:'technical_round1',occurred_at:'2026-10-23',phase:'scheduled',source:{kind:'email',messageId:'email2',subject:'Round one',excerpt:'Meet October23.',url:'https://example.com/email/2'}},
  {id:'recruiter',kind:'recruiter_call',occurred_at:'2026-10-18',phase:'completed',source:{kind:'email',messageId:'email1',excerpt:'Our call happened.'}},
  {id:'submitted',kind:'application_submitted',occurred_at:null,phase:'completed',source:{kind:'user'}},
 ]);
 assert.deepEqual(items.map(item=>item.id),['submitted','recruiter','technical']);
 assert.equal(items[0].occurred_at,null);assert.equal(items[2].phase,'scheduled');assert.equal(items[2].label,'Technical round 1');assert.equal(items[2].source.messageId,'email2');
});
test('submission confirmation depends on evidence; reported submission remains distinct',()=>{
 assert.equal(timelineItems({status:'Submitted'})[0].observedConfirmation,false);
 assert.equal(timelineItems({status:'Interview',submittedAt:'2026-10-12',url:receipt.jobUrl,receipt})[0].observedConfirmation,true);
 assert.equal(timelineItems({status:'Submitted',url:'https://example.com/other',receipt})[0].observedConfirmation,false);
});
test('active callbacks sort above submitted and terminal roles remain lower',()=>{
 const items=[{id:'submitted',status:'Submitted'},{id:'rejected',status:'Rejected',milestones:[{kind:'recruiter_call',phase:'completed'}]},{id:'draft',status:'Draft'},{id:'callback',status:'Draft',milestones:[{kind:'technical_round',phase:'scheduled'}]},{id:'withdrawn',status:'Withdrawn'},{id:'interview',status:'Interview'}];
 assert.equal(hasCallback(items[1]),false);assert.equal(hasCallback(items[3]),true);
 assert.deepEqual(sortApplications(items).map(item=>item.id),['callback','interview','submitted','draft','rejected','withdrawn']);
 assert.equal(items[0].id,'submitted');
});
test('unknown and invalid dates remain unknown; unsafe email URLs are omitted',()=>{
 for(const date of ['next Friday','2026-02-30','10/14/2026'])assert.equal(timelineDate(date),null);
 const item=timelineItems({},[{kind:'recruiter_call',occurred_at:'Friday',phase:'scheduled',source:{kind:'email',url:'javascript:alert(1)'}}])[0];
 assert.equal(item.occurred_at,null);assert.equal(item.source.url,'');assert.equal(item.phase,'scheduled');
});
test('existing explicit user progress activity appears without parsing arbitrary email text',()=>{
 const items=timelineItems({status:'Interview',submittedAt:'2026-10-12',activity:[{at:'2026-10-15',actor:'user',text:'You reported Interview: Recruiter contacted me.'},{at:'2026-10-16',text:'Hope this turns into an offer.'}]});
 assert.equal(items.length,2);assert.equal(items[1].kind,'interview');assert.equal(items[1].phase,'received');
});
test('mixed undated milestones never disturb the chronological order of recorded dates',()=>{
 const rows=timelineItems({},[{id:'late',kind:'recruiter_call',occurred_at:'2026-10-23',phase:'completed'},{id:'unknown',kind:'interview',occurred_at:null,phase:'received'},{id:'early',kind:'technical_round',occurred_at:'2026-10-12',phase:'completed'}]);
 assert.deepEqual(rows.filter(row=>row.occurred_at).map(row=>row.id),['early','late']);
});
test('resume identity comes from immutable snapshot including its exact version and variant',()=>{
 const attempts=[{id:'attempt',application_id:'app',state:'uncertain',context_snapshot:{resume:{id:'resume-old',name:'Backend resume',version:2,variant:'Systems'},application:{draft:{resumeId:'resume-old'}}}}];
 const record=buildSubmissionRecord({id:'app',resume:{id:'resume-new',version:9}},attempts);
 assert.equal(record.attempts[0].resume.version,2);assert.equal(record.attempts[0].resume.variant,'Systems');assert.equal(record.attempts[0].resume.id,'resume-old');
 const noVersion=buildSubmissionRecord({id:'app'},[{...attempts[0],context_snapshot:{resume:{id:'resume-old'}}}]);
 assert.equal(noVersion.attempts[0].resume.version,null);
});

test('a sourced rejection stops callback prioritization without rewriting application status',()=>{
 const ended={id:'ended',status:'Submitted',milestones:[{kind:'recruiter_call',phase:'completed',label:'Recruiter call',occurred_at:null},{kind:'rejected',phase:'received',label:'Rejection email',occurred_at:null,source:{kind:'email',messageId:'rejected-message'}}]};
 assert.equal(hasCallback(ended),false);
 assert.deepEqual(sortApplications([ended,{id:'active',status:'Interview'}]).map(a=>a.id),['active','ended']);
 assert.equal(ended.status,'Submitted');
});
