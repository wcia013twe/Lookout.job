import test from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {createTestDatabase} from './helpers/database.mjs';
import {databaseStore} from '../backend/intelligence/store.ts';
import {ingest} from '../backend/intelligence/pipeline.ts';
import {ingestionService,httpServer} from '../backend/intelligence/service.ts';
import {GRAPH_TOOL} from '../backend/intelligence/evidence-graph.ts';
import {backendClient,mcpHandler} from '../backend/intelligence/mcp.ts';
const A='11111111-1111-1111-1111-111111111111',B='22222222-2222-2222-2222-222222222222';
function candidate(id,circle='circle-a') {return {identities:[],sourceCircleId:circle,observation:{sourceType:'circle_post',sourceId:id,sourceRevision:1,title:`Fictional ${id}`,company:'Bloomberg',role:'New Grad',stage:'technical',insight:`Fictional evidence ${id}`,experienceDate:null,provenance:'unknown',uncertainty:'Unverified fictional report'}};}
test('graph service resolves only current same-circle owned sources and shares HTTP/MCP behavior',async()=>{
 const db=await createTestDatabase();let server;
 try{
  const query=(s,v)=>db.query(s,v),target={kind:'account',ownerId:A},store=databaseStore(query,target);
  const root=candidate('root'),guide=candidate('guide'),wrong=candidate('wrong-circle','circle-b'),foreign=candidate('foreign');
  root.observation.postReferences=[{circleId:'circle-a',postId:'guide',revision:1,label:'Attached guide'},{circleId:'circle-a',postId:'wrong-circle',revision:null,label:'Wrong circle'},{circleId:'circle-a',postId:'foreign',revision:null,label:'Private target'},{circleId:'circle-a',postId:'missing-target',revision:null,label:'Unavailable'}];
  guide.observation.resourceLinks=[{url:'https://example.com/fictional-guide',label:'Fictional guide'}];
  let sources=[root,guide,wrong,foreign];
  assert.equal((await ingest(store,undefined,[root,guide,wrong])).failed,0);
  await ingest(databaseStore(query,{kind:'account',ownerId:B}),undefined,[foreign]);
  const call=ingestionService({query},{model:'forbidden',async embed(){throw Error('UNEXPECTED_EMBEDDING');}},async()=>sources,target);
  const args={seeds:[{sourceType:'circle_post',sourceId:'root'}],maxDepth:2};
  let result=await call(GRAPH_TOOL,args),encoded=JSON.stringify(result);
  assert(encoded.includes('Fictional guide'));assert(encoded.includes('https://example.com/fictional-guide'));
  for(const id of ['wrong-circle','foreign','missing-target'])assert(!encoded.includes(id),id);
  assert(!encoded.includes('embedding_text'));assert(!encoded.includes('recommends'));
  guide.observation.sourceRevision=2;await ingest(store,undefined,[guide]);
  encoded=JSON.stringify(await call(GRAPH_TOOL,args));assert(!encoded.includes('Fictional guide'),'pinned revision mismatch must not resolve');
  root.observation.sourceRevision=2;root.observation.postReferences[0].revision=null;await ingest(store,undefined,[root]);
  assert(JSON.stringify(await call(GRAPH_TOOL,args)).includes('Fictional guide'));
  sources=sources.filter(c=>c.observation.sourceId!=='guide');
  assert(!JSON.stringify(await call(GRAPH_TOOL,args)).includes('Fictional guide'));
  sources=[root];
  server=httpServer(call);server.listen(0,'127.0.0.1');await once(server,'listening');
  const mcp=mcpHandler(backendClient(`http://127.0.0.1:${server.address().port}`));
  const reply=await mcp({jsonrpc:'2.0',id:1,method:'tools/call',params:{name:GRAPH_TOOL,arguments:args}});
  assert.deepEqual(JSON.parse(reply.result.content[0].text),JSON.parse(JSON.stringify(await call(GRAPH_TOOL,args))));
  const invalid=await mcp({jsonrpc:'2.0',id:2,method:'tools/call',params:{name:GRAPH_TOOL,arguments:{...args,ownerId:B}}});
  assert.equal(invalid.result.isError,true);
 }finally{if(server)await new Promise(resolve=>server.close(resolve));await db.close();}
});
