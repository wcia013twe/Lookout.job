import test from 'node:test';
import assert from 'node:assert/strict';
import * as scan from '../runner/vendor/career-ops/scan.mjs';
import {filterDiscovery} from '../runner/career-search-filters.mjs';
import {executeCareerTask} from '../runner/career-tools.mjs';

// Fictional, offline records. Compare the adapter against the actual pinned
// Career Ops predicates, with independently specified expected decisions.
const now=Date.parse('2026-10-26T12:00:00Z');
const base={id:'fixture',company:'Example Labs',title:'Backend Engineer',location:'United States',description:'Build distributed systems in Rust.',url:'https://example.test/jobs/1'};
const cases=[
 {name:'title negative veto beats a positive match',key:'careerops-title',config:{title_filter:{positive:['engineer'],negative:['senior']}},job:{title:'Senior Backend Engineer'},predicate:(c,j)=>scan.buildTitleFilter(c.title_filter)(j.title),expected:false},
 {name:'content uses word boundaries rather than excluding JavaScript as Java',key:'careerops-content',config:{content_filter:{negative:['word:java']}},job:{description:'Build JavaScript infrastructure.'},predicate:(c,j)=>scan.buildContentFilter(c.content_filter)(j.description),expected:true},
 {name:'title-specific content override is honored',key:'careerops-content',config:{title_filter:{positive:['engineer']},content_filter:{positive:['python'],by_title_keyword:{engineer:{positive:['rust']}}}},predicate:(c,j)=>scan.buildContentFilter(c.content_filter)(j.description,scan.matchedTitleKeywords(j.title,c.title_filter)),expected:true},
 {name:'posting-age boundary is inclusive',key:'careerops-posting-age',config:{max_posting_age_days:3},job:{postedAt:now-3*86400000},predicate:(c,j)=>scan.buildPostingAgeFilter(c.max_posting_age_days,now)(j.postedAt),expected:true},
 {name:'posting older than the configured window is excluded',key:'careerops-posting-age',config:{max_posting_age_days:3},job:{postedAt:now-3*86400000-1},predicate:(c,j)=>scan.buildPostingAgeFilter(c.max_posting_age_days,now)(j.postedAt),expected:false},
 {name:'posted-before includes the entire UTC day',key:'careerops-posted-date',config:{posted_before:'2026-10-25'},job:{postedAt:Date.parse('2026-10-25T23:59:59.999Z')},predicate:(c,j)=>scan.buildPostedDateFilter(c.posted_after,c.posted_before)(j.postedAt),expected:true},
 {name:'salary overlap is retained rather than requiring the whole range above minimum',key:'careerops-salary',config:{salary_filter:{min:150000,currency:'USD'}},job:{salary:{min:140000,max:170000,currency:'USD'}},predicate:(c,j)=>scan.buildSalaryFilter(c.salary_filter)(j.salary),expected:true},
 {name:'explicit salary currency mismatch is rejected',key:'careerops-salary',config:{salary_filter:{min:150000,currency:'USD'}},job:{salary:{min:160000,max:180000,currency:'EUR'}},predicate:(c,j)=>scan.buildSalaryFilter(c.salary_filter)(j.salary),expected:false},
 {name:'explicit refusal of sponsorship is rejected',key:'careerops-visa',config:{visa_filter:{enabled:true,negative:['no sponsorship']}},job:{description:'No sponsorship is available.'},predicate:(c,j)=>scan.buildVisaFilter(c.visa_filter)(j.description),expected:false},
 {name:'required sponsorship mention rejects missing description',key:'careerops-visa',config:{visa_filter:{enabled:true,require_mention:true}},job:{description:''},predicate:(c,j)=>scan.buildVisaFilter(c.visa_filter)(j.description),expected:false},
 {name:'hard location block beats always-allow',key:'location',config:{location_filter:{always_allow:['Porto'],block_hard:['Brazil']}},job:{location:'Porto Alegre, Brazil'},predicate:(c,j)=>scan.buildLocationFilter(c.location_filter)(j.location,j.url,j.title),expected:false},
 {name:'strict location rejects missing location and URL hint',key:'location',config:{location_filter:{allow:['United States'],strict:true}},job:{location:null},predicate:(c,j)=>scan.buildLocationFilter(c.location_filter)(j.location,j.url,j.title),expected:false},
 {name:'Workday URL location is evidence even without display location',key:'location',config:{location_filter:{block_hard:['India']}},job:{location:null,url:'https://example.myworkdayjobs.com/en-US/External/job/Hyderabad-India/Backend-Engineer_123'},predicate:(c,j)=>scan.buildLocationFilter(c.location_filter)(j.location,j.url,j.title),expected:false},
 {name:'company reapplication cooldown rejects a matching role',key:'careerops-cooldown',config:{re_apply_windows:{'Example Labs':{last_apply_date:'2026-10-20',same_role_days:30,applied_to:['backend engineer']}}},predicate:(c,j)=>!scan.buildCooldownFilter(c.re_apply_windows,'2026-10-26')(j).skip,expected:false},
];
for(const row of cases)test(row.name,async()=>{
 const job={...base,...row.job};
 assert.equal(row.predicate(row.config,job),row.expected,'pinned Career Ops decision');
 const {results:[result]}=await filterDiscovery({profile:{filters:{}},listings:[job],portals:row.config,now});
 assert.equal(result.checks.find(c=>c.requirement===row.key)?.status,row.expected?'met':'unmet','adapter must preserve the explicit upstream decision');
 assert.equal(result.passed,row.expected,'configured upstream rejection must exclude');
});

test('conservative upstream passes with missing evidence remain unknown, not matches',async()=>{
 const {results:[r]}=await filterDiscovery({profile:{filters:{}},listings:[{...base,description:'',location:null}],portals:{content_filter:{positive:['rust']},max_posting_age_days:3,salary_filter:{min:150000},visa_filter:{enabled:true,require_mention:false},location_filter:{allow:['United States']}},now});
 for(const key of ['careerops-content','careerops-posting-age','careerops-salary','careerops-visa','location'])assert.equal(r.checks.find(c=>c.requirement===key).status,'unknown',key);
 assert.equal(r.passed,true);assert.equal(r.decision,'review-needed');
});

test('the real runner child preserves strict rejection without network or database access',async()=>{
 const result=await executeCareerTask('filter-discovery',{profile:{filters:{}},listings:[{...base,description:''}],portals:{visa_filter:{enabled:true,require_mention:true}}});
 assert.equal(result.results[0].passed,false);assert.equal(result.results[0].checks.find(c=>c.requirement==='careerops-visa').status,'unmet');
});

test('saved profile location is soft only when explicitly Preferred or Flexible',async()=>{
 for(const [priority,passed] of [['Required',false],['Preferred',true],['Flexible',true]]){
  const {results:[r]}=await filterDiscovery({profile:{filters:{Location:'United States'},instructions:`## Priority & flexibility\n- Location: ${priority}`},listings:[{...base,location:'Toronto, Canada'}],now});
  assert.equal(r.checks.find(c=>c.requirement==='location').status,'unmet');assert.equal(r.passed,passed,priority);
 }
});
