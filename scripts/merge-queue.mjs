import { pathToFileURL } from 'node:url';
import { appendFile } from 'node:fs/promises';
import { githubApi, paginate } from './github-api.mjs';
export const queuedPull = pulls => pulls.filter(pr=>!pr.draft && pr.labels.some(label=>label.name==='merge-ready')).sort((a,b)=>a.created_at.localeCompare(b.created_at)||a.number-b.number)[0];
// The worker executes trusted main code only. GitHub protection and a final SHA
// comparison are independent safeguards; this worker never bypasses protections.
export async function runQueue({api,repo,log=console.log}) {
  if(!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repo))throw Error('Repository identity required');
  const root='/repos/'+repo;
  const pulls=await paginate(api,root+'/pulls?state=open&base=main&sort=created&direction=asc');
  const candidate=queuedPull(pulls);
  if(!candidate){log('No ready pull requests');return 'empty';}
  let pr=await api('GET',root+'/pulls/'+candidate.number);
  if(pr.head.repo?.full_name!==repo){log('Fork PRs require maintainer integration');return 'fork';}
  const latest=(await api('GET',root+'/git/ref/heads/main')).object.sha;
  // Production publishes remain serialized, but a running release must not
  // hold up branch refresh, CI, or another independently validated merge.
  const releases=await paginate(api,root+'/actions/workflows/deploy.yml/runs?branch=main','workflow_runs');
  const release=releases.filter(run=>run.status==='completed' && !['cancelled','skipped'].includes(run.conclusion)).sort((a,b)=>b.id-a.id)[0];
  if(release && release.conclusion!=='success'){log('Latest completed production release failed; queue paused');return 'deployment-failed';}
  const comparison=await api('GET',root+'/compare/'+latest+'...'+pr.head.sha);
  if(!['ahead','identical'].includes(comparison.status)) {
    try {await api('PUT',root+'/pulls/'+pr.number+'/update-branch',{expected_head_sha:pr.head.sha});}
    catch(error){if(error.status===422){log('Oldest ready PR has conflicts; queue paused');return 'conflict';}throw error;}
    // GITHUB_TOKEN updates do not trigger normal PR workflows. Explicit dispatch
    // is supported and ensures the updated branch gets CI without a PAT.
    await api('POST',root+'/actions/workflows/ci.yml/dispatches',{ref:pr.head.ref});
    log('Updated oldest ready PR; waiting for fresh CI and review');return 'updated';
  }
  // Bot branch updates create approval-required PR runs on current GitHub.
  // Approve only this reviewed same-repository PR's CI at its exact head.
  const pending=await paginate(api,root+'/actions/workflows/ci.yml/runs?head_sha='+pr.head.sha+'&status=action_required','workflow_runs');
  const approval=pending.find(run=>run.head_sha===pr.head.sha && run.head_repository?.full_name===repo && run.path==='.github/workflows/ci.yml' && run.event==='pull_request' && run.pull_requests?.some(p=>p.number===pr.number));
  if(approval){
    await api('POST',root+'/actions/runs/'+approval.id+'/approve');
    log('Approved queued PR CI for its reviewed head; waiting for checks');return 'approving';
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
  await api('POST',root+'/actions/workflows/merge-queue.yml/dispatches',{ref:'main'});
  log('Merged PR #'+pr.number+'; deployment and the next queue pass dispatched');return 'merged';
}
if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href) {
  try {const result=await runQueue({api:githubApi(process.env.GH_TOKEN),repo:process.env.GITHUB_REPOSITORY});if(process.env.GITHUB_STEP_SUMMARY)await appendFile(process.env.GITHUB_STEP_SUMMARY,`Merge queue: **${result}**\n`);}
  catch(error){console.error(error.message);process.exitCode=1;}
}
