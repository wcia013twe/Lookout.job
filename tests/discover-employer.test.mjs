import test from 'node:test';
import assert from 'node:assert/strict';
import {discoverEmployerSchema,validateDiscoverEmployer} from '../supabase/functions/agent-gateway/discover-employer.mjs';
import {validateRequest} from '../supabase/functions/agent-gateway/contract.mjs';
import {TOOLS,createHandler} from '../supabase/functions/agent-mcp/protocol.mjs';
import {createTestDatabase} from './helpers/database.mjs';
import {readFile} from 'node:fs/promises';
const employer={company:'Fictional Systems',title:'Engineer',employmentType:'FT',location:'Remote',postedDate:null};
const batch=e=>({eventKey:'typed-batch',label:'Fictional typed roles',jobs:[{canonicalUrl:'https://example.com/jobs/typed',employer:e}]});
test('Muse gets explicit employer types, required facts and enums on tool discovery',()=>{
 const schema=TOOLS.find(t=>t.name==='publish_batch').inputSchema.properties.jobs.items.properties.employer;
 assert.deepEqual(schema,discoverEmployerSchema);
 assert.deepEqual(schema.properties.employmentType.enum,['FT','Internship']);
 assert.deepEqual(schema.required,['company','title','employmentType','location']);
 assert(Object.values(schema.properties).every(p=>p.type),'No untyped employer fields');
 assert.equal(schema.additionalProperties,false);
});
test('publication accepts typed facts and normalizes known labels without guessing',()=>{
 for(const value of ['FT','Full-time','full time','FULL_TIME',' ft '])assert.equal(validateDiscoverEmployer({...employer,employmentType:value}).employmentType,'FT');
 assert.equal(validateDiscoverEmployer({...employer,employmentType:'Internship'}).employmentType,'Internship');
 const payload=batch({...employer,employmentType:'Full-time'});
 assert.equal(validateRequest({operation:'batches.publish',payload}).payload.jobs[0].employer.employmentType,'FT');
 for(const patch of [{employmentType:'Contract'},{employmentType:null},{location:[]},{company:''},{title:99},{postedDate:'2026-02-30'},{deadline:'yesterday'},{locations:['Remote',5]},{location:'x'.repeat(1001)},{personalFit:'secret'}])assert.throws(()=>validateDiscoverEmployer({...employer,...patch}));
 for(const key of discoverEmployerSchema.required){const value={...employer};delete value[key];assert.throws(()=>validateDiscoverEmployer(value),new RegExp(`employer.${key}`));}
});
test('MCP rejects malformed card fields before dispatch and shares canonical publication validation',async()=>{
 const writes=[];
 const handler=createHandler(async(_token,operation,payload)=>{if(operation==='credentials.verify')return {status:200,data:{scopes:['batches:write']}};validateRequest({operation,payload});writes.push({operation,payload});return {status:200,data:{saved:true}};});
 const call=async payload=>{
  const res=await handler(new Request('http://local/mcp',{method:'POST',headers:{Authorization:'Bearer jb_agent_'+'a'.repeat(64),'Content-Type':'application/json',Accept:'application/json, text/event-stream'},body:JSON.stringify({jsonrpc:'2.0',id:1,method:'tools/call',params:{name:'publish_batch',arguments:payload}})}));
  return res.json();
 };
 const rejected=await call(batch({...employer,employmentType:'Contract'}));
 assert.match(JSON.stringify(rejected),/Invalid tool arguments/);assert.equal(writes.length,0);
 await call(batch({...employer,employmentType:'Full-time'}));
 assert.equal(writes.length,1);assert.equal(writes[0].payload.jobs[0].employer.employmentType,'FT');
});
test('SQL publication enforces the same types, rolls back failures and keeps saved aliases actionable',async()=>{
 const db=await createTestDatabase();
 try{
  for(const input of [employer,{...employer,employmentType:'Full-time'},{...employer,employmentType:'Internship'}]){
   const {rows}=await db.query('select private.normalize_discover_employer($1) value',[input]);
   assert.deepEqual(rows[0].value,validateDiscoverEmployer(input));
  }
  for(const patch of [{employmentType:'Contract'},{employmentType:null},{location:[]},{title:3},{postedDate:'2026-02-30'},{locations:[1]}])await assert.rejects(db.query('select private.normalize_discover_employer($1)',[{...employer,...patch}]));
  await db.exec(await readFile(new URL('./typed-discover-employer-check.sql',import.meta.url),'utf8'));
 }finally{await db.close();}
});
test('upgrade repairs only known saved aliases and preserves personal history and unknown facts',async()=>{
 const db=await createTestDatabase({beforeMigration:async(db,name)=>{
  if(name!=='20261110084338_typed_discover_employer.sql')return;
  await db.exec(`insert into public.jobs(id,canonical_url,employer) values('typed-legacy','https://example.com/legacy','{"company":"Fictional","title":"Engineer","employmentType":"Full-time","location":"Remote"}'),('typed-unknown','https://example.com/unknown','{"company":"Fictional","title":"Unknown role","location":"Remote"}');
   insert into public.applications(user_id,job_id,status,draft,receipt) values('11111111-1111-1111-1111-111111111111','typed-legacy','Queued','{"note":"Preserve personal work"}','{"note":"Preserve evidence"}'); update public.applications set status='Submitted' where job_id='typed-legacy';`);
 }});
 try{
  const {rows}=await db.query("select employer->>'employmentType' type from public.jobs where id='typed-legacy'");assert.equal(rows[0].type,'FT');
  assert.equal((await db.query("select employer ? 'employmentType' present from public.jobs where id='typed-unknown'")).rows[0].present,false);
  const app=(await db.query("select status,revision,draft,receipt from public.applications where job_id='typed-legacy'")).rows[0];assert.deepEqual(app,{status:'Submitted',revision:0,draft:{note:'Preserve personal work'},receipt:{note:'Preserve evidence'}});
 }finally{await db.close();}
});
test('detached Discover demo cards use the same typed public facts and remain isolated',async()=>{
 const {demoFixtures}=await import('../next-app/lib/demo.mjs');
 const fixture=demoFixtures('2026-11-10'),before=structuredClone(fixture);
 for(const role of fixture.roles)assert.deepEqual(validateDiscoverEmployer({company:role.company,title:role.title,employmentType:role.employmentType,location:role.location||''}),{company:role.company,title:role.title,employmentType:role.employmentType,location:role.location||''});
 assert.deepEqual(fixture,before);
});
