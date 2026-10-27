import test from 'node:test';
import assert from 'node:assert/strict';
import {expandEvidenceGraph,validateGraphArgs,GRAPH_TOOL_DESCRIPTOR} from '../backend/intelligence/evidence-graph.ts';
const ref=(id,revision=null,circleId='circle-one')=>({circleId,postId:id,revision,label:`Mention ${id}`});
const report=(id,extra={})=>({source_type:'circle_post',source_id:id,source_revision:1,title:`Fictional ${id}`,insight:'Candidate reported a coding discussion.',company:'Bloomberg',role:'New Grad',stage:'Technical',experience_date:null,provenance:'unknown',uncertainty:'Fictional individual report, not employer policy.',post_references:[],resource_links:[],...extra});

test('graph expands explicit evidence with revision provenance, uncertainty and safe projections',async()=>{
 const a=report('a',{post_references:[ref('b'),ref('b')],resource_links:[{url:'https://example.com/guide',label:'Guide'},{url:'https://example.com/guide',label:'Same guide'}],embedding:[1],owner_id:'private-owner'});
 const b=report('b',{resource_links:[{url:'https://example.com/guide',label:'Guide'}]});
 const graph=await expandEvidenceGraph([a],async r=>r.postId==='b'?b:null,{maxDepth:2});
 assert.equal(graph.nodes.length,3);assert.equal(graph.edges.length,3);
 assert.deepEqual(new Set(graph.edges.map(e=>e.kind)),new Set(['references_post','attached_resource']));
 assert.equal(graph.nodes.find(n=>n.sourceId==='b').uncertainty,b.uncertainty);
 assert.deepEqual(graph.edges[0].evidence,{sourceType:'circle_post',sourceId:'a',sourceRevision:1});
 assert(!JSON.stringify(graph).includes('recommends'));assert(!JSON.stringify(graph).includes('owner_id'));assert(!JSON.stringify(graph).includes('embedding'));assert(!JSON.stringify(graph).includes('post_references'));
});

test('private, withdrawn, wrong-target and pinned revision mismatches never expose target identifiers',async()=>{
 const a=report('a',{post_references:[ref('private-id'),ref('withdrawn-id'),ref('wrong-id'),ref('old-revision',1),ref('wrong-type')]});
 const graph=await expandEvidenceGraph([a],async r=>r.postId==='wrong-id'?report('different-id'):r.postId==='old-revision'?report('old-revision',{source_revision:2}):r.postId==='wrong-type'?report('wrong-type',{source_type:'application_update'}):null);
 assert.equal(graph.nodes.length,1);assert.equal(graph.edges.length,0);
 const serialized=JSON.stringify(graph);for(const id of ['private-id','withdrawn-id','wrong-id','different-id','old-revision','wrong-type'])assert(!serialized.includes(id));
 assert.deepEqual(graph.truncated,{depth:false,nodes:false,edges:false,lookups:false});
});

test('cycles and duplicate seeds/references are bounded and depth limits stop expansion',async()=>{
 const a=report('a',{post_references:[ref('b'),ref('b')]}),b=report('b',{post_references:[ref('a'),ref('c')]}),c=report('c',{post_references:[ref('d')]});
 const docs={a,b,c,d:report('d')};let calls=0;
 const graph=await expandEvidenceGraph([a,a],async r=>{calls++;return docs[r.postId]??null;},{maxDepth:2});
 assert.equal(graph.nodes.length,3);assert.equal(graph.edges.length,3);assert.equal(calls,3);assert.equal(graph.truncated.depth,true);
 const one=await expandEvidenceGraph([a],async r=>docs[r.postId]??null,{maxDepth:1});
 assert.equal(one.nodes.length,2);assert.equal(one.edges.length,1);assert.equal(one.truncated.depth,true);
});

test('node, edge and lookup budgets bound work without fetching resource URLs',async()=>{
 const links=Array.from({length:32},(_,i)=>({url:`https://example.com/guide-${i}`,label:'Guide'}));
 const small=await expandEvidenceGraph([report('a',{resource_links:links})],async()=>{throw Error('Unexpected resolver');},{maxNodes:2});
 assert.equal(small.nodes.length,2);assert.equal(small.edges.length,1);assert.equal(small.truncated.nodes,true);
 const shared=links.slice(0,10),seeds=Array.from({length:10},(_,i)=>report(`seed-${i}`,{resource_links:shared}));
 const capped=await expandEvidenceGraph(seeds,async()=>null,{maxNodes:30});assert.equal(capped.edges.length,50);assert.equal(capped.truncated.edges,true);
 let calls=0;const denied=Array.from({length:10},(_,i)=>report(`seed-${i}`,{post_references:Array.from({length:32},(_,j)=>ref(`private-${i}-${j}`))}));
 const budget=await expandEvidenceGraph(denied,async()=>{calls++;return null;});assert.equal(calls,100);assert.equal(budget.truncated.lookups,true);assert.equal(budget.edges.length,0);assert(!JSON.stringify(budget).includes('private-'));
});

test('unsafe resource targets are omitted, resolver failures fail closed and changed versions reject',async()=>{
 const a=report('a',{resource_links:[{url:'http://127.0.0.1/private',label:'Private'},{url:'https://example.com/file?token=secret',label:'Signed'},{url:'javascript:alert(1)',label:'Script'}]});
 assert.equal((await expandEvidenceGraph([a],async()=>null)).nodes.length,1);
 const b=report('b',{post_references:[ref('c')]});
 await assert.rejects(()=>expandEvidenceGraph([b],async()=>{throw Error('SOURCE_UNAVAILABLE');}),/SOURCE_UNAVAILABLE/);
 await assert.rejects(()=>expandEvidenceGraph([report('a'),report('a',{source_revision:2})],async()=>null),/SOURCE_CHANGED_DURING_GRAPH/);
});

test('typed tool arguments are strict and do not accept caller-provided permissions or graph data',()=>{
 assert.equal(GRAPH_TOOL_DESCRIPTOR.name,'expand_demo_intelligence_evidence');
 const seed={sourceType:'application_update',sourceId:'communication:one'};
 assert.deepEqual(validateGraphArgs({seeds:[seed]}),{seeds:[seed],maxDepth:1,maxNodes:30});
 for(const args of [{seeds:[]},{seeds:[seed,seed]},{seeds:[{...seed,sourceType:'private'}]},{seeds:[seed],ownerId:'foreign'},{seeds:[seed],maxDepth:3},{seeds:[seed],maxNodes:31},{seeds:[seed],maxNodes:1.5},{seeds:[seed],maxDepth:null},{seeds:[seed],maxNodes:null}])assert.throws(()=>validateGraphArgs(args));
});
