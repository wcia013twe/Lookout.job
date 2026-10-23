import {BUG_REPOSITORY} from './bug-report.mjs';

export const BUG_STATUS_TOOL={name:'get_bug_status',operation:'bugs.status',scope:'activity:write',readOnly:true,
  description:'Check a reported Lookout issue for a verified release signal. Only the configured Muse connection can call. Retry the original fictional steps only when state=ready_to_retry and releaseId differs from the last attempted release. A closed issue or merged PR alone does not prove deployment. Returns metadata only, never issue prose or private diagnostics.',
  inputSchema:{type:'object',additionalProperties:false,required:['issueNumber'],properties:{issueNumber:{type:'integer',minimum:1}}}};

export function validateBugStatus(p) {
  if(!p||typeof p!=='object'||Array.isArray(p)||Object.keys(p).length!==1||!Number.isSafeInteger(p.issueNumber)||p.issueNumber<=0)throw Error('Use a positive issueNumber.');
}

export const releaseMarker=(pr,run,outcome='success',attempt=1)=>`<!-- lookout-release-v1 pr=${pr} run=${run} outcome=${outcome} attempt=${attempt} -->`;
export function parseReleaseMarker(body) {
  const m=body?.match(/<!-- lookout-release-v1 pr=([1-9]\d*) run=([1-9]\d*) outcome=(success|failure) attempt=([1-9]\d*) -->/);
  if(!m)return null;
  const pr=Number(m[1]),run=Number(m[2]),attempt=Number(m[4]);
  return [pr,run,attempt].every(Number.isSafeInteger)?{pr,run,outcome:m[3],attempt}:null;
}
export const issueMarker=number=>`<!-- lookout-auto-fix-issue:${number} -->`;
export const validFix=(pr,number)=>pr?.merged===true&&pr.base?.ref==='main'&&pr.head?.repo?.full_name===BUG_REPOSITORY&&
  pr.labels?.some(l=>l.name==='auto-fix')&&pr.body?.includes(issueMarker(number))&&/^[a-f0-9]{40}$/.test(pr.merge_commit_sha||'');
export const validReleaseRun=run=>run?.path==='.github/workflows/deploy.yml'&&run.head_branch==='main'&&
  run.head_repository?.full_name===BUG_REPOSITORY&&['push','workflow_dispatch'].includes(run.event)&&
  run.status==='completed'&&Number.isSafeInteger(run.run_attempt)&&run.run_attempt>0&&/^[a-f0-9]{40}$/.test(run.head_sha||'');

/** @returns {Promise<{status:number,data?:object,error?:string}>} */
export async function getBugStatus({payload,authorize,token,connectionId,fetchImpl=fetch}) {
  const auth=await authorize();
  if(auth.status!==200)return {status:auth.status,error:'Credential invalid, expired, or revoked'};
  if(!connectionId||auth.data?.id!==connectionId||!auth.data?.scopes?.includes(BUG_STATUS_TOOL.scope))return {status:403,error:'Bug reporting is restricted to the configured Muse connection.'};
  try{validateBugStatus(payload);}catch(e){return {status:400,error:e.message};}
  if(!token)return {status:503,error:'Bug status is not configured.'};
  const number=payload.issueNumber;
  const root=`https://api.github.com/repos/${BUG_REPOSITORY}`;
  const api=async path=>{
    const r=await fetchImpl(root+path,{redirect:'error',signal:AbortSignal.timeout(10000),headers:{Authorization:`Bearer ${token}`,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28'}});
    if(!r.ok)throw Error('GitHub unavailable');return r.json();
  };
  const all=async path=>{
    const result=[];
    for(let page=1;page<=10;page++){
      const rows=await api(path+`?per_page=100&page=${page}`);
      if(!Array.isArray(rows))throw Error('Invalid response');
      result.push(...rows);if(rows.length<100)return result;
    }
    throw Error('Result truncated');
  };
  try {
    const issue=await api(`/issues/${number}`);
    if(issue.pull_request||issue.user?.login!=='wcia013twe'||!issue.labels?.some(l=>l.name==='auto-fix'))return {status:404,error:'Owned auto-fix report not found.'};
    const base={issueNumber:number,url:`https://github.com/${BUG_REPOSITORY}/issues/${number}`,issueState:issue.state,readyToRetry:false};
    const comments=await all(`/issues/${number}/comments`);
    const signal=comments.filter(c=>c.user?.login==='github-actions[bot]'&&parseReleaseMarker(c.body))
      .sort((a,b)=>{const x=parseReleaseMarker(a.body),y=parseReleaseMarker(b.body);return y.run-x.run||y.attempt-x.attempt;})[0];
    if(!signal)return {status:200,data:{...base,state:issue.state==='closed'?'closed_unverified':'awaiting_release'}};
    const receipt=parseReleaseMarker(signal.body);
    const pr=await api(`/pulls/${receipt.pr}`);
    const run=await api(`/actions/runs/${receipt.run}`);
    if(!validFix(pr,number)||!validReleaseRun(run)||run.run_attempt!==receipt.attempt)throw Error('Unverified release signal');
    const comparison=await api(`/compare/${pr.merge_commit_sha}...${run.head_sha}`);
    if(!['ahead','identical'].includes(comparison.status))throw Error('Fix absent from release');
    const events=await all(`/issues/${number}/events`);
    const releasedAt=Date.parse(run.updated_at);
    if(!Number.isFinite(releasedAt))throw Error('Missing release time');
    if(events.some(e=>e.event==='reopened'&&Date.parse(e.created_at)>releasedAt))return {status:200,data:{...base,state:'awaiting_release'}};
    const ready=run.conclusion==='success';
    return {status:200,data:{...base,state:ready?'ready_to_retry':'release_failed',readyToRetry:ready,
      releaseId:`${receipt.run}:${receipt.attempt}:${receipt.pr}`,pullRequest:`https://github.com/${BUG_REPOSITORY}/pull/${receipt.pr}`,
      releaseRun:`https://github.com/${BUG_REPOSITORY}/actions/runs/${receipt.run}`,releasedCommit:run.head_sha}};
  } catch {return {status:503,error:'Release status could not be verified. Do not assume the fix is deployed.'};}
}
