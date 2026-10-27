import test from 'node:test';import assert from 'node:assert/strict';
import {prefillApplicationQuestions} from '../lib/application-prefill.mjs';
import {applicationPreference} from '../lib/application-preferences.mjs';
import {prepareDraftWithPrefill} from '../lib/application-prefill-service.mjs';
import {mergeApplicationAnswerUpdates} from '../lib/application-handoff.mjs';
import {validateRequest} from '../supabase/functions/agent-gateway/contract.mjs';
const searchProfile={id:'intern',active:true,version:4,filters:{Location:'Austin','Minimum base pay':'USD 150000','Work arrangement':'Remote preferred',Schedule:'Weekdays'},instructions:"## Role preferences\n- Specializations: Backend/Systems\n## Application answers\n- Requires sponsorship: No\n- F-1 student status: No\n- Return to school after internship: Yes\n- Graduation month: 2027-06\n- Degree pursued: Bachelor's\n- Earliest start date: 2027-06-01\n- Available for 12-week full-time internship: Yes\n- Willing to relocate: Yes\n- Desired salary: USD 175000"};
const yesNo=[{value:'1',label:'Yes'},{value:'0',label:'No'}];
const question=(question,id,options)=>({question,required:true,fields:[{id,type:options?'select':'text',options:options||[]}]});

test('explicit application preferences bind exact employer option labels to native values',()=>{
 const r=prefillApplicationQuestions({questions:[question('Do you now or will you in the future require immigration sponsorship to work at Cloudflare?','sponsor',yesNo),question('When can you start?','start'),question('Are you willing to relocate?','relocate',yesNo)],searchProfile,searchProfileVersion:4,company:'Cloudflare'});
 assert.deepEqual(r.questions.map(q=>q.answer),['0','2027-06-01','1']);assert.ok(r.filled.every(q=>q.source==='preference'));assert.equal(r.questions[0].preferenceProfileVersion,4);assert.equal(r.questionsReviewed,false);
});

test('search preferences answer preferences, never current location, requested salary or office commitments',()=>{
 const r=prefillApplicationQuestions({questions:[question('Preferred work arrangement','work',[{value:'remote',label:'Remote'}]),question('Preferred schedule','schedule'),question('Current location','location'),question('Are you able to work in our Austin office 3–5 days a week?','office',yesNo)],searchProfile});
 assert.equal(r.questions[0].answer,'remote');assert.equal(r.questions[1].answer,'Weekdays');assert.equal(r.questions[2].answer,'');assert.equal(r.questions[3].answer,'');
 const noExplicit={...searchProfile,instructions:''};assert.equal(prefillApplicationQuestions({questions:[question('Desired salary','pay')],searchProfile:noExplicit}).questions[0].answer,'');
});

test('exact month and degree options fill; closest-date guesses and invalid values escape with focused evidence',()=>{
 const rows=[question('Expected graduation date','date',[{value:'june27',label:'June 2027'}]),question('Degree pursued','degree',[{value:'b',label:"Bachelor's"}])];
 const r=prefillApplicationQuestions({questions:rows,searchProfile});assert.deepEqual(r.questions.map(q=>q.answer),['june27','b']);
 const mismatch=prefillApplicationQuestions({questions:rows,searchProfile:{...searchProfile,instructions:searchProfile.instructions.replace('2027-06\n','2027-05\n')}});assert.equal(mismatch.escapes[0].reason,'option-mismatch');assert.equal(mismatch.escapes[0].preferenceEvidence.value,'May 2027');
 assert.equal(applicationPreference('Do you require sponsorship?',{...searchProfile,instructions:'## Application answers\n- Requires sponsorship: Maybe'}).reason,'invalid-application-preference');
 assert.throws(()=>applicationPreference('Do you require sponsorship?',{...searchProfile,instructions:'## Application answers\n- Requires sponsorship: Yes\n- Requires sponsorship: No'}),/duplicate/);
 assert.equal(applicationPreference('When can you start?',{...searchProfile,instructions:'## Application answers\n- Earliest start date: 2027-02-31'}).reason,'invalid-application-preference');
});

