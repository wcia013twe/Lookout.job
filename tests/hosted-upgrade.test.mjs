import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {createTestDatabase} from './helpers/database.mjs';
const migrationDir=new URL('../supabase/migrations/',import.meta.url);
const {applied}=JSON.parse(await readFile(new URL('./fixtures/hosted-migration-order.json',import.meta.url),'utf8'));
const files=(await readdir(migrationDir)).filter(f=>f.endsWith('.sql')).sort();
const definitions=async db=>(await db.query("select n.nspname||'.'||p.proname||'('||pg_get_function_identity_arguments(p.oid)||')' as id,pg_get_functiondef(p.oid) as definition,p.proacl::text as permissions from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','private') order by 1")).rows;
test('hosted upgrade converges to fresh schema without regressing connections, settings or task routing',async()=>{
 assert.equal(new Set(applied).size,applied.length);for(const file of applied)assert.ok(files.includes(file),file);
 const fresh=await createTestDatabase();let expected;try{expected=await definitions(fresh);}finally{await fresh.close();}
 const upgraded=await createTestDatabase({migrationFiles:[...applied,...files.filter(f=>!applied.includes(f))]});
 try{
  assert.deepEqual(await definitions(upgraded),expected,'Function definitions and execution grants must match a fresh deployment');
  for(const scenario of ['agent-connections','onboarding','card-packs','agent-workflows','schema-evolution','search-sweeps']){
   try{await upgraded.exec(await readFile(new URL(`./${scenario}-check.sql`,import.meta.url),'utf8'));}finally{await upgraded.exec("rollback; reset role; set test.uid='';");}
  }
 }finally{await upgraded.close();}
});
