import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {load} from 'js-yaml';
import {defaultPortals,parseDocument,portalsDocument} from '../lib/search/documents.mjs';
import {orderedSearchSources} from '../backend/runtime/worker.ts';
import {providerCatalog} from '../runner/career-worker.mjs';
import {createTestDatabase} from './helpers/database.mjs';

test('shared default consolidates all copied portals, provider hints and query templates without personal targeting',async()=>{
 const upstream=load(await readFile(new URL('../runner/vendor/career-ops/templates/portals.example.yml',import.meta.url),'utf8'));
 assert.equal(defaultPortals.tracked_companies.length,6+upstream.tracked_companies.length+upstream.job_boards.length);
 assert.equal(defaultPortals.query_templates.length,upstream.search_queries.length);
 for(const source of [...upstream.tracked_companies,...upstream.job_boards]){
  const stored=defaultPortals.tracked_companies.find(s=>s.name===source.name);
  assert(stored,source.name);assert.equal(stored.enabled,source.enabled!==false);
  if(source.provider)assert.equal(stored.provider,source.provider);
  if(source.api)assert.equal(stored.api,source.api);
  if(source.notes)assert.equal(stored.notes,source.notes);
  for(const key of Object.keys(stored.config||{}))assert.deepEqual(stored.config[key],source[key]);
 }
 assert.deepEqual(defaultPortals.search_queries,[]);
 assert.equal(defaultPortals.title_filter,undefined);assert.equal(defaultPortals.location_filter,undefined);
 assert.deepEqual(parseDocument('portals',portalsDocument(defaultPortals)).projection,defaultPortals);
 const providers=await providerCatalog();assert(providers.length>50);assert(providers.some(p=>p.id==='ashby'));assert(providers.some(p=>p.id==='getro'));
});

test('defaults keep aggregates first and order the full employer catalog deterministically',()=>{
 const sources=defaultPortals.tracked_companies.filter(s=>s.enabled).map(source=>({source,source_id:'portal:'+source.id}));
 const a=orderedSearchSources(sources,'run-a'),b=orderedSearchSources(sources,'run-b');
 assert.deepEqual(a.slice(0,6).map(s=>s.source.id).sort(),['hiringcafe','jobright-internship','jobright-newgrad','simplify-newgrad','simplify-offseason','simplify-summer']);
 assert.deepEqual(a,orderedSearchSources([...sources].reverse(),'run-a'));
 assert.notDeepEqual(a.slice(6,12),b.slice(6,12));assert.equal(a.length,sources.length);
});

test('SQL and browser/MCP defaults match and the entire document can be customized with current versions',async()=>{
 const db=await createTestDatabase();const owner='11111111-1111-1111-1111-111111111111';
 try{
  const sql=(await db.query('select private.default_search_portals() as p')).rows[0].p;
  assert.deepEqual(sql,defaultPortals);
  const saved=(await db.query("select private.write_search_document($1,'portals','shared',0,$2) as p",[owner,portalsDocument(defaultPortals)])).rows[0].p;
  assert.equal(saved.version,1);assert.deepEqual(saved.projection,defaultPortals);
  const custom=structuredClone(defaultPortals);custom.tracked_companies[0].enabled=false;
  await db.query("select private.write_search_document($1,'portals','shared',1,$2)",[owner,portalsDocument(custom)]);
  const context=(await db.query("select private.search_owned($1,'search.context','{}') as c",[owner])).rows[0].c;
  assert.equal(context.documents.find(d=>d.kind==='portals').projection.tracked_companies[0].enabled,false);
  const bad=structuredClone(custom);bad.tracked_companies[0].config={command:'must never execute'};
  assert.throws(()=>parseDocument('portals',portalsDocument(bad)),/configuration/);
  await assert.rejects(()=>db.query("select private.write_search_document($1,'portals','shared',2,$2)",[owner,portalsDocument(bad)]),/configuration/);
 }finally{await db.close();}
});