function harness(){
 let draft={url:'https://example.com/job',resumeId:'r',questions:[{id:'email',fieldId:'email',question:'Email',answer:'private@example.com',profileField:'email',fieldType:'text'},{id:'why',fieldId:'why',question:'Why this team?',answer:'',fieldType:'textarea',maxLength:80}]};
 let revision=2,version=4;const calls=[];
 const call=async(op,p)=>{calls.push({op,p});if(op==='context.personal')return {data:{personalVersion:7,settings:{profile:{user_id:'u',facts:{email:'private@example.com',skills:'Go',education:[{school:'Example University',degree:'BS',endDate:'2027-06'}],workExperience:[{company:'Example',title:'Engineer',description:'Built a service.'}],unrelatedPrivateFact:'must not ship'}},resumes:[{id:'r',user_id:'u',object_path:'private/resume.pdf'}],answers:[],preferences:{search:{}}}}};if(op==='context.versions')return {data:{personalVersion:7}};if(op==='search.context')return {data:{documents:[{kind:'profile',id:'intern',version,projection:searchProfile}]}};if(op==='drafts.prepare'){draft=p.draft;revision++;return {data:{id:'app',job_id:'job',revision,status:'Blocked',draft}};}throw Error(op);};
 return {call,calls,loadJob:async()=>({id:'job',canonical_url:'https://example.com/job',employer:{company:'Example',title:'Engineer'}}),loadApplication:async()=>({id:'app',revision,draft}),get draft(){return draft;},get revision(){return revision;},set version(v){version=v;}};
}

test('default handoff excludes completed answers/full profile and keeps only unresolved constraints/evidence',async()=>{
 const h=harness();const r=await prepareDraftWithPrefill(h.call,{jobId:'job',expectedRevision:2,draft:{questions:h.draft.questions}},{loadJob:h.loadJob,loadApplication:h.loadApplication});
 assert.equal(r.error,null);assert.equal(r.data.draft,undefined);assert.equal(r.data.handoff.requiresBrowserInspection,true);assert.equal(r.data.prefill.filled,undefined);assert.equal(r.data.handoff.questions.length,1);assert.equal(r.data.handoff.questions[0].fieldId,'why');assert.equal(r.data.handoff.questions[0].limits.maxLength,80);
 assert.equal(JSON.stringify(r.data).includes('private@example.com'),false);assert.equal(JSON.stringify(r.data).includes('unrelatedPrivateFact'),false);assert.equal(r.data.handoff.evidence.skills,'Go');assert.equal(h.draft.questions.find(q=>q.fieldId==='email').answer,'private@example.com');
});

test('answer-only update merges the stored full draft and returns a smaller remaining packet',async()=>{
 const h=harness();const r=await prepareDraftWithPrefill(h.call,{jobId:'job',expectedRevision:2,draft:{answerUpdates:[{fieldId:'why',answer:'I build reliable systems.'}]}},{loadJob:h.loadJob,loadApplication:h.loadApplication});
 assert.equal(r.error,null);assert.equal(r.data.handoff.questions.length,0);assert.equal(h.draft.questions.length,2);assert.equal(h.draft.questions[0].answer,'private@example.com');assert.equal(h.draft.questions[1].answer,'I build reliable systems.');assert.equal(h.draft.answerUpdates,undefined);assert.equal(h.draft.questionsReviewed,false);
});

test('patches reject unknown/duplicate controls, invalid choices, oversize answers and mixed replacement',()=>{
 const rows=[{fieldId:'select',fieldType:'select',options:yesNo,answer:''},{fieldId:'file',fieldType:'file',answer:''},{fieldId:'text',fieldType:'text',maxLength:2,answer:''}];
 for(const updates of [[{fieldId:'missing',answer:'x'}],[{fieldId:'file',answer:'foreign'}],[{fieldId:'select',answer:'not-a-choice'}],[{fieldId:'text',answer:'long'}],[{fieldId:'text',answer:'x'},{fieldId:'text',answer:'y'}]])assert.throws(()=>mergeApplicationAnswerUpdates(rows,updates));
 assert.throws(()=>validateRequest({operation:'drafts.prepare',payload:{jobId:'j',expectedRevision:0,draft:{questions:[],answerUpdates:[{fieldId:'a',answer:'b'}]}}}));
});

