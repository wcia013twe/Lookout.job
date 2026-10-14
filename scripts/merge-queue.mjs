import { pathToFileURL } from 'node:url';
import { appendFile } from 'node:fs/promises';
import { githubApi, paginate } from './github-api.mjs';
export const isCopilot = actor => actor?.type === 'Bot' && ['copilot-pull-request-reviewer[bot]','Copilot'].includes(actor.login);
export const queuedPull = pulls => pulls.filter(pr=>!pr.draft && pr.labels.some(label=>label.name==='merge-ready')).sort((a,b)=>a.created_at.localeCompare(b.created_at)||a.number-b.number)[0];
export function reviewGate(reviews,head,threads) {
  const current=reviews.filter(review=>isCopilot(review.user) && review.commit_id===head).sort((a,b)=>b.id-a.id)[0];
  if(!current || !['COMMENTED','APPROVED','CHANGES_REQUESTED'].includes(current.state))return {state:'pending',reason:'Waiting for Copilot to review this commit'};
  if(current.state==='CHANGES_REQUESTED')return {state:'failure',reason:'Copilot requested changes'};
  if(threads.some(thread=>!thread.isResolved))return {state:'pending',reason:'Resolve review conversations before merging'};
  return {state:'success',reason:'Copilot reviewed this commit; conversations resolved'};
}
async function threadsFor(api,owner,name,number) {
  const result=[];let cursor=null;
  for(let page=0;page<100;page++) {
    const response=await api('POST','/graphql',{query:'query($owner:String!,$name:String!,$number:Int!,$cursor:String){repository(owner:$owner,name:$name){pullRequest(number:$number){reviewThreads(first:100,after:$cursor){nodes{isResolved}pageInfo{hasNextPage endCursor}}}}}',variables:{owner,name,number,cursor}});
    if(response.errors)throw Error('Review conversation lookup failed');
    const threads=response.data.repository.pullRequest.reviewThreads;result.push(...threads.nodes);
    if(!threads.pageInfo.hasNextPage)return result;cursor=threads.pageInfo.endCursor;
  }
  throw Error('Review conversations exceed bounded pagination');
}
// The worker executes trusted main code only. GitHub protection and a final SHA
// comparison are independent safeguards; this worker never bypasses protections.
export async function runQueue({api,repo,log=console.log}) {
  if(!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repo))throw Error('Repository identity required');
  const root='/repos/'+repo, [owner,name]=repo.split('/');
  const pulls=await paginate(api,root+'/pulls?state=open&base=main&sort=created&direction=asc');
  const candidate=queuedPull(pulls);
  if(!candidate){log('No ready pull requests');return 'empty';}
  const status=async(head,state,description)=>api('POST',root+'/statuses/'+head,{state,context:'Copilot review',description:description.slice(0,140)});
  let pr=await api('GET',root+'/pulls/'+candidate.number);
  if(pr.head.repo?.full_name!==repo){await status(pr.head.sha,'pending','Fork PRs require maintainer integration into a repository branch');return 'fork';}
  const latest=(await api('GET',root+'/git/ref/heads/main')).object.sha;
  // Do not merge the next feature until the current production release succeeds.
  const releases=await paginate(api,root+'/actions/workflows/deploy.yml/runs?branch=main&head_sha='+latest,'workflow_runs');
  const release=releases.filter(run=>run.head_sha===latest).sort((a,b)=>b.id-a.id)[0];
  if(!release){await api('POST',root+'/actions/workflows/deploy.yml/dispatches',{ref:'main'});log('Dispatched missing production deployment');return 'deploying';}
  if(release.status!=='completed'){log('Waiting for production deployment');return 'deploying';}
  if(release.conclusion!=='success'){log('Production failed; queue paused until deployment is fixed');return 'deployment-failed';}
  const comparison=await api('GET',root+'/compare/'+latest+'...'+pr.head.sha);
  if(!['ahead','identical'].includes(comparison.status)) {
    await status(pr.head.sha,'pending','Updating branch against current main');
    try {await api('PUT',root+'/pulls/'+pr.number+'/update-branch',{expected_head_sha:pr.head.sha});}
    catch(error){if(error.status===422){log('Oldest ready PR has conflicts; queue paused');return 'conflict';}throw error;}
    // GITHUB_TOKEN updates do not trigger normal PR workflows. Explicit dispatch
    // is supported and ensures the updated branch gets CI without a PAT.
    await api('POST',root+'/actions/workflows/ci.yml/dispatches',{ref:pr.head.ref});
    log('Updated oldest ready PR; waiting for fresh CI and review');return 'updated';
  }
  const reviews=await paginate(api,root+'/pulls/'+pr.number+'/reviews');
  const gate=reviewGate(reviews,pr.head.sha,await threadsFor(api,owner,name,pr.number));
  await status(pr.head.sha,gate.state,gate.reason);
  if(gate.state!=='success') {
    if(gate.reason.startsWith('Waiting') && !pr.requested_reviewers.some(isCopilot)) {
      try {await api('POST',root+'/pulls/'+pr.number+'/requested_reviewers',{reviewers:['copilot-pull-request-reviewer[bot]']});log('Requested Copilot review for oldest ready PR');}
      catch(error){if([403,422].includes(error.status)){log('Copilot review is unavailable; enable Copilot access or request the review in GitHub');return 'copilot-unavailable';}throw error;}
    }
    return 'review';
  }
  const checks=[];
  for(const sha of new Set([pr.head.sha,pr.merge_commit_sha].filter(Boolean)))checks.push(...await paginate(api,root+'/commits/'+sha+'/check-runs?check_name=CI','check_runs'));
  const ci=checks.filter(check=>check.name==='CI').sort((a,b)=>b.id-a.id)[0];
  if(!ci){await api('POST',root+'/actions/workflows/ci.yml/dispatches',{ref:pr.head.ref});return 'testing';}
  if(ci.status!=='completed'||ci.conclusion!=='success'){log('Waiting for passing CI on the current change');return 'testing';}
  // Recheck ready label, exact head, current main and GitHub's own mergeability.
  const current=await api('GET',root+'/pulls/'+pr.number);
  const baseNow=(await api('GET',root+'/git/ref/heads/main')).object.sha;
  if(current.state!=='open'||current.draft||!current.labels.some(label=>label.name==='merge-ready')||current.head.sha!==pr.head.sha||baseNow!==latest)return 'changed';
  if(current.mergeable_state!=='clean'){log('GitHub protections or mergeability still block this PR');return 'protected';}
  const merged=await api('PUT',root+'/pulls/'+pr.number+'/merge',{sha:pr.head.sha,merge_method:'squash'});
  if(!merged.merged)throw Error('Merge was not confirmed');
  // GITHUB_TOKEN merges suppress ordinary push events. Explicitly dispatch the
  // trusted main deployment, rather than leaving the new code undeployed.
  await api('POST',root+'/actions/workflows/deploy.yml/dispatches',{ref:'main'});
  log('Merged PR #'+pr.number+' and dispatched production deployment');return 'merged';
}
if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href) {
  try {const result=await runQueue({api:githubApi(process.env.GH_TOKEN),repo:process.env.GITHUB_REPOSITORY});if(process.env.GITHUB_STEP_SUMMARY)await appendFile(process.env.GITHUB_STEP_SUMMARY,`Merge queue: **${result}**\n`);}
  catch(error){console.error(error.message);process.exitCode=1;}
}
