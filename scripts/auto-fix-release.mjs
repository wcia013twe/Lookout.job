import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {githubApi,paginate} from './github-api.mjs';
import {BUG_REPOSITORY} from '../supabase/functions/agent-gateway/bug-report.mjs';
import {parseReleaseMarker,releaseMarker,validFix,validReleaseRun,needsBackendRelease} from '../supabase/functions/agent-gateway/bug-status.mjs';

// This workflow runs trusted default-branch code after the full release. The
// receipt identifies the actual deployment run, not a PR check or issue comment.
export async function signalRelease({api,repo,event}) {
  if(repo!==BUG_REPOSITORY)throw Error('Unexpected repository');
  const root='/repos/'+repo;
  const source=event.workflow_run;
  if(!Number.isSafeInteger(source?.id))throw Error('Release run required');
  const run=await api('GET',`${root}/actions/runs/${source.id}`);
  if(!validReleaseRun(run))return {skipped:true};
  // Include earlier fixes when several merges land before one successful release.
  const pulls=await paginate(api,`${root}/pulls?state=closed&base=main&sort=updated&direction=desc`);
  let signalled=0;
  for(const candidate of pulls) {
    if(!candidate.merged_at||!candidate.labels?.some(l=>l.name==='auto-fix'))continue;
    const match=candidate.body?.match(/<!-- lookout-auto-fix-issue:([1-9]\d*) -->/);
    const number=Number(match?.[1]);
    if(!Number.isSafeInteger(number))continue;
    const pr=await api('GET',`${root}/pulls/${candidate.number}`);
    if(!validFix(pr,number))continue;
    if(needsBackendRelease(await paginate(api,`${root}/pulls/${pr.number}/files`)))continue;
    const issue=await api('GET',`${root}/issues/${number}`);
    if(issue.user?.login!=='wcia013twe'||!issue.labels?.some(l=>l.name==='auto-fix'))continue;
    const events=await paginate(api,`${root}/issues/${number}/events`);
    const releasedAt=Date.parse(run.updated_at);
    if(!Number.isFinite(releasedAt)||events.some(e=>e.event==='reopened'&&Date.parse(e.created_at)>releasedAt))continue;
    const comments=await paginate(api,`${root}/issues/${number}/comments`);
    const delivered=comments.find(c=>{const r=parseReleaseMarker(c.body);return c.user?.login==='github-actions[bot]'&&r?.pr===pr.number&&r.outcome==='success';});
    if(delivered){
      const previous=parseReleaseMarker(delivered.body);
      // Recover if posting succeeded but the following close request failed.
      if(previous.run===run.id&&previous.attempt===run.run_attempt&&issue.state==='open')await api('PATCH',`${root}/issues/${number}`,{state:'closed',state_reason:'completed'});
      continue;
    }
    const comparison=await api('GET',`${root}/compare/${pr.merge_commit_sha}...${run.head_sha}`);
    if(!['ahead','identical'].includes(comparison.status))continue;
    const marker=releaseMarker(pr.number,run.id,run.conclusion==='success'?'success':'failure',run.run_attempt);
    if(comments.some(c=>c.user?.login==='github-actions[bot]'&&c.body?.includes(marker)))continue;
    const ready=run.conclusion==='success';
    await api('POST',`${root}/issues/${number}/comments`,{body:
      `${marker}\n@wcia013twe — ${ready?'The fix was released. Muse can retry the fictional reproduction steps.':'The release did not succeed. Muse must wait; the fix is not confirmed deployed.'}\n\nPR: https://github.com/${repo}/pull/${pr.number}\nRelease: https://github.com/${repo}/actions/runs/${run.id}\n\nMuse: call get_bug_status with issueNumber ${number}; retry only when readyToRetry is true and releaseId is new.`});
    // Refs (not Fixes) in the PR keeps deduplication active until deployment.
    if(ready&&issue.state==='open')await api('PATCH',`${root}/issues/${number}`,{state:'closed',state_reason:'completed'});
    signalled++;
  }
  return {signalled};
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href) {
  try{const event=JSON.parse(await readFile(process.env.GITHUB_EVENT_PATH,'utf8'));console.log(JSON.stringify(await signalRelease({api:githubApi(process.env.GH_TOKEN),repo:process.env.GITHUB_REPOSITORY,event})));}
  catch{console.error('Release signalling failed; Muse must verify status before retrying.');process.exitCode=1;}
}
