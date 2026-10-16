import test from 'node:test';
import assert from 'node:assert/strict';
import {forumMentionCandidates,forumMentionAt,formatForumMention,parseForumMentions} from '../lib/circle-forum-mentions.mjs';
import {createCircleKnowledgeDemo} from '../lib/circle-knowledge-demo.mjs';
const post={id:'forum-1',circleId:'circle-1',parentId:null,state:'published',revision:1,publishedRevision:1,author:'Sam',content:{type:'interview_report',title:'Backend [round]',company:'Stripe'}};
test('mentions only offer current published top-level forum posts',()=>{
 const excluded=[{...post,id:'draft',state:'draft'},{...post,id:'edited',revision:2},{...post,id:'reply',parentId:'forum-1'},{...post,id:'chat',content:{...post.content,type:'discussion'}},{...post,id:'withdrawn',state:'withdrawn'}];
 assert.deepEqual(forumMentionCandidates([post,...excluded],'stripe'),[post]);
 assert.deepEqual(forumMentionCandidates([post],'sam'),[post]);
 assert.deepEqual(forumMentionCandidates([post],'missing'),[]);
 assert.throws(()=>formatForumMention(excluded[0]));
});
test('mention detection respects cursor and safe links round-trip without arbitrary URL rendering',()=>{
 assert.deepEqual(forumMentionAt('See @str please',8),{start:4,end:8,query:'str'});
 assert.equal(forumMentionAt('sam@example.com',15),null);
 const mention=formatForumMention(post),parts=parseForumMentions(`See ${mention} tomorrow`);
 assert.equal(parts[1].text,'@Backend  round');
 assert.equal(parts[1].postId,post.id);
 assert.equal(parts[1].circleId,post.circleId);
 for(const unsafe of ['[@bad](javascript:alert(1))','[@bad](https://other.example/)','[@bad](?circle=circle-1&thread=../../private)'])assert.deepEqual(parseForumMentions(unsafe),[{text:unsafe}]);
});
test('forum references survive existing reviewed draft, publication and thread retrieval without attachment snapshots',()=>{
 const service=createCircleKnowledgeDemo(),circleId='demo-circle';
 const original=forumMentionCandidates(service.action('knowledge.search',{circleId}).items)[0];
 const body=`Let’s discuss ${formatForumMention(original)}`;
 const draft=service.action('knowledge.propose',{circleId,content:{type:'discussion',title:'Discussing a forum post',body,sources:[],provenance:'user_confirmed',personalDisclosure:false}});
 assert.equal(service.action('knowledge.read',{circleId,postId:draft.postId}).post.state,'draft');
 service.action('knowledge.approve',{circleId,postId:draft.postId,expectedRevision:1});
 service.action('knowledge.publish',{circleId,postId:draft.postId,expectedRevision:1});
 const saved=service.action('knowledge.read',{circleId,postId:draft.postId}).post;
 assert.equal(saved.content.body,body);
 assert.equal(saved.content.contexts,undefined);
 assert.equal(parseForumMentions(saved.content.body).find(part=>part.postId)?.postId,original.id);
});
