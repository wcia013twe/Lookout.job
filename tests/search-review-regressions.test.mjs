import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createTestDatabase} from './helpers/database.mjs';
import {profileDocument} from '../lib/search/documents.mjs';
import {runCareerTool} from '../runner/career-tools.mjs';

test('selected context stays small and cross-profile sweeps retain their own evidence',async()=>{
 const db=await createTestDatabase();
 const owner='11111111-1111-1111-1111-111111111111',hash='d'.repeat(64);
 const call=async(operation,payload)=>(await db.query('select public.agent_dispatch($1,$2,$3) data',[hash,operation,payload])).rows[0].data;
 try{
  await db.query("insert into private.agent_connections(user_id,name,token_hash,scopes,expires_at) values($1,'Review regression',$2,array['workspace:read','drafts:write','preferences:write'],now()+interval '1 hour')",[owner,hash]);
  // Exercise the same database role as the deployed gateway, not the test superuser.
  await db.exec('alter role service_role bypassrls; set role service_role');
  for(const id of ['backend','internships'])await call('search.document.save',{kind:'profile',id,expectedVersion:0,eventKey:id,content:profileDocument({id,name:id,active:true,filters:{},priorities:{},instructions:id==='internships'?'INTERN_ONLY_MARKER':'Backend preferences'})});
  await call('search.document.save',{kind:'portals',id:'shared',expectedVersion:0,eventKey:'sources',content:JSON.stringify({tracked_companies:[{id:'example',name:'Example',kind:'careers',careers_url:'https://example.com/jobs',enabled:true}],search_queries:[]})});
  const ctx=await call('search.context',{profileId:'backend'});
  assert.deepEqual(ctx.documents.filter(d=>d.kind==='profile').map(d=>d.id),['backend']);
  assert.equal(ctx.profiles.length,2);assert(!JSON.stringify(ctx).includes('INTERN_ONLY_MARKER'));
  const a=await call('search.run.start',{profileId:'backend',eventKey:'a'}),b=await call('search.run.start',{profileId:'internships',eventKey:'b'});
  assert(!JSON.stringify(a.context_snapshot).includes('INTERN_ONLY_MARKER'));
  await call('search.document.save',{kind:'profile',id:'internships',expectedVersion:1,eventKey:'other-edit',content:profileDocument({id:'internships',name:'internships',active:true,filters:{},priorities:{},instructions:'Edited unrelated preferences'})});
  assert.equal((await call('search.run.read',{runId:a.id})).contextChanged,false);
  assert.equal((await call('search.run.read',{runId:b.id})).contextChanged,true);
  const summaries=await call('search.run.read',{});assert(summaries.every(r=>!Object.hasOwn(r,'context_snapshot')));
  const obs={sourceId:'portal:example',url:'https://example.com/jobs/1',company:'Example',title:'Engineer',location:'New York',checkedAt:new Date().toISOString(),liveness:'active',evidence:'Backend fixture evidence',employerPostedAt:null,sourceListAgeDays:null,description:'Fixture JD'};
  const saved=await call('search.discoveries.save',{runId:a.id,listings:[obs],eventKey:'obs-a'}),listingId=saved.saved[0].listingId;
  await call('search.screening.save',{runId:a.id,listingId,expectedVersion:0,decision:'review-needed',checks:[],explanation:'Backend needs review',eventKey:'screen-a'});
  await call('search.discoveries.save',{runId:b.id,listings:[{...obs,checkedAt:new Date(Date.now()+1000).toISOString(),liveness:'expired',evidence:'Expired in internship sweep'}],eventKey:'obs-b'});
  await call('search.screening.save',{runId:b.id,listingId,expectedVersion:1,decision:'ineligible',checks:[],explanation:'Internship mismatch',eventKey:'screen-b'});
  const page=await call('search.discoveries.read',{runId:a.id});const listing=page.listings[0];
  assert.equal(listing.screening.run_id,a.id);assert.equal(listing.observation.run_id,a.id);assert.equal(listing.screening.decision,'review-needed');assert.equal(listing.observation.liveness,'active');assert.equal(listing.screeningVersion,2);assert(listing.screenings.every(s=>s.run_id===a.id));
  assert.equal((await call('search.discoveries.read',{runId:a.id,decision:'ineligible'})).listings.length,0);
  assert.equal((await call('search.discoveries.read',{})).listings[0].screening.decision,'ineligible');
  // One backend transaction saves canonical routing and its retry receipt.
  const p={kind:'source_config',eventKey:'configure',result:{targetId:'example',provider:'greenhouse',options:{api:'https://example.com/api'}}};
  const receipt=await call('toolkit.record',p);
  let portals=(await call('search.context',{profileId:'backend'})).documents.find(d=>d.kind==='portals');const version=portals.version;
  assert.equal(portals.projection.tracked_companies[0].provider,'greenhouse');assert.deepEqual(await call('toolkit.record',p),receipt);
  portals=(await call('search.context',{profileId:'backend'})).documents.find(d=>d.kind==='portals');assert.equal(portals.version,version);
  await assert.rejects(call('toolkit.record',{kind:'source_config',eventKey:'bad-config',result:{targetId:'example',provider:'x'.repeat(101),options:{}}}));
  assert.equal((await call('toolkit.results',{eventKey:'bad-config'})).length,0);
  assert.equal((await call('search.context',{profileId:'backend'})).documents.find(d=>d.kind==='portals').version,version);
 }finally{await db.close();}
});

test('local configuration recovers a lost response through its single write receipt',async()=>{
 let stored=null,writes=0;
 const gateway={call:async(op,p)=>{
  if(op==='toolkit.results')return stored?[stored]:[];
  if(op==='toolkit.context')return {preferences:{search:{targets:[{id:'example'}]}}};
  if(op==='toolkit.record'){writes++;stored={event_key:p.eventKey,result:p.result};throw Error('Lost response after atomic commit');}
  assert.fail(`Unexpected extra configuration operation: ${op}`);
 }};
 const p={targetId:'example',provider:'greenhouse',eventKey:'configure'};
 await assert.rejects(runCareerTool('local.career.configure',p,{gateway,execute:async()=>[{id:'greenhouse'}]}),/Lost response/);
 assert((await runCareerTool('local.career.configure',p,{gateway,execute:()=>assert.fail('Replay must not execute')})).replayed);
 assert.equal(writes,1);
});
