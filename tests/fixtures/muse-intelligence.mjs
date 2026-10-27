import {bloombergCandidates} from './bloomberg-intelligence.mjs';
// Explicit synthetic posting assignments for this fixture only, never inferred in production.
export const museCandidates=bloombergCandidates.filter(c=>c.observation.sourceId!=='waiting-reply').map(c=>{
 const copy=structuredClone(c),r=copy.observation;
 copy.sourceCircleId='fictional-bloomberg';
 const jobId=r.sourceId==='old-wait'?'bloomberg-2024':r.sourceId==='other-employer'?'cedar-2026':r.sourceId==='intern'?'bloomberg-intern':r.sourceId==='senior'?'bloomberg-senior':r.sourceId==='generic-guide'?'generic':r.sourceId.endsWith('-alt')||r.sourceId==='oa-different'?'bloomberg-london-2026':'bloomberg-ny-2026';
 r.contexts=[{jobId,label:'Fictional posting',company:r.company??undefined,role:r.role??undefined}];
 if(r.sourceId==='oa-recent')r.postReferences=[{circleId:'fictional-bloomberg',postId:'oa-wait',revision:1,label:'Related waiting report'}];
 return copy;
});
export const museCases=[
 {id:'useful-oa',question:'What have candidates experienced in the OA for my posting?',args:{jobId:'bloomberg-ny-2026',stage:'OA'},mode:'automatic',expected:'useful',required:['oa-recent'],forbidden:['oa-different','intern'],terms:['two','hash','sliding']},
 {id:'technical',question:'What did candidates actually do in the technical interview?',args:{jobId:'bloomberg-ny-2026',stage:'Technical interview'},mode:'direct',expected:'useful',required:['technical'],terms:['graph','complexity']},
 {id:'different-formats',question:'Do reports agree on the number of OA tasks?',args:{company:'Bloomberg',role:'New Grad Software Engineer',stage:'OA'},mode:'direct',expected:'useful',required:['oa-recent','oa-different'],terms:['two','three']},
 {id:'unknown-deadline',question:'What is the exact offer acceptance deadline?',args:{jobId:'bloomberg-ny-2026'},mode:'direct',expected:'insufficient',required:[],terms:[]},
 {id:'unknown-automatic',question:'Find the exact offer acceptance deadline to enrich my application.',args:{jobId:'bloomberg-ny-2026'},mode:'automatic',expected:'insufficient',required:[],terms:[]},
 {id:'empty-automatic',question:'Surface useful interview reports for my posting.',args:{jobId:'bloomberg-empty'},mode:'automatic',expected:'no_discussions',required:[],terms:[]},
 {id:'empty-direct',question:'Are there any interview reports for my posting?',args:{jobId:'bloomberg-empty'},mode:'direct',expected:'no_discussions',required:[],terms:[]},
 {id:'rumor',question:'Is Bloomberg hiring confirmed to be paused?',args:{jobId:'bloomberg-ny-2026',stage:'After technical'},mode:'direct',expected:'useful',required:['rumor'],terms:['no firsthand confirmation']},
];
