import test from 'node:test';
import assert from 'node:assert/strict';
import {React,renderToStaticMarkup,bundleComponent} from './helpers/render.mjs';
const Documents=(await bundleComponent('next-app/components/application-documents-preview.tsx'))();
const Fit=(await bundleComponent('next-app/components/application-fit-assessment.tsx'))();
const app={id:'job',backendId:'app',company:'Example',title:'Engineer',status:'Submitted',questions:[]};
const props={application:app,draft:{...app,questions:[{question:'Current draft question',answer:'Changed answer'}]},profile:{name:'Private current profile',email:'private-current@example.test',workExperience:[{company:'Current employer'}]},resume:{id:'new',name:'Current résumé'},hasDraft:true,attempts:[],loading:false,error:'',onRetry(){}};
const receipt={source:'runner-observed-greenhouse-confirmation',marker:'#confirmation',message:'Application received',jobUrl:'https://example.com/job'};
const attempt={id:'attempt',application_id:'app',state:'confirmed',receipt,context_snapshot:{application:{draft:{questions:[{question:'Employer question at submission',answer:'Original submitted answer'}]}},resume:{id:'old',name:'Original résumé',version:2},job:{canonical_url:receipt.jobUrl}}};
const render=(C,p)=>renderToStaticMarkup(React.createElement(C,p));
test('external and missing native submission snapshots never fall back to current profile, draft or résumé',()=>{
 for(const application of [app,{...app,imported:{id:'import',record:{status:'APPLIED'}}}]){
  const html=render(Documents,{...props,application});assert(html.includes('Not available.'));
  for(const forbidden of ['Private current profile','private-current@example.test','Current employer','Current draft question','Changed answer','Current résumé','Profile reference'])assert(!html.includes(forbidden),forbidden);
 }
 assert(render(Documents,{...props,application:{...app,imported:{id:'import',record:{status:'APPLIED'}}}}).includes('submitted outside Lookout'));
 const saved=render(Documents,{...props,application:{...app,status:'New',imported:{id:'import',record:{status:'SAVED'}}}});assert(saved.includes('No application materials were recorded'));assert(!saved.includes('submitted outside Lookout'));
});
test('documents expose expandable captured employer fields and pinned résumé without replacing them with current account data',()=>{
 const html=render(Documents,{...props,attempts:[attempt]});
 for(const required of ['Submitted application','Employer question at submission','Original submitted answer','Original résumé','<details'])assert(html.includes(required),required);
 for(const forbidden of ['Changed answer','Current draft question','private-current@example.test','Current résumé'])assert(!html.includes(forbidden),forbidden);
 const uncertain=render(Documents,{...props,attempts:[{...attempt,state:'uncertain',receipt:null}]});assert(uncertain.includes('Saved application attempt'));assert(uncertain.includes('Submission not confirmed.'));assert(!uncertain.includes('<h3>Submitted application</h3>'));
});
test('draft documents show only recorded employer answers and selected draft résumé, never an inferred profile submission',()=>{
 const html=render(Documents,{...props,application:{...app,status:'Draft'}});assert(html.includes('Application draft'));assert(html.includes('Current draft question'));assert(!html.includes('private-current@example.test'));assert(!html.includes('Current employer'));
});
test('application fit always shows four dimensions, using N/A without saved scores and retaining real zero scores',()=>{
 const empty=render(Fit,{});assert.equal((empty.match(/>N\/A</g)||[]).length,4);assert(!empty.includes('Not disclosed'));
 const assessment={assessedAt:'2026-11-07T12:00:00Z',skillsExperience:{score:0,reasoning:'Recorded skills gap.'},compensation:{score:null,reasoning:'Pay unknown.'},wellbeingCulture:{score:80,reasoning:'Saved culture research.'},locationWorkSetting:{score:65,reasoning:'Saved location comparison.'}};
 const html=render(Fit,{assessment});for(const value of ['0/100','80/100','65/100','N/A','Recorded skills gap.'])assert(html.includes(value),value);
});