test('selected preference profile is current and version checked; full mode remains explicitly available',async()=>{
 const h=harness();const r=await prepareDraftWithPrefill(h.call,{jobId:'job',expectedRevision:2,responseMode:'full',draft:{searchProfileId:'intern',questions:[question('Do you require sponsorship?','sponsor',yesNo)]}},{loadJob:h.loadJob,loadApplication:h.loadApplication});
 assert.equal(r.data.draft.questions[0].answer,'0');assert.equal(r.data.handoff.context.searchProfileVersion,4);
 const raced=harness();let reads=0;const original=raced.call;const call=async(op,p)=>{if(op==='search.context'&&++reads===2)raced.version=5;return original(op,p);};
 const bad=await prepareDraftWithPrefill(call,{jobId:'job',expectedRevision:2,draft:{searchProfileId:'intern',questions:[question('Do you require sponsorship?','s',yesNo)]}},{loadJob:raced.loadJob,loadApplication:raced.loadApplication});assert.equal(bad.error.code,'40001');assert.equal(raced.calls.some(c=>c.op==='drafts.prepare'),false);
});

test('existing/saved answers that conflict with a newly explicit preference are surfaced, not overwritten or silently reused',()=>{
 const questions=[question('Do you require sponsorship?','sponsor',yesNo)],existingQuestions=[{fieldId:'sponsor',question:'Do you require sponsorship?',answer:'1',savedAnswerId:'old',savedAnswerVersion:1}];
 const r=prefillApplicationQuestions({questions,searchProfile,existingQuestions});assert.equal(r.questions[0].answer,'1');assert.equal(r.questions[0].savedAnswerId,undefined);assert.equal(r.escapes[0].reason,'conflicting-application-preference');
 const saved=prefillApplicationQuestions({questions,searchProfile,answers:[{id:'s',question:'Do you require sponsorship?',answer:'1',verifiedAt:'today',policy:'auto'}]});assert.equal(saved.questions[0].answer,'');assert.equal(saved.escapes[0].reason,'conflicting-application-preference');
});

test('invalid existing native choices remain unresolved and typography-only degree differences match',()=>{
 const r=prefillApplicationQuestions({questions:[{...question('Do you require sponsorship?','s',yesNo),fields:undefined,fieldId:'s',fieldType:'select',options:yesNo,answer:'No'}]});assert.equal(r.escapes[0].reason,'existing-answer-option-mismatch');
 const degree=prefillApplicationQuestions({questions:[question('Degree pursued','d',[{value:'bs',label:"Bachelor's"}])],searchProfile:{...searchProfile,instructions:'## Application answers\n- Degree pursued: Bachelor’s'}});assert.equal(degree.questions[0].answer,'bs');
});

test('fictional demo settings round trip through the existing profile tools and fill a preference proposal',async()=>{
 const {demoFixtures}=await import('../next-app/lib/demo.mjs');const {readField,promptFromProfile,profileFromPrompt}=await import('../lib/search-profile.mjs');
 const profile=demoFixtures('2026-10-26').state.workflow.searchPreferences.profiles.find(p=>p.id==='general');
 assert.equal(readField(profile.instructions,'Application answers','Requires sponsorship').value,'No');
 const round=profileFromPrompt(promptFromProfile(profile),profile);assert.equal(round.instructions,profile.instructions);
 const r=prefillApplicationQuestions({questions:[question('Do you require sponsorship?','s',yesNo)],searchProfile:profile});assert.equal(r.questions[0].answer,'0');assert.equal(r.questionsReviewed,false);
});
