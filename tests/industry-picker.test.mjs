import test from 'node:test';
import assert from 'node:assert/strict';
import {industryOptions,parseIndustries,toggleIndustry} from '../lib/industries.mjs';
import {readField,updateField,profileFromPrompt,promptFromProfile} from '../lib/search-profile.mjs';
import {demoFixtures} from '../next-app/lib/demo.mjs';

test('industry taxonomy has the exact 31 choices and reads legacy case without adding aliases',()=>{
 assert.equal(industryOptions.length,31);
 assert.equal(new Set(industryOptions).size,31);
 assert.equal(industryOptions[0],'Aerospace');assert.equal(industryOptions.at(-1),'VR & AR');
 assert.deepEqual(parseIndustries(' ai & machine learning, FINTECH, fintech, Enterprise Software\nData & Analytics, Cloud/devtools; research '),['AI & Machine Learning','Fintech','Enterprise Software','Data & Analytics','Cloud/devtools; research']);
 assert(!industryOptions.includes('Cloud/devtools; research'));
 assert.deepEqual(parseIndustries(' , \n '),[]);
});
test('industry toggles retain custom values, permit clearing all selections, and do not change priority or other fields',()=>{
 const original='Custom introductory prose.\n## Company preferences\n- Company size: 11–50, 1,001–5,000\n- Industries: AI & Machine Learning, Cloud infrastructure\n## Priority & flexibility\n- Industries: Required\n## Application answers\n- Earliest start date: 2027-06-01';
 const edit=industry=>prompt=>updateField(prompt,'Company preferences','Industries',toggleIndustry(readField(prompt,'Company preferences','Industries').value,industry));
 const next=edit('Data & Analytics')(original);
 assert.equal(readField(next,'Company preferences','Industries').value,'AI & Machine Learning, Cloud infrastructure, Data & Analytics');
 assert.equal(readField(next,'Priority & flexibility','Industries').value,'Required');
 assert.equal(next.replace('AI & Machine Learning, Cloud infrastructure, Data & Analytics','AI & Machine Learning, Cloud infrastructure'),original);
 assert.equal(edit('Data & Analytics')(next),original);
 const cleared=edit('Cloud infrastructure')(edit('AI & Machine Learning')(original));
 assert.equal(readField(cleared,'Company preferences','Industries').value,'');
 assert.equal(readField(cleared,'Priority & flexibility','Industries').value,'Required');
 assert.deepEqual(profileFromPrompt(promptFromProfile(profileFromPrompt(next))),profileFromPrompt(next));
 assert.throws(()=>edit('Fintech')('## Company preferences\n- Industries: Design\n- Industries: Energy'),/duplicate/);
});
test('demo industries include selected standard/custom options and reset independently',()=>{
 const a=demoFixtures('2026-11-07'),b=demoFixtures('2026-11-07');
 const profile=a.state.workflow.searchPreferences.profiles[0];
 const prompt=promptFromProfile(profile);
 assert.deepEqual(parseIndustries(readField(prompt,'Company preferences','Industries').value),['AI & Machine Learning','Data & Analytics','Enterprise Software','Research tools (demo)']);
 assert.equal(readField(prompt,'Priority & flexibility','Industries').value,'Preferred');
 profile.instructions='Changed only in this fixture';
 assert.notEqual(b.state.workflow.searchPreferences.profiles[0].instructions,profile.instructions);
});
test('website and native MCP save industry strings through the same versioned owner boundary',async()=>{
 const {createTestDatabase}=await import('./helpers/database.mjs');
 const {createHandler}=await import('../supabase/functions/agent-mcp/protocol.mjs');
 const {validateRequest,hashToken}=await import('../supabase/functions/agent-gateway/contract.mjs');
 const db=await createTestDatabase();
 const token='jb_agent_'+'c'.repeat(64),hash=await hashToken(token),owner='11111111-1111-1111-1111-111111111111';
 try{
  await db.query("insert into private.agent_connections(user_id,name,token_hash,scopes,expires_at) values($1,'Industry fixture',$2,array['workspace:read','preferences:write'],now()+interval '1 hour')",[owner,hash]);
  const transport=createHandler(async(_token,operation,payload)=>{try{validateRequest({operation,payload});return {status:200,data:(await db.query('select public.agent_dispatch($1,$2,$3) data',[hash,operation,payload])).rows[0].data};}catch(e){return {status:e.code==='40001'?409:400,error:e.message};}});
  let prompt='## Company preferences\n- Industries: AI & Machine Learning, Data & Analytics, Enterprise Software, Financial Services, Fintech, Robotics & Automation\n- Company size: 11–50\n## Priority & flexibility\n- Industries: Preferred';
  const profile=profileFromPrompt(prompt);
  const res=await transport(new Request('http://localhost/mcp',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json',Accept:'application/json, text/event-stream'},body:JSON.stringify({jsonrpc:'2.0',id:1,method:'tools/call',params:{name:'save_search_profile',arguments:{expectedVersion:0,profile}}})}));
  const body=await res.json();assert(!body.error,JSON.stringify(body));assert(!body.result.isError,JSON.stringify(body));
  const saved=body.result.structuredContent||JSON.parse(body.result.content[0].text);
  assert.equal(saved.instructions,profile.instructions);
  await db.query("select set_config('test.uid',$1,false)",[owner]);
  prompt=updateField(prompt,'Company preferences','Industries',toggleIndustry(readField(prompt,'Company preferences','Industries').value,'Fintech'));
  const updated=(await db.query('select public.save_search_profile($1,$2) data',[1,profileFromPrompt(prompt)])).rows[0].data;
  assert.equal(readField(updated.instructions,'Priority & flexibility','Industries').value,'Preferred');
  assert(!parseIndustries(readField(updated.instructions,'Company preferences','Industries').value).includes('Fintech'));
  await assert.rejects(db.query('select public.save_search_profile($1,$2)',[1,profile]),/changed|version/i);
  await db.query("select set_config('test.uid',$1,false)",['22222222-2222-2222-2222-222222222222']);
  await assert.rejects(db.query('select public.save_search_profile($1,$2)',[2,profile]),/changed|version/i);
 }finally{await db.close();}
});
