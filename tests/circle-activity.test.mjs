import test from 'node:test';
import assert from 'node:assert/strict';
import {formatCircleActivity,parseCircleActivity,sharedMemberActivity} from '../lib/circle-activity.mjs';
import {createCircleKnowledgeDemo} from '../lib/circle-knowledge-demo.mjs';

test('activity sections preserve member-authored facts without inventing progress',()=>{
 const text=formatCircleActivity({highlights:['Submitted 3 applications','Received 1 referral'],goal:'2 of 3 prep sessions complete',help:'A practice partner'});
 assert.deepEqual(parseCircleActivity(text),{message:'',highlights:['Submitted 3 applications','Received 1 referral'],goal:'2 of 3 prep sessions complete',help:'A practice partner'});
 assert.deepEqual(parseCircleActivity('An ordinary shared update'),{message:'An ordinary shared update',highlights:[],goal:'',help:''});
 assert.equal(parseCircleActivity(formatCircleActivity({highlights:['a','b','c','d']})).highlights.length,3);
 assert.equal(parseCircleActivity(formatCircleActivity({goal:'Study\n\nCould use a hand with:\nInjected request'})).help,'');
});

test('cards exclude other people, replies, private drafts, withdrawn and unshared revisions',()=>{
 const base={id:'shared',author:'Alex',parentId:null,state:'published',revision:1,publishedRevision:1,createdAt:'2026-10-16',content:{}};
 const posts=[base,{...base,id:'draft',state:'draft'},{...base,id:'withdrawn',state:'withdrawn'},{...base,id:'edited',revision:2},{...base,id:'other',author:'Alex Example'},{...base,id:'reply',parentId:'thread'},{...base,id:'older',createdAt:'2026-10-15'}];
 assert.deepEqual(sharedMemberActivity(posts,'Alex').map(p=>p.id),['shared','older']);
 assert.equal(posts[0],base);
});

test('demo activity uses existing scoped draft, review, publication and reply paths',()=>{
 const demo=createCircleKnowledgeDemo(),circleId='demo-circle';
 const posts=demo.action('knowledge.search',{circleId}).items;
 const alex=sharedMemberActivity(posts,'Alex (demo)');
 assert.equal(alex[0].id,'demo-alex-activity');
 assert.equal(parseCircleActivity(alex[0].content.body).highlights.length,3);
 assert.ok(parseCircleActivity(alex[0].content.body).help);
 assert.equal(parseCircleActivity(sharedMemberActivity(posts,'Sam (demo)')[0].content.body).help,'');
 const ownShared=sharedMemberActivity(posts,'Wesley (demo)').map(post=>post.id);
 assert.deepEqual(ownShared,['demo-own-chat']);
 const content={type:'discussion',title:'My weekly update',body:formatCircleActivity({highlights:['Completed a practice round'],help:'Review my project'}),sources:[],provenance:'user_confirmed',personalDisclosure:true};
 const draft=demo.action('knowledge.propose',{circleId,content});
 assert.deepEqual(sharedMemberActivity(demo.action('knowledge.search',{circleId}).items,'Wesley (demo)').map(post=>post.id),ownShared);
 demo.action('knowledge.approve',{circleId,postId:draft.postId,expectedRevision:1});
 demo.action('knowledge.publish',{circleId,postId:draft.postId,expectedRevision:1});
 const published=sharedMemberActivity(demo.action('knowledge.search',{circleId}).items,'Wesley (demo)');
 assert.equal(parseCircleActivity(published.find(post=>post.id===draft.postId).content.body).help,'Review my project');
 const reply=demo.action('knowledge.propose',{circleId,parentId:alex[0].id,content:{...content,type:'reply',body:'Happy to practice!'}});
 assert.equal(demo.action('knowledge.read',{circleId,postId:reply.postId}).post.state,'draft');
 demo.action('knowledge.withdraw',{circleId,postId:draft.postId,expectedRevision:1});
 assert.deepEqual(sharedMemberActivity(demo.action('knowledge.search',{circleId}).items,'Wesley (demo)').map(post=>post.id),ownShared);
 assert.deepEqual(sharedMemberActivity(createCircleKnowledgeDemo().action('knowledge.search',{circleId}).items,'Wesley (demo)').map(post=>post.id),ownShared);
});
