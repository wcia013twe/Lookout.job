// Allowlisted executable adapter. No credential or canonical user workspace is passed here.
import { readFile, writeFile, mkdtemp, rm } from 'node:fs/promises';
import { isIP } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
const exec = promisify(execFile);
const vendor = fileURLToPath(new URL('./vendor/career-ops/', import.meta.url));
const text = value => typeof value === 'string' ? value : '';
export function publicUrl(value) {
 const u=new URL(value);if(u.protocol!=='https:'||u.username||u.password||u.port&&u.port!=='443'||u.hostname==='localhost'||u.hostname.endsWith('.local')||u.hostname.endsWith('.internal')||isIP(u.hostname.replace(/^\[|\]$/g,'')))throw Error('Public HTTPS source required');return u.href;
}
export async function providerCatalog() {
 const {loadProviders}=await import('./vendor/career-ops/providers/_registry.mjs');
 return [...(await loadProviders(path.join(vendor,'providers'))).values()].map(p=>({id:p.id,automaticDetection:typeof p.detect==='function'}));
}
export async function scanSource({target,config={},keywords=[],limit=50}, injected) {
 publicUrl(target.address);
 const {loadProviders,resolveProvider}=await import('./vendor/career-ops/providers/_registry.mjs');
 const {makeHttpCtx}=await import('./vendor/career-ops/providers/_http.mjs');
 const {withConnectionScope}=await import('./vendor/career-ops/providers/_connection-scope.mjs');
 const providers=injected?.providers||await loadProviders(path.join(vendor,'providers'));
 const entry={name:target.name,careers_url:target.address,...config,max_pages:3,getro_max_pages:3};
 // Only canonical saved address and scalar, explicitly configured provider options enter vendor code.
 const resolved=resolveProvider(entry,providers,{skipIds:['local-parser']});
 if(!resolved?.provider) return {targetId:target.id,status:'unsupported',error:resolved?.error||'No matching public provider; configure a provider or use browser sourcing',jobs:[]};
 let requests=0;const ctx=injected?.ctx||makeHttpCtx({onRequest(){if(++requests>20)throw Error('Source request budget exceeded');}});
 ctx.maxPages=3;ctx.sleep=ms=>new Promise(r=>setTimeout(r,Math.min(ms,1000)));
 const jobs=await withConnectionScope(()=>resolved.provider.fetch(entry,ctx));
 const seen=new Set();const normalized=[];
 for(const j of jobs||[]) {
  if(!j.title||!j.url)continue;
  let url;try{url=publicUrl(j.url);}catch{continue;}
  if(seen.has(url)||keywords.length&&!keywords.some(k=>`${j.title} ${j.description||''} ${j.location||''}`.toLowerCase().includes(k.toLowerCase())))continue;
  seen.add(url);normalized.push({title:text(j.title).slice(0,500),url,company:text(j.company||target.name).slice(0,200),location:text(j.location).slice(0,500),description:text(j.description).slice(0,12000),...(Number.isFinite(j.postedAt)?{postedAt:new Date(j.postedAt).toISOString()}:{}),listingIdentity:j.listingIdentity??null,externalId:j.externalId??null,requisitionId:j.requisitionId??null,salary:j.salary??null,provider:resolved.provider.id,sourceTargetId:target.id,verification:'discovered'});
  if(normalized.length>=limit)break;
 }
 return {targetId:target.id,provider:resolved.provider.id,status:'ok',requests,returned:normalized.length,available:jobs?.length||0,truncated:seen.size>=limit||jobs?.length>limit||Boolean(jobs?.workdayTruncated),jobs:normalized};
}
export async function auditDocument({html,keywords=[],profileFacts={}}) {
 const {auditAts,extractVisibleText}=await import('./vendor/career-ops/verify-ats.mjs');
 const {analyzeCoverage}=await import('./vendor/career-ops/keyword-match.mjs');
 const {auditClaims}=await import('./vendor/career-ops/verify-cv-facts.mjs');
 const visible=extractVisibleText(html);
 return {ats:auditAts(html),keywords:analyzeCoverage(keywords,visible),facts:auditClaims(visible,JSON.stringify(profileFacts)),limitations:['Heuristic source-HTML audit, not an employer ATS acceptance prediction.','Fact checks do not replace human review of names, dates and claims.']};
}
export async function analyzeCareer(context) {
 const {computeVelocity,foldObservations}=await import('./vendor/career-ops/funnel-velocity.mjs');
 const {fold,parseObservations}=await import('./vendor/career-ops/salary-gap.mjs');
 const {computeTrackerStats}=await import('./vendor/career-ops/stats.mjs');
 const {computeCalibration}=await import('./vendor/career-ops/calibrate.mjs');
 const {computeTargetedGaps}=await import('./vendor/career-ops/upskill.mjs');
 const escape=v=>String(v??'').replaceAll('|','/').replaceAll('\n',' ');
 const evaluations=new Map();for(const r of context.results||[])if(r.kind==='evaluation')evaluations.set(r.application_id,r.result);
 const rows=(context.applications||[]).map((a,i)=>({num:i+1,company:a.job?.employer?.company||'Unknown',score:evaluations.get(a.id)?.score??null,status:({Submitted:'Applied',Interview:'Interview',Offer:'Offer',Rejected:'Rejected',Withdrawn:'Discarded'})[a.status]||'Evaluated',id:a.id}));
 const tracker='| # | Date | Company | Role | Score | Status | PDF | Report | Notes |\n|---|---|---|---|---|---|---|---|---|\n'+rows.map(r=>`| ${r.num} | | ${escape(r.company)} | | ${r.score??''} | ${r.status} | | | |`).join('\n');
 const stats=computeTrackerStats(tracker);
 const reached=new Map(rows.map(r=>[r.num,{reachedInterview:(context.milestones||[]).some(m=>m.application_id===r.id&&['interview','technical_round','recruiter_call'].includes(m.kind)&&m.phase==='completed'),reachedOffer:(context.milestones||[]).some(m=>m.application_id===r.id&&m.kind==='offer'&&['received','completed'].includes(m.phase))}]));
 const submitted=new Set((context.applications||[]).filter(a=>a.submitted_at||a.status==='Submitted'||a.receipt?.source==='runner-observed-greenhouse-confirmation'||(context.milestones||[]).some(m=>m.application_id===a.id&&m.kind==='submitted'&&['received','completed'].includes(m.phase))).map(a=>a.id));
 const submittedRows=rows.filter(r=>submitted.has(r.id));
 const responded=new Set((context.milestones||[]).filter(m=>submitted.has(m.application_id)&&['recruiter_call','technical_round','interview','offer','rejected'].includes(m.kind)&&['received','completed'].includes(m.phase)).map(m=>m.application_id));
 const interview=submittedRows.filter(r=>reached.get(r.num).reachedInterview).length;const offers=submittedRows.filter(r=>reached.get(r.num).reachedOffer).length;
 const rate=n=>submitted.size?Math.round(n/submitted.size*1000)/10:null;
 const funnel={everApplied:submitted.size,everResponded:responded.size,everInterview:interview,everOffer:offers,responseRate:rate(responded.size),interviewRate:rate(interview),offerRate:rate(offers),smallSample:submitted.size<10,basis:'explicit Lookout submission and milestone evidence; no submission inferred from rejection/interview'};
 const sourceScans=(context.results||[]).filter(r=>r.kind==='scan').flatMap(r=>r.result.sources||[]);
 const sources=Object.values(sourceScans.reduce((a,s)=>{const v=a[s.targetId]??={targetId:s.targetId,runs:0,errors:0,discoveries:0};v.runs++;v.errors+=s.status==='ok'?0:1;v.discoveries+=s.returned||0;return a;},{}));
 const missing=(context.results||[]).filter(r=>r.kind==='evaluation').flatMap(r=>(r.result.requirements||[]).filter(q=>['missing','partial'].includes(q.match)).map(q=>q.requirement)).join('\n');
 const stage={submitted:'Applied',recruiter_call:'Responded',technical_round:'Assessment',interview:'Interview',offer:'Offer',rejected:'Rejected'};
 const observations=(context.milestones||[]).filter(m=>m.occurred_at&&['completed','received'].includes(m.phase)&&stage[m.kind]).map(m=>({num:m.application_id,to:stage[m.kind],date:m.occurred_at.slice(0,10),source:'lookout-evidence',dayMath:true}));
 const appNumbers=new Map(rows.map(r=>[r.id,String(r.num)]));
 const compensation=(context.results||[]).filter(r=>r.kind==='compensation'&&appNumbers.has(r.application_id)).map(r=>[appNumbers.get(r.application_id),r.result.date,r.result.type,r.result.amount,r.result.currency,r.result.source,r.result.note||''].map(escape).map(v=>v.replaceAll('\t',' ')).join('\t')).join('\n');
 return {velocity:computeVelocity(foldObservations(observations),new Date().toISOString().slice(0,10)),compensation:fold(parseObservations(compensation),Object.fromEntries(rows.map(r=>[String(r.num),{company:r.company}]))),tracker:stats,funnel,calibration:computeCalibration(submittedRows,new Map(),{reached}),skillGaps:computeTargetedGaps(missing,JSON.stringify(context.profile?.facts||{})),sources,coverage:{...context.coverage,scoredApplications:rows.filter(r=>r.score!==null).length,scanRuns:sourceScans.length},limitations:['No inferred submission dates or historical outcomes.','Calibration needs scored applications and observed outcomes; missing history remains insufficient.','Source productivity counts observations in the retained result window, not unique lifetime jobs.']};
}
export async function generateDocument({kind,payload,template='classic',profileFacts={},keywords=[]}) {
 const workspace=await mkdtemp(path.join(tmpdir(),'lookout-document-'));
 try {
  if(!payload?.candidate?.name||payload.candidate.photo||payload.candidate.photo_url)throw Error('Candidate name required; external photos are not supported');
  let html;
  if(kind==='resume') {
   const templates={classic:'cv-template.html',compact:'cv-template.compact.html',modern:'cv-template.modern.html',jake:'cv-template.jake.html'};
   if(!templates[template])throw Error('Unknown template');
   await writeFile(path.join(workspace,'input.json'),JSON.stringify(payload),{mode:0o600});
   await exec(process.execPath,[path.join(vendor,'build-cv-html.mjs'),path.join(workspace,'input.json'),path.join(workspace,'document.html'),path.join(vendor,'templates',templates[template])],{cwd:workspace,env:{...process.env,CAREER_OPS_ROOT:workspace},timeout:30000,maxBuffer:100000});
   html=await readFile(path.join(workspace,'document.html'),'utf8');
  } else if(kind==='cover_letter') {
   const {buildHtml}=await import('./vendor/career-ops/generate-cover-letter.mjs');html=buildHtml(payload,path.join(vendor,'templates/cover-letter-template.html'));
  } else throw Error('Unknown document kind');
  const audit=await auditDocument({html,keywords,profileFacts});
  const {renderHtmlToPdf}=await import('./vendor/career-ops/generate-pdf.mjs');
  const {chromium}=await import('playwright');
  const out=path.join(workspace,'document.pdf');
  const render=await renderHtmlToPdf(html,out,{workspaceRoot:workspace,baseDir:vendor,kind:kind==='resume'?'cv':'cover',format:'letter',launchBrowser:opts=>chromium.launch({...opts,headless:true,...(process.env.LOOKOUT_CHROMIUM_EXECUTABLE?{executablePath:process.env.LOOKOUT_CHROMIUM_EXECUTABLE}:{})})});
  const pdf=await readFile(out);if(pdf.length>10485760)throw Error('PDF exceeds limit');
  return {pdf:pdf.toString('base64'),audit,render:{pageCount:render.pageCount,size:render.size}};
 }finally{await rm(workspace,{recursive:true,force:true});}
}
// The backend uses the existing isolated worker boundary. Only copied provider
// and scanner/tracker functions decide identity; Lookout maps public rows back.
export async function deduplicateDiscovery(jobs,previous=[],workspace=process.env.CAREER_OPS_ROOT) {
 if(!workspace)throw Error('Isolated discovery workspace required');
 const scanner=await import('./vendor/career-ops/scan.mjs');
 const {postingUrlRelation}=await import('./vendor/career-ops/url-key.mjs');
 const {resolveColumns,parseTrackerRow}=await import('./vendor/career-ops/tracker-parse.mjs');
 previous=previous.map(row=>{
  const parts=String(row.identity||row.atsIdentity||'').replace(/^ats:/,'').split(':');
  return {...row,...(!row.listingIdentity&&parts.length===3&&['greenhouse','lever'].includes(parts[0])?{listingIdentity:{ats_provider:parts[0],board_slug:parts[1],posting_id:parts[2]}}:{})};
 });
 const seen=new Set();
 for(const row of previous)scanner.markOfferSeen(row,seen);
 const candidates=[];
 for(const row of jobs){
  // The copied tracker URL relation vetoes weak merges on two distinct public
  // posting URLs (including functional ref/source parameters). A provider's
  // explicit strong identity can still identify the same ATS posting.
  const strong=scanner.listingIdentityToken(row);
  const known=Boolean(strong&&seen.has(strong))||[...previous,...candidates].some(prior=>postingUrlRelation(prior.url,row.url)==='same');
  if(known&&scanner.isOfferSeen(row,seen))continue;
  scanner.markOfferSeen(row,seen);candidates.push(row);
 }
 const all=[...previous,...candidates];
 const cell=v=>String(v??'').replaceAll('|','/').replace(/\r?\n/g,' ');
 const header='| # | Date | Company | Role | Score | Status | PDF | Report | Notes | URL | Location |';
 const table=header+'\n|---|---|---|---|---|---|---|---|---|---|---|\n'+all.map((r,i)=>'| '+[i+1,'',r.company,r.title,'0','Evaluated','','',r.requisitionId?'Job id '+r.requisitionId:'',r.url,r.location||''].map(cell).join(' | ')+' |').join('\n')+'\n';
 const tracker=path.join(workspace,'discovery-tracker.md');
 await writeFile(tracker,table,{mode:0o600});
 // This original CLI is intentionally NOT imported: it performs top-level file
 // transactions. Those transactions touch only this disposable mapped tracker.
 await exec(process.execPath,[path.join(vendor,'dedup-tracker.mjs')],{cwd:workspace,env:{...process.env,CAREER_OPS_ROOT:workspace,CAREER_OPS_TRACKER:tracker},timeout:30000,maxBuffer:1000000});
 const result=await readFile(tracker,'utf8');const columns=resolveColumns(result);
 const retained=new Set(result.split('\n').map(line=>parseTrackerRow(line,columns)?.num).filter(Boolean));
 return candidates.filter((_row,index)=>retained.has(previous.length+index+1));
}
export async function scanDiscovery(input) {
 const greenhouse=(await import('./vendor/career-ops/providers/greenhouse.mjs')).default;
 const lever=(await import('./vendor/career-ops/providers/lever.mjs')).default;
 const providers=new Map([[greenhouse.id,greenhouse],[lever.id,lever]]);
 const scan=await scanSource({target:input.target,config:input.config||{},limit:500},{providers});
 if(scan.status!=='ok')return {...scan,provenance:{commit:'c78e14cdfd52f18a92e4a67694efab7ddef59385',scanner:'runner/career-worker.mjs scanSource',dedup:'scan.mjs + dedup-tracker.mjs'},jobs:[]};
 const jobs=await deduplicateDiscovery(scan.jobs,input.previous||[]);
 return {...scan,jobs,duplicates:scan.jobs.length-jobs.length,provenance:{commit:'c78e14cdfd52f18a92e4a67694efab7ddef59385',provider:'providers/'+scan.provider+'.mjs',scanner:'runner/career-worker.mjs scanSource',identity:'scan.mjs isOfferSeen/markOfferSeen',dedup:'dedup-tracker.mjs'}};
}
export async function runTask({task,input}) {
 if(task==='discovery')return scanDiscovery(input);
 if(task==='dedup-discovery')return deduplicateDiscovery(input.jobs,input.previous);
 if(task==='catalog')return providerCatalog();
 if(task==='scan')return scanSource(input);
 if(task==='audit')return auditDocument(input);
 if(task==='analytics')return analyzeCareer(input);
 if(task==='document')return generateDocument(input);
 if(task==='verify') {publicUrl(input.url);const {checkLivenessViaApi}=await import('./vendor/career-ops/liveness-api.mjs');const result=await checkLivenessViaApi(input.url);return {...(result||{result:'uncertain',code:'unsupported_or_inconclusive',reason:'No conclusive public ATS verification; inspect the official employer page.'}),url:input.url,checkedAt:new Date().toISOString()};}
 throw Error('Unknown toolkit task');
}
if(process.argv[1]===fileURLToPath(import.meta.url)) {
 let input='';for await(const chunk of process.stdin){input+=chunk;if(input.length>2000000)throw Error('Input too large');}
 // Vendor CLI diagnostics must never corrupt MCP stdout.
 console.log=(...args)=>console.error(...args);
 try{const result=await runTask(JSON.parse(input));process.stdout.write(JSON.stringify({result}));}catch(e){process.stdout.write(JSON.stringify({error:String(e.message).slice(0,500)}));process.exitCode=1;}
}
