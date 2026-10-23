import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {build} from 'esbuild';
import {DEMO_MODE_KEY,resolveDemoMode,navigateWorkspaceMode} from '../next-app/lib/workspace-mode.mjs';
import {createDetachedDemo} from '../next-app/lib/demo-runtime.mjs';
const fixturesDate='2026-10-23';
const presets=JSON.parse(await readFile(new URL('../data/tierlist-presets.json',import.meta.url),'utf8'));
function storage() {const values=new Map();return {getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k),values};}
async function models(){
 const context={window:{JB:{}},Date,Math,crypto:globalThis.crypto};
 for(const name of ['workflow-model','saved-answers-model','tierlist-model'])vm.runInNewContext(await readFile(new URL(`../lib/${name}.js`,import.meta.url),'utf8'),context);
 context.window.JB.tierlistModel.configure(presets);return context.window.JB;
}
test('demo entry has no account dependency and keeps only a tab-scoped mode flag',()=>{
 const s=storage();s.setItem('unrelated','preserve');
 assert.equal(resolveDemoMode('https://example.com/',()=>s),false);
 assert.equal(resolveDemoMode('https://example.com/?demo=1',()=>s),true);
 assert.equal(resolveDemoMode('https://example.com/profile/',()=>s),true);
 assert.deepEqual([...s.values.keys()],['unrelated',DEMO_MODE_KEY]);
 assert.equal(resolveDemoMode('https://example.com/?demo=0',()=>s),false);
 assert.equal(s.getItem('unrelated'),'preserve');assert.equal(s.getItem(DEMO_MODE_KEY),null);
 assert.equal(resolveDemoMode('https://example.com/?demo=1',()=>{throw Error('Storage blocked');}),true);
 assert.equal(resolveDemoMode('https://example.com/?demo=0',()=>{throw Error('Storage blocked');}),false);
});
test('entry and exit use full navigation without transferring account or mock context',()=>{
 for(const enabled of [true,false]){
  let destination;const location={href:'https://example.com/lookout/profile/?batch=private&code=secret#token',assign:url=>{destination=url;}};
  navigateWorkspaceMode(location,enabled);
  assert.equal(destination,`https://example.com/lookout/profile/?demo=${enabled?'1':'0'}`);
 }
});
test('demo build cannot import the account bootstrap, persistent store or backend client',async()=>{
 const result=await build({entryPoints:['next-app/lib/demo-workspace.jsx'],bundle:true,write:false,metafile:true,platform:'browser',format:'esm',jsx:'automatic',logLevel:'silent'});
 const inputs=Object.keys(result.metafile.inputs);
 assert.ok(inputs.some(p=>p.endsWith('/demo-store.mjs')));
 for(const forbidden of ['account-workspace.jsx','lib/store.js','lib/cloud.mjs','backend/client.mjs','@supabase/'])assert.equal(inputs.some(p=>p.includes(forbidden)),false,forbidden);
});
test('detached runtime edits, Circle reads, reset and briefs work without any account handles',async()=>{
 const shared=await models();
 const first=createDetachedDemo({date:fixturesDate,models:shared,presets});
 const second=createDetachedDemo({date:fixturesDate,models:shared,presets});
 let updated;const off=first.store.subscribe('workflow',s=>{updated=s;});
 const timestamp=first.store.get('demo.createdAt');
 await first.services.updateFields('profile.fields.update',{expectedUpdatedAt:timestamp,fields:{headline:'Detached fictional analysis'}});
 assert.equal(updated.workflow.profile.headline,'Detached fictional analysis');
 assert.match((await first.services.readUserBrief()).items[0].summary,/Detached fictional analysis/);
 assert.notEqual(second.store.get('workflow.profile.headline'),'Detached fictional analysis');
 const circles=await first.services.knowledge.action('circles.list',{});assert.equal(circles.available,true);assert.ok(circles.circles.length);
 assert.equal(first.store.switchAccount,undefined);assert.equal(shared.auth,undefined);assert.equal(shared.cloud,undefined);
 const reset=createDetachedDemo({date:fixturesDate,models:shared,presets});
 assert.notEqual(reset.store.get('workflow.profile.headline'),'Detached fictional analysis');
 assert.equal(reset.store.get('demo.fictional'),true);off();
});
