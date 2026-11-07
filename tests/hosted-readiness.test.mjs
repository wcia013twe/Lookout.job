import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {createHostedTestDatabase,hostedSchemaInventory} from './helpers/hosted-schema.mjs';

const migrationDir=new URL('../supabase/migrations/',import.meta.url);
const snapshot=JSON.parse(await readFile(new URL('./fixtures/hosted-lookout-20261107.json',import.meta.url),'utf8'));

test('current Lookout hosted history upgrades to the complete source schema without changing owned data',async()=>{
 const files=(await readdir(migrationDir)).filter(f=>f.endsWith('.sql')).sort();
 assert.equal(snapshot.applied.length,80);
 for(const file of snapshot.applied)assert.ok(files.includes(file),file);
 const fresh=await createHostedTestDatabase();
 let expected;
 try{expected=await hostedSchemaInventory(fresh);}finally{await fresh.close();}
 const upgraded=await createHostedTestDatabase({migrationFiles:snapshot.applied});
 try{
  await upgraded.exec(`
   insert into auth.users values('33333333-3333-3333-3333-333333333333');
   insert into public.profiles(user_id,facts) values('33333333-3333-3333-3333-333333333333','{"name":"Fictional upgrade account"}');
   insert into private.agent_connections(user_id,name,token_hash,scopes,expires_at)
   values('33333333-3333-3333-3333-333333333333','Fictional upgrade connection',repeat('a',64),array['workspace:read'],now()+interval '1 day');
   create function public.rls_auto_enable() returns event_trigger language plpgsql security definer set search_path=pg_catalog as $$ begin return;end $$;
  `);
  const owned=async()=>({profiles:(await upgraded.query('select * from public.profiles order by user_id')).rows,connections:(await upgraded.query('select * from private.agent_connections order by id')).rows});
  const before=await owned();
  assert.equal((await upgraded.query("select has_function_privilege('anon','public.rls_auto_enable()','execute') as allowed")).rows[0].allowed,true);
  assert.equal((await upgraded.query("select has_table_privilege('authenticated','public.career_toolkit_results','TRUNCATE') as allowed")).rows[0].allowed,true,'Fixture must reproduce the hosted default-grant bug');
  for(const file of files.filter(f=>!snapshot.applied.includes(f)))await upgraded.exec(await readFile(new URL(file,migrationDir),'utf8'));
  assert.deepEqual(await owned(),before,'Upgrade must not rewrite account data, credentials, versions or consent');
  assert.deepEqual(await hostedSchemaInventory(upgraded),expected,'Columns, constraints, RLS, policies, grants, indexes, views, triggers and functions must converge');
  for(const role of ['anon','authenticated'])assert.equal((await upgraded.query("select has_function_privilege($1,'public.rls_auto_enable()','execute') as allowed",[role])).rows[0].allowed,false);
  for(const role of ['anon','authenticated'])for(const privilege of ['INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER'])assert.equal((await upgraded.query("select has_table_privilege($1,'public.career_toolkit_results',$2) as allowed",[role,privilege])).rows[0].allowed,false);
  assert.equal((await upgraded.query("select has_table_privilege('authenticated','public.career_toolkit_results','SELECT') as allowed")).rows[0].allowed,true);
  const unsafeBrowserGrants=(await upgraded.query(`select n.nspname,c.relname,r.role_name,p.privilege
   from pg_class c join pg_namespace n on n.oid=c.relnamespace
   cross join (values ('anon'),('authenticated')) r(role_name)
   cross join (values ('TRUNCATE'),('REFERENCES'),('TRIGGER')) p(privilege)
   where n.nspname in ('public','private','intelligence_demo') and c.relkind in ('r','p')
   and has_table_privilege(r.role_name,c.oid,p.privilege)`)).rows;
  assert.deepEqual(unsafeBrowserGrants,[],'Browser roles must never gain table-wide administrative privileges from hosted defaults');
  assert.ok((await upgraded.query("select pg_get_functiondef('public.rls_auto_enable()'::regprocedure) as definition")).rows[0].definition.includes('RETURNS event_trigger'));
  for(const scenario of ['simplify-import','discover-removal','agent-connections','profile-edit-flow','search-sweeps']){
   const copy=await upgraded.clone();
   try{await copy.exec(await readFile(new URL(`./${scenario}-check.sql`,import.meta.url),'utf8'));}finally{await copy.close();}
  }
 }finally{await upgraded.close();}
});
