import test from 'node:test';
import assert from 'node:assert/strict';
import {applicationContext,referralContext,validateSharedContexts,publicContextUrl,contextFromDrop} from '../lib/circle-attachments.mjs';
import {createCircleKnowledgeDemo} from '../lib/circle-knowledge-demo.mjs';

test('application and referral snapshots exclude internal IDs, correspondence and account history',()=>{
 const application=applicationContext({id:'private-uuid',company:'Databricks',title:'Software engineer',applicationUrl:'https://www.databricks.com/careers/6865687002',resume:'private resume',questions:[{answer:'private'}],email:'private@example.com',activity:['private']},'Technical round 2');
 assert.deepEqual(application,{kind:'application',label:'Databricks · Software engineer',company:'Databricks',role:'Software engineer',jobId:'6865687002',jobUrl:'https://www.databricks.com/careers/6865687002',stage:'Technical round 2'});
 assert.deepEqual(referralContext({id:'private-contact',company:'Stripe',contact:'Jamie',title:'Engineer',linkedin:'https://www.linkedin.com/in/jamie',email:'private@example.com',message:'private',notes:'private'}),{kind:'referral',label:'Stripe · Jamie',company:'Stripe',contact:'Jamie',role:'Engineer',url:'https://www.linkedin.com/in/jamie'});
 for(const url of ['http://example.com','https://user:secret@example.com','https://example.com?token=secret','https://mail.google.com/mail/u/0/','https://example.com/storage/v1/object/sign/private'])assert.equal(publicContextUrl(url),undefined);
});

test('context validation and isolated demo preserve and search explicit attachment snapshots',()=>{
 const contexts=[applicationContext({company:'Databricks',title:'Software engineer',employerJobId:'423423'},'Interview'),referralContext({company:'Stripe',contact:'Jamie',title:'Engineer'}),{kind:'note',label:'Preparation plan',note:'Cardinality estimates'},{kind:'resource',label:'Query docs',url:'https://www.postgresql.org/docs/'}];
 assert.deepEqual(validateSharedContexts(contexts),contexts);
 for(const invalid of [null,{},[null],[{kind:'unknown',label:'x'}],[{kind:'note',label:' '}],[{kind:'referral',label:'x',email:'private@example.com'}],[{kind:'note',label:'x',note:'x'.repeat(1001)}],[{kind:'resource',label:'x',url:'https://example.com?token=secret'}],Array(7).fill(contexts[0])])assert.throws(()=>validateSharedContexts(invalid));
 const demo=createCircleKnowledgeDemo(),circleId='demo-circle',content={type:'discussion',title:'Preparation',body:'What should I prepare?',contexts,sources:[],provenance:'user_confirmed',personalDisclosure:true};
 const draft=demo.action('knowledge.propose',{circleId,expectedRevision:0,content});
 const snapshot=demo.action('knowledge.read',{circleId,postId:draft.postId}).post;
 assert.deepEqual(snapshot.agentContext.contexts,contexts);snapshot.agentContext.contexts[0].company='Mutated';
 assert.equal(demo.action('knowledge.read',{circleId,postId:draft.postId}).post.content.contexts[0].company,'Databricks');
 assert.equal(demo.action('knowledge.search',{circleId,query:'Cardinality estimates'}).items[0].id,draft.postId);
 assert.equal(createCircleKnowledgeDemo().action('knowledge.search',{circleId,query:'423423'}).items.length,0);
});

test('drop payloads use the same whitelist and private-link validation as selected context',()=>{
 assert.deepEqual(contextFromDrop({job:JSON.stringify({company:'Databricks',role:'Engineer',jobId:'423423',privateNotes:'excluded'})}),{kind:'application',label:'Databricks',company:'Databricks',role:'Engineer',jobId:'423423'});
 assert.deepEqual(contextFromDrop({text:'https://www.postgresql.org/docs/'}),{kind:'resource',label:'www.postgresql.org',url:'https://www.postgresql.org/docs/'});
 assert.deepEqual(contextFromDrop({text:'Discuss query cardinality'}),{kind:'note',label:'Attached note',note:'Discuss query cardinality'});
 assert.equal(contextFromDrop({text:''}),null);
 for(const input of [{context:'invalid JSON'},{context:JSON.stringify({kind:'application',label:'x',note:'hidden content'})},{text:'https://example.com?token=secret'},{context:JSON.stringify({kind:'referral',label:'x',email:'private@example.com'})}])assert.throws(()=>contextFromDrop(input));
});
