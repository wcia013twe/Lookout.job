import test from 'node:test';
import assert from 'node:assert/strict';

import {demoOutreachContacts} from '../next-app/lib/outreach-demo.mjs';
import {validatePersonContext, activeSuggestions, setSuggestionState} from '../lib/network-people.mjs';
import {readConversation} from '../lib/outreach-conversation.mjs';

test('fictional interview and warm-introduction suggestions use existing contact contracts',()=>{
 const people=demoOutreachContacts('2026-11-07');
 for(const person of people)validatePersonContext(person);
 const engineer=people.find(p=>p.id==='demo-new-connection');
 assert.equal(engineer.suggestion.purpose,'connect');
 assert.match(engineer.suggestion.rationale,/interviewing/);
 assert.match(engineer.suggestion.rationale,/team membership is unconfirmed/);
 assert.deepEqual(engineer.tags,['application:demo-stripe']);
 assert.match(engineer.message,/Query Lab/);
 assert.doesNotMatch(engineer.message,/referr/i);
 const warm=people.find(p=>p.id==='demo-referral');
 assert.equal(warm.suggestion.purpose,'maintain');
 assert.match(warm.suggestion.rationale,/offered an introduction/);
 assert.match(warm.message,/two questions/);
 assert.equal(warm.status,'Referred');
});

test('demo suggestion interaction preserves drafts, conversation and dismissal on reset',()=>{
 const people=demoOutreachContacts('2026-11-07');
 const warm=people.find(p=>p.id==='demo-referral');
 const before=structuredClone(warm);
 const completed=setSuggestionState(warm,'done','2026-11-07T14:00:00Z');
 assert.deepEqual(readConversation(completed),readConversation(before));
 assert.equal(completed.message,before.message);
 assert.equal(completed.status,before.status);
 assert.deepEqual(warm,before);
 assert.equal(activeSuggestions([completed]).length,0);
 assert.equal(people.find(p=>p.id==='demo-independent').suggestion.state,'dismissed');
 assert.equal(activeSuggestions(people).length,3);
 completed.message='Temporary demo edit';
 assert.equal(demoOutreachContacts('2026-11-07').find(p=>p.id===warm.id).message,before.message);
});
