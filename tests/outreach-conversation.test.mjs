import {test} from 'node:test';
import assert from 'node:assert/strict';
import {conversationStage,conversationMessages,logInteraction,readConversation,waitingOn,validDate} from '../lib/outreach-conversation.mjs';
import {demoOutreachContacts} from '../next-app/lib/outreach-demo.mjs';
import {processContactDraft} from '../lib/network-model.mjs';
import {validateRequest} from '../supabase/functions/agent-gateway/contract.mjs';
const message = {id:'sent',direction:'sent',channel:'LinkedIn',date:'2026-10-20',body:'The message actually sent'};
test('drafts and legacy progress remain distinct without fabricating history',()=>{
  for(const contact of [{},{message:'Draft text'},{status:'Not asked',message:'Copied draft'}]) assert.equal(conversationStage(contact),'proposed');
  for(const status of ['Asked','Replied','Referred','Applied','Interviewing','Offer','Rejected']) {
    assert.equal(conversationStage({status}),'ongoing');assert.deepEqual(conversationMessages({status}),[]);
  }
});
test('assisted logging preserves notes, separates draft text and keeps advanced outcomes',()=>{
  const original={id:'contact',company:'Example',notes:'Private original notes',message:'Unsent draft',status:'Not asked'};
  const sent={...original,...logInteraction(original,message,'https://www.linkedin.com/messaging/thread/example/')};
  assert.equal(sent.status,'Asked');assert.equal(conversationStage(sent),'ongoing');assert.equal(waitingOn(sent),'Waiting for reply');
  assert.equal(readConversation(sent).notes,original.notes);assert.equal(original.status,'Not asked');
  const changedDraft={...sent,message:'A future draft'};
  assert.equal(conversationMessages(changedDraft)[0].body,message.body);
  const replied={...changedDraft,...logInteraction(changedDraft,{...message,id:'reply',direction:'received',body:'A real reply'})};
  assert.equal(replied.status,'Replied');assert.equal(waitingOn(replied),'Your turn to reply');
  assert.equal(logInteraction({...replied,status:'Referred'},{...message,id:'thanks'}).status,'Referred');
  assert.throws(()=>logInteraction(replied,message),/already logged/);
  assert.equal(conversationStage({...replied,status:'Not asked'}),'ongoing');
  const {id,...record}=replied;assert.doesNotThrow(()=>validateRequest({operation:'contacts.save',payload:{id,record,expectedRevision:3}}));
  const process=processContactDraft(replied,{id:'app',company:'Example',title:'Other role'},'new');
  assert.equal(conversationStage(process),'proposed');assert.deepEqual(conversationMessages(process),[]);
});
test('chronology follows reported dates; malformed data and unsafe links stay inert',()=>{
  const sent=logInteraction({},message);
  const backdated={...sent,...logInteraction(sent,{...message,id:'older',direction:'received',date:'2026-10-19'})};
  assert.deepEqual(conversationMessages(backdated).map(m=>m.id),['older','sent']);assert.equal(waitingOn(backdated),'Waiting for reply');
  for(const bad of [{...message,date:'2026-02-30'},{...message,body:' '},{...message,channel:'SMS'},{...message,body:'x'.repeat(4001)}]) assert.throws(()=>logInteraction({},bad));
  for(const url of ['javascript:alert(1)','http://example.com','https://user:secret@example.com'])assert.throws(()=>logInteraction({},message,url));
  assert.equal(validDate('2024-02-29'),true);assert.equal(validDate('2026-02-29'),false);
  const notes='{"format":"lookout-conversation-v1","messages":[{"body":"fake"}]}';
  assert.deepEqual(readConversation({notes}).messages,[]);assert.equal(readConversation({notes}).notes,notes);
});
test('demo has resettable proposed outreach and a replied thread with a follow-up',()=>{
  const a=demoOutreachContacts('2026-10-20'),b=demoOutreachContacts('2026-10-20');
  const robinhood=a.find(r=>r.id==='demo-recruiter');
  const stripe=a.find(r=>r.id==='demo-referral');
  assert.equal(conversationStage(robinhood),'proposed');assert.equal(conversationStage(stripe),'ongoing');
  assert.equal(conversationMessages(stripe).length,2);assert.equal(stripe.followUpDate,'2026-10-20');assert.equal(waitingOn(stripe),'Your turn to reply');
  stripe.notes='Changed';assert.equal(conversationMessages(b.find(r=>r.id===stripe.id)).length,2);
});
