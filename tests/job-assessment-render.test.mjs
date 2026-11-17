import test from 'node:test';
import assert from 'node:assert/strict';
import {React,renderToStaticMarkup,bundleComponent} from './helpers/render.mjs';
const Preview=(await bundleComponent('next-app/components/role-match-preview.tsx'))();
test('preference match uses only a saved overall percentage and preserves evidence in expanded view',()=>{
 const sample={percent:67,assessedAt:'2026-10-23T19:00:00Z',evidence:'A supported profile fact.',factors:[{label:'Query planning',value:67,rating:'Good',reason:'Database project.'}]};
 const html=renderToStaticMarkup(React.createElement(Preview,{sample,expanded:true}));
 for(const text of ['67% preference match','Saved agent assessment','A supported profile fact.'])assert.ok(html.includes(text),text);
 assert.ok(!html.includes('Query planning'));
 const empty=renderToStaticMarkup(React.createElement(Preview,{expanded:true}));
 assert.ok(empty.includes('Not assessed'));assert.ok(!empty.includes('% preference match'));
 const demo=renderToStaticMarkup(React.createElement(Preview,{sample,demo:true}));assert.ok(demo.includes('Illustrative demo'));
});

test('older assessments do not invent an overall score and zero remains a valid score',()=>{
 const sample={assessedAt:'2026-10-26T18:00:00Z',skillsExperience:{score:82,reasoning:'Database evidence.'},compensation:{score:null,reasoning:'Unknown.'},wellbeingCulture:{score:60,reasoning:'Clarify.'},locationWorkSetting:{score:0,reasoning:'Differs.'}};
 const html=renderToStaticMarkup(React.createElement(Preview,{sample,expanded:true}));
 assert.ok(html.includes('Overall score unavailable'));assert.ok(!html.includes('% preference match'));
 const zero=renderToStaticMarkup(React.createElement(Preview,{sample:{...sample,percent:0}}));assert.ok(zero.includes('0% preference match'));
});

const JobFacts=(await bundleComponent('next-app/components/role-job-facts.tsx',{plugins:[{name:'css-test',setup(build){build.onLoad({filter:/\.module\.css$/},()=>({contents:'export default {};',loader:'js'}));}}]}))();
test('cards, previews and application facts retain saved priority tags without inventing verdicts',()=>{
 for(const compact of [true,false]){
  for(const priority of ['Apply Now','Strong Consider','Skip Unless Team Fit']){
   const html=renderToStaticMarkup(React.createElement(JobFacts,{role:{priority,employmentType:'FT'},compact}));
   assert.ok(html.includes(`>${priority}</span>`),priority);
  }
  const missing=renderToStaticMarkup(React.createElement(JobFacts,{role:{employmentType:'FT'},compact}));
  assert.ok(!missing.includes('Saved assessment label'));
  const fit=renderToStaticMarkup(React.createElement(JobFacts,{role:{priority:'Strong Consider',fitLabel:'Consider',employmentType:'FT'},compact}));
  assert.ok(fit.includes('>Consider</span>'));assert.ok(!fit.includes('>Strong Consider</span>'));
 }
});

test('resettable fictional Discover scenarios display saved assessment tags',async()=>{
 const {discoverPreviewRoles}=await import('../next-app/lib/discover-preview-demo.mjs');
 for(const role of discoverPreviewRoles('2026-11-10')){
  const html=renderToStaticMarkup(React.createElement(JobFacts,{role,compact:true}));
  assert.ok(html.includes(`>${role.fitLabel || role.priority}</span>`));
 }
});
