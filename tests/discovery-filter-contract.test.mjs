import test from 'node:test';import assert from 'node:assert/strict';
import {discoveryConstraints,assertDiscoveryConstraints,observedEmployment,assertDiscoverySourceFacts,assertDiscoveryResults,DISCOVERY_EVALUATION_SCOPE} from '../lib/discovery-filter-contract.mjs';
import {executeCareerTask} from '../runner/career-tools.mjs';
test('legacy selections become explicit typed constraints, including multiple choices',()=>{
 const c=discoveryConstraints({filters:{Employment:'Full-time, Internship','Work arrangement':'Remote preferred, Hybrid'},instructions:'## Priority & flexibility\n- Work arrangement: Required'});
 assert.deepEqual(c,{version:1,employment:{values:['FT','Internship'],strength:'required'},workArrangement:{values:['remote','hybrid'],strength:'required'}});
 assert.deepEqual(discoveryConstraints({filters:{'Work arrangement':'Any'}}).workArrangement,{values:[],strength:'not-configured'});
 assert.equal(observedEmployment('Full-time'),'FT');assert.equal(observedEmployment(null),null);
});
test('invalid or ambiguous settings fail instead of silently weakening a gate',()=>{
 for(const filters of [{Employment:true},{Employment:'SWE'},{'Work arrangement':'Remote, Any'},{'Work arrangement':'Sometimes'},{'Work arrangement':{value:'Hybrid'}}])assert.throws(()=>discoveryConstraints({filters}));
 for(const instructions of ['## Priority & flexibility\n- Work arrangement: Maybe','## Priority & flexibility\n- Work arrangement: Required\n- Work arrangement: Flexible','## Priority & flexibility\n- Work arrangement: Required'])assert.throws(()=>discoveryConstraints({filters:{},instructions}));
 assert.throws(()=>discoveryConstraints({filters:{'Work arrangement':'Remote required'},instructions:'## Priority & flexibility\n- Work arrangement: Flexible'}));
 assert.throws(()=>assertDiscoveryConstraints({version:1,employment:{values:[],strength:'required'},workArrangement:{values:[],strength:'not-configured'}}));
});
test('source facts preserve unknowns and reject malformed types',()=>{
 assert.doesNotThrow(()=>assertDiscoverySourceFacts([{id:'a',title:'Engineer',location:null,employment_type:null,observation:null}]));
 for(const patch of [{location:{}},{title:5},{employmentType:true},{employmentType:'sometimes'}])assert.throws(()=>assertDiscoverySourceFacts([{id:'a',title:'Engineer',location:null,...patch}]));
});
test('typed result validation rejects false match claims and malformed checks',()=>{
 const rows=[{id:'a',title:'Engineer'}],r={listingId:'a',passed:true,rejectedBy:[],checks:[{requirement:'employment',status:'unknown',evidence:'Source did not disclose employment type.'}],decision:'review-needed',explanation:'Retain for review.'};
 assert.doesNotThrow(()=>assertDiscoveryResults([r],rows));
 for(const patch of [{listingId:'other'},{decision:'eligible'},{passed:false},{checks:[{requirement:'employment',status:'matched',evidence:'Bad enum'}]},{checks:[{requirement:'employment',status:'unknown',evidence:''}]}])assert.throws(()=>assertDiscoveryResults([{...r,...patch}],rows));
});
test('unconfigured upstream gates are not reported as matches; eligibility remains unevaluated',async()=>{
 const result=await executeCareerTask('filter-discovery',{profile:{filters:{}},listings:[{id:'a',title:'Engineer',location:'United States'}]});
 for(const key of ['careerops-title','careerops-posting-age','careerops-content','careerops-salary','careerops-visa','careerops-cooldown','location'])assert.equal(result.results[0].checks.find(c=>c.requirement===key).status,'not-applicable',key);
 assert.equal(result.results[0].decision,'review-needed');for(const [key,value]of Object.entries(DISCOVERY_EVALUATION_SCOPE))assert.equal(result.provenance[key],value);
 for(const key of ['experience','graduation','availability','authorization','prior-application','company-limits'])assert.equal(result.results[0].checks.find(c=>c.requirement===key).status,'unknown');
});
test('all selected work arrangements survive normalization and use the original predicates',async()=>{
 const result=await executeCareerTask('filter-discovery',{profile:{filters:{Employment:'Full-time','Work arrangement':'Remote preferred, Hybrid'},instructions:'## Priority & flexibility\n- Work arrangement: Required'},listings:[{id:'hybrid',title:'Engineer New Grad',location:'Hybrid'},{id:'office',title:'Engineer New Grad',location:'In-Office'},{id:'unknown',title:'Engineer New Grad',location:'United States',description:'Build a hybrid cloud control plane.'}]});
 assert.equal(result.results[0].decision,'review-needed');assert.equal(result.results[0].checks.find(c=>c.requirement==='work-arrangement').status,'met');assert.equal(result.results[1].decision,'ineligible');assert.equal(result.results[2].checks.find(c=>c.requirement==='work-arrangement').status,'unknown');
});
test('shared contract has a checked TypeScript surface as well as runtime guards',async()=>{
 const {execFile}=await import('node:child_process');const {promisify}=await import('node:util');const {fileURLToPath}=await import('node:url');
 await promisify(execFile)(process.execPath,['node_modules/typescript/bin/tsc','--noEmit','--allowJs','--checkJs','false','--module','NodeNext','--target','ES2023','--skipLibCheck','tests/fixtures/discovery-filter-types.ts'],{cwd:fileURLToPath(new URL('../',import.meta.url)),timeout:30000,maxBuffer:200000});
});
test('malformed child results fail before persisting a screening',async()=>{
 const {screenSearchDiscoveries}=await import('../lib/search-screening.mjs');const calls=[];
 const dispatch=async(op)=>{calls.push(op);return {data:op==='search.screenings.read'?null:op==='search.run.read'?{profile_id:'ft'}:op==='search.context'?{personalVersion:1,documents:[{kind:'profile',id:'ft',version:1,projection:{filters:{}}}]}:{listings:[{id:'a',title:'Engineer',location:null,observation:{id:'o'}}],nextOffset:null},error:null};};
 const result=await screenSearchDiscoveries(dispatch,{runId:'r',listingIds:['a'],eventKey:'new'},{evaluate:async()=>({results:[{listingId:'a',passed:true,rejectedBy:[],checks:[{requirement:'employment',status:'guessed',evidence:'Bad'}],decision:'review-needed',explanation:'Bad child output.'}]})});
 assert.equal(result.error.code,'22023');assert.equal(calls.includes('search.screenings.commit'),false);
});
test('replay exposes discovery scope without recomputing or rewriting saved checks',async()=>{
 const {screenSearchDiscoveries}=await import('../lib/search-screening.mjs');const saved={screenings:[{decision:'review-needed',checks:[]}]};const calls=[];
 const result=await screenSearchDiscoveries(async op=>{calls.push(op);return {data:saved,error:null};},{eventKey:'same'});
 assert.deepEqual(calls,['search.screenings.read']);assert.deepEqual(result.data.screenings,saved.screenings);assert.equal(result.data.applicantEligibility,'not-evaluated');assert.equal(result.data.contractVersion,1);assert.equal(result.data.replayed,true);
});
