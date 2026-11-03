import {test} from 'node:test';
import assert from 'node:assert/strict';
import {validatePersonContext,searchPeople,activeSuggestions,setSuggestionState,addRelationshipUpdate} from '../lib/network-people.mjs';
import {validateRequest} from '../supabase/functions/agent-gateway/contract.mjs';
import {createTestDatabase} from './helpers/database.mjs';
const source={title:'Technical talk',url:'https://example.com/talk',observedAt:'2026-11-03'};
const suggestion={id:'suggestion-1',purpose:'referral',rationale:'Offered an introduction',action:'Send two questions',sources:[source],createdAt:'2026-11-03T12:00:00Z',updatedAt:'2026-11-03T12:00:00Z',state:'active'};
const person={id:'person',contact:'Pat',company:'',professionalTitle:'Engineer',technicalInterests:'Query engines',relationshipSummary:'Former colleague',notes:'Original notes',status:'Referred',message:'Human edited draft',suggestion};
test('person memory supports independent people and context-aware search/order',()=>{
 assert.doesNotThrow(()=>validatePersonContext(person));
 assert.doesNotThrow(()=>validateRequest({operation:'contacts.save',payload:{id:'person',expectedRevision:0,record:person}}));
 assert.equal(searchPeople([person],'query').length,1);assert.equal(searchPeople([person],'former colleague').length,1);
 const rows=[{...person,id:'recent',_updatedAt:'2026-11-03T12:00:00Z'},{...person,id:'due',followUpDate:'2026-11-01'}];
 assert.deepEqual(searchPeople(rows,'','','2026-11-03').map(p=>p.id),['due','recent']);
 for(const purpose of ['connect','maintain','referral'])assert.doesNotThrow(()=>validatePersonContext({...person,suggestion:{...suggestion,purpose}}));
});
test('suggestion completion/dismissal and relationship updates preserve drafts and outcomes',()=>{
 for(const state of ['done','dismissed']){const next=setSuggestionState(person,state);assert.equal(activeSuggestions([next]).length,0);assert.equal(next.status,'Referred');assert.equal(next.message,person.message);assert.equal(next.id,person.id);}
 const next=addRelationshipUpdate(person,{id:'note',date:'2026-11-03',body:'Offered a referral'},'Send resume','2026-11-05');
 assert.equal(next.notes,person.notes);assert.equal(next.message,person.message);assert.equal(next.status,'Referred');assert.equal(next.relationshipUpdates.length,1);
 assert.throws(()=>addRelationshipUpdate(next,{id:'note',date:'2026-11-03',body:'Duplicate'}));
 assert.throws(()=>validatePersonContext({...person,suggestion:{...suggestion,sources:[{...source,url:'javascript:alert(1)'}]}}));
 assert.throws(()=>validatePersonContext({...person,relationshipUpdates:[{id:'x',date:'2026-02-30',body:'Invalid date'}]}));
});
test('person context persists through browser and Muse with revision, validation and owner checks',async()=>{
 const db=await createTestDatabase(),one='11111111-1111-1111-1111-111111111111',two='22222222-2222-2222-2222-222222222222';
 try{
  await db.exec(`set role authenticated;set test.uid='${one}';`);
  let row=(await db.query('select public.save_outreach_contact($1,-1,$2,$3) data',['person',person,one])).rows[0].data;
  assert.equal(row.record.company,'');
  await db.exec('reset role');
  await db.query("insert into private.agent_connections(user_id,name,token_hash,scopes,expires_at) values($1,'network','network-token',array['workspace:read','network:write'],now()+interval '1 day')",[one]);
  const {id:personId,...personRecord}=person;
  const saved={...personRecord,suggestion:{...suggestion,state:'dismissed'}};
  row=(await db.query("select public.agent_dispatch('network-token','contacts.save',$1) data",[{id:'person',expectedRevision:row.revision,record:saved}])).rows[0].data;
  assert.equal(row.record.suggestion.state,'dismissed');assert.equal(row.record.message,person.message);
  await assert.rejects(db.query("select public.agent_dispatch('network-token','contacts.save',$1)",[{id:'person',expectedRevision:0,record:person}]));
  row=(await db.query("select private.update_owned_fields($1,'contacts.fields.update',$2) data",[one,{id:'person',expectedRevision:row.revision,fields:{relationshipUpdates:[{id:'u',date:'2026-11-03',body:'Shared advice'}],nextAction:'Thank them'}}])).rows[0].data;
  assert.equal(row.record.relationshipUpdates[0].body,'Shared advice');assert.equal(row.record.status,'Referred');assert.equal(row.record.notes,'Original notes');
  await db.exec(`set role authenticated;set test.uid='${two}';`);assert.equal((await db.query("select * from public.outreach_contacts where id='person'")).rows.length,0);
  await assert.rejects(db.query('select public.save_outreach_contact($1,$2,$3,$4)',['person',row.revision,person,one]));
  await db.exec(`set test.uid='${one}';`);
  await assert.rejects(db.query('select public.save_outreach_contact($1,$2,$3,$4)',['person',row.revision,{...person,suggestion:{...suggestion,state:'sent'}},one]));
  await db.exec('reset role');
  await assert.rejects(db.query("select private.update_owned_fields($1,'contacts.fields.update',$2)",[two,{id:'person',expectedRevision:row.revision,fields:{nextAction:'Hijack'}}]));
 }finally{await db.close();}
});
