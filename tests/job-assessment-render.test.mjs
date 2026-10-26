import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {createRequire} from 'node:module';
import vm from 'node:vm';
const require=createRequire(new URL('../next-app/package.json',import.meta.url));
const React=require('react');
const {renderToStaticMarkup}=require('react-dom/server');
const bundle=await build({entryPoints:['next-app/components/role-match-preview.tsx'],bundle:true,write:false,platform:'node',format:'cjs',packages:'external',jsx:'automatic',logLevel:'silent'});
const module={exports:{}};
vm.runInNewContext(bundle.outputFiles[0].text,{module,exports:module.exports,require,console,process,setTimeout,clearTimeout});
const Preview=module.exports.default;
test('live assessment renders saved custom factors and evidence, while empty assessments have no invented factors',()=>{
 const sample={percent:67,assessedAt:'2026-10-23T19:00:00Z',evidence:'A supported profile fact.',factors:[{label:'Query planning',value:67,rating:'Good',reason:'Database project.'},{label:'Team scope',value:null,rating:'Unknown',reason:'Not disclosed.'}]};
 const html=renderToStaticMarkup(React.createElement(Preview,{sample,expanded:true}));
 for(const text of ['67% job match','Saved agent assessment','Query planning','Team scope','A supported profile fact.','Database project.'])assert.ok(html.includes(text),text);
 assert.ok(!html.includes('Illustrative demo'));
 const empty=renderToStaticMarkup(React.createElement(Preview,{expanded:true}));
 assert.ok(empty.includes('Match not assessed'));assert.ok(!empty.includes('Compensation'));assert.ok(!empty.includes('<details'));
 const demo=renderToStaticMarkup(React.createElement(Preview,{sample,demo:true}));assert.ok(demo.includes('Illustrative demo'));
});

test('compact card renders exactly four numeric/unknown scores and reveals reasoning only in expanded preview',()=>{
 const sample={assessedAt:'2026-10-26T18:00:00Z',skillsExperience:{score:82,reasoning:'Database evidence maps to this role.'},compensation:{score:null,reasoning:'Pay is undisclosed.'},wellbeingCulture:{score:60,reasoning:'On-call needs clarification.'},locationWorkSetting:{score:0,reasoning:'Recorded location preference differs.'}};
 const card=renderToStaticMarkup(React.createElement(Preview,{sample}));
 for(const label of ['Skills &amp; experience','Compensation','Wellbeing &amp; culture','Location &amp; work setting'])assert.ok(card.includes(label),label);
 for(const value of ['82 out of 100','60 out of 100','0 out of 100','Unknown'])assert.ok(card.includes(value),value);
 assert.ok(!card.includes('Database evidence'));assert.ok(!card.includes('<details'));assert.ok(!card.includes('% job match'));
 const preview=renderToStaticMarkup(React.createElement(Preview,{sample,expanded:true}));
 assert.equal((preview.match(/<details/g)||[]).length,4);
 for(const factor of Object.values(sample).filter(value=>typeof value==='object'))assert.ok(preview.includes(factor.reasoning));
});
