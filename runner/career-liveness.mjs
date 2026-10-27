import {publicUrl} from './public-source.mjs';
import {checkLivenessViaApi} from './vendor/career-ops/liveness-api.mjs';
import {rejectPrivateOrInvalid,newLivenessPage,checkUrlLivenessWithFallback} from './vendor/career-ops/liveness-browser.mjs';
import {assertPostingLiveness} from '../lib/discovery-liveness-contract.mjs';

// Verbatim bounded scheduling helper from pinned Career Ops scan.mjs.
async function parallelFetch(tasks, limit) {
  const results = [];
  let i = 0;

  async function next() {
    while (i < tasks.length) {
      const task = tasks[i++];
      results.push(await task());
    }
  }

  const workers = Array.from({ length: Math.min(limit, tasks.length) }, () => next());
  await Promise.all(workers);
  return results;
}

// Same two-rung flow as copied check-liveness.mjs and scan.mjs verifyOffers.
// All ATS/browser decisions and URL routing guards stay in the copied files.
// Lookout adds one verdict per input, timestamps and the existing job time budget.
export async function checkDiscoveryLiveness(leads,{
 checkApi=checkLivenessViaApi,loadPlaywright=()=>import('playwright'),
 checkPage=checkUrlLivenessWithFallback,now=Date.now,browserBudgetMs=30000,
}={}){
 if(!Array.isArray(leads)||leads.length>25||leads.some(lead=>typeof lead?.url!=='string'))throw Error('At most 25 lead URLs required');
 const verdicts=new Array(leads.length),methods=new Array(leads.length);
 await parallelFetch(leads.map((lead,i)=>async()=>{
  try{publicUrl(lead.url);}catch{verdicts[i]={result:'uncertain',code:'invalid_source_url',reason:'Public HTTPS posting URL required.'};methods[i]='guard';return;}
  const guard=rejectPrivateOrInvalid(lead.url);
  if(guard){verdicts[i]={result:'uncertain',...guard};methods[i]='guard';return;}
  try{verdicts[i]=await checkApi(lead.url);}catch{verdicts[i]=null;}
  if(verdicts[i])methods[i]='ats-api';
 }),10);
 let browser=null,page=null,browserFailure=null,started=null;
 async function ensureBrowser(){
  if(browserFailure)throw browserFailure;
  if(!browser){
   try{
    const {chromium}=await loadPlaywright();
    browser=await chromium.launch({headless:true,...(process.env.LOOKOUT_CHROMIUM_EXECUTABLE?{executablePath:process.env.LOOKOUT_CHROMIUM_EXECUTABLE}:{})});
    page=await newLivenessPage(browser);
   }catch(error){browserFailure=error;throw error;}
  }
 }
 const results=[];
 try{
  // Sequential browser checks, as in upstream. Explicit API uncertain is kept;
  // only null/inconclusive API responses fall through to the browser.
  for(let i=0;i<leads.length;i++){
   let verdict=verdicts[i],method=methods[i];
   if(!verdict){
    if(started!==null&&now()-started>=browserBudgetMs){
     verdict={result:'uncertain',code:'browser_budget_exhausted',reason:'Browser verification exceeded this bounded batch budget; recheck this posting.'};method='budget';
    }else{
     started??=now();method='browser';
     try{await ensureBrowser();verdict=await checkPage(page,leads[i].url);}
     catch{verdict={result:'uncertain',code:browserFailure?'browser_unavailable':'browser_check_failed',reason:browserFailure?'Browser unavailable; posting status was not established.':'Browser verification failed; posting status was not established.'};}
    }
   }
   results.push(assertPostingLiveness({...verdict,url:leads[i].url,checkedAt:new Date(now()).toISOString(),method}));
  }
 }finally{if(browser)await browser.close().catch(()=>{});}
 return results;
}
