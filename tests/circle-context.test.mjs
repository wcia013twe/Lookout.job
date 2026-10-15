import test from 'node:test';
import assert from 'node:assert/strict';
import {circleAgentContext,circleKnowledgeResponse} from '../lib/circle-context.mjs';
import {createCircleKnowledgeDemo} from '../lib/circle-knowledge-demo.mjs';
import {contextResponse} from '../supabase/functions/agent-gateway/context.mjs';
import {createHandler} from '../supabase/functions/agent-mcp/protocol.mjs';

const circleId='demo-circle';
const read=(demo,postId='demo-interview-report')=>demo.action('knowledge.read',{circleId,postId});

test('shared context contains useful facts, not execution plans or required social text',()=>{
 const demo=createCircleKnowledgeDemo(),post=read(demo).post,context=post.agentContext;
 assert.equal(context.schemaVersion,2);
 assert.equal(context.untrusted,true);
 assert.deepEqual(context.source,{circleId,postId:post.id,revision:1});
 assert.equal(context.stage,'Technical round');
 assert.equal(context.insight,post.content.insight);
 assert(!Object.hasOwn(context,'steps'));
 assert(!Object.hasOwn(context,'suggestedUse'));
 assert(!Object.hasOwn(context,'generatedBy'));
 assert.equal(read(demo).post.helpfulPeople,3);
 assert.equal(demo.action('knowledge.citations',{circleId}).items.length,1);
});

test('context-only demo contributions have insight, optional job link, stage and honest uncertainty',()=>{
 const post=read(createCircleKnowledgeDemo(),'demo-shared-opportunity').post,context=post.agentContext;
 assert.equal(post.content.body,'');
 assert.equal(context.jobUrl,'https://example.com/demo-job');
 assert.equal(context.stage,'Discovering');
 assert.equal(context.insight,post.content.insight);
 assert.match(context.uncertainty,/not a verified or open job/);
 assert.equal(context.experienceDate,null);
 assert.equal(context.sources.length,0);
});

test('context follows permitted revisions, keeps owned drafts private and never infers actions',()=>{
 const demo=createCircleKnowledgeDemo(),post=read(demo).post;
 assert.equal(circleAgentContext({...post,state:'withdrawn'}),null);
 assert.equal(circleAgentContext({...post,revision:2}),null);
 const draft=read(demo,'demo-review-draft').post;
 assert(draft.agentContext);
 assert.equal(draft.agentContext.visibility,'private_draft');
 assert.equal(circleAgentContext({...draft,owned:false}),null);
 const revised={...post,revision:2,publishedRevision:2,content:{...post.content,insight:'Graph questions came up.'}};
 const context=circleAgentContext(revised);
 assert.equal(context.source.revision,2);
 assert.equal(context.insight,'Graph questions came up.');
 context.sources.push({url:'https://example.com',label:'Changed'});
 assert.equal(post.content.sources.length,0);
 assert(!Object.hasOwn(context,'steps'));
});

test('demo accepts an insight without a message and rejects empty or private-link context',()=>{
 const demo=createCircleKnowledgeDemo();
 const content={title:'Useful context',body:'',insight:'Practice query plans.',jobUrl:'https://example.com/job',stage:'Technical',type:'interview_report',sources:[],provenance:'agent_observed',personalDisclosure:false};
 const result=demo.action('knowledge.propose',{circleId,expectedRevision:0,content,eventKey:'context'});
 const draft=read(demo,result.postId).post;
 assert.equal(draft.content.body,'');
 assert.equal(draft.content.insight,content.insight);
 for(const invalid of [{insight:''},{insight:42},{jobUrl:'http://example.com/job'},{jobUrl:'https://example.com/job?token=private'},{jobUrl:'https://user:secret@example.com/job'},{type:'reply'}]){
  assert.throws(()=>demo.action('knowledge.propose',{circleId,expectedRevision:0,content:{...content,...invalid}}));
 }
});

test('browser projection and scoped gateway/MCP reads expose the same context after authorized retrieval',async()=>{
 const post=read(createCircleKnowledgeDemo()).post;
 const raw={post,replies:[],nextCursor:null};
 delete post.agentContext;
 const browser=circleKnowledgeResponse('knowledge.read',raw);
 const gateway=contextResponse('knowledge.read',raw);
 assert.deepEqual(browser,gateway);
 assert(!Object.hasOwn(raw.post,'agentContext'));
 assert.deepEqual(circleKnowledgeResponse('knowledge.search',{items:[post],nextCursor:null}).items[0].agentContext,gateway.post.agentContext);
 assert.deepEqual(contextResponse('knowledge.search',{available:false}),{available:false});
 const operations=[];
 const handler=createHandler(async(token,operation)=>{
  operations.push(operation);
  if(operation==='credentials.verify')return {status:200,data:{scopes:['knowledge:read']}};
  return {status:200,data:contextResponse(operation,raw)};
 });
 const response=await handler(new Request('https://example.com/mcp',{method:'POST',headers:{Authorization:'Bearer jb_agent_'+'a'.repeat(64),'Content-Type':'application/json',Accept:'application/json, text/event-stream'},body:JSON.stringify({jsonrpc:'2.0',id:1,method:'tools/call',params:{name:'read_circle_thread',arguments:{circleId,postId:post.id}}})}));
 const packet=await response.json();
 assert.deepEqual(JSON.parse(packet.result.content[0].text),gateway);
 assert.deepEqual(operations,['credentials.verify','knowledge.read']);
 const denied=createHandler(async()=>({status:200,data:{scopes:[]}}));
 const rejection=await denied(new Request('https://example.com/mcp',{method:'POST',headers:{Authorization:'Bearer jb_agent_'+'a'.repeat(64),'Content-Type':'application/json',Accept:'application/json, text/event-stream'},body:JSON.stringify({jsonrpc:'2.0',id:1,method:'tools/call',params:{name:'read_circle_thread',arguments:{circleId,postId:post.id}}})}));
 assert.equal((await rejection.json()).result.isError,true);
});
