import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
const marker='<!-- lookout-auto-fix-intake-v1 -->';

// An issue event is a real GitHub trigger, but not a Codex session launcher.
// No issue prose is executed or interpolated into shell commands.
export async function acknowledgeBug({event,repository,token,fetchImpl=fetch}) {
  if(repository!=='wcia013twe/Lookout.job')throw Error('Unexpected repository');
  const owner=repository.split('/')[0];
  const number=event.issue?.number;
  if(!Number.isSafeInteger(number)||number<=0)throw Error('Issue number required');
  const api=async(path,options={})=>{
    const r=await fetchImpl(`https://api.github.com/repos/${repository}${path}`,{
      ...options,redirect:'error',signal:AbortSignal.timeout(10000),
      headers:{Authorization:`Bearer ${token}`,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28','Content-Type':'application/json'},
    });
    if(!r.ok)throw Error(`GitHub intake failed (${r.status})`);
    return r.json();
  };
  const issue=await api(`/issues/${number}`);
  if(issue.state!=='open'||issue.user?.login!==owner||!issue.labels?.some(l=>l.name==='auto-fix'))return {skipped:true};
  let complete=false;
  for(let page=1;page<=10;page++) {
    const comments=await api(`/issues/${number}/comments?per_page=100&page=${page}`);
    if(comments.some(c=>c.user?.login==='github-actions[bot]'&&c.body?.includes(marker)))return {duplicate:true};
    if(comments.length<100){complete=true;break;}
  }
  if(!complete)throw Error('Comment scan exceeded limit');
  await api(`/issues/${number}/comments`,{method:'POST',body:JSON.stringify({body:
    `${marker}\n@${owner} — Muse reported a Lookout problem.\n\nThe report is available for the Codex cloud worker described in [the runbook](https://github.com/${repository}/blob/main/docs/auto-fix.md). This issue trigger acknowledges the report; it does **not** start a Codex session. Automatic pickup requires a separately registered cloud automation. No fix, PR, merge or deployment has occurred.`})});
  return {notified:true};
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href) {
  try {
    const event=JSON.parse(await readFile(process.env.GITHUB_EVENT_PATH,'utf8'));
    console.log(JSON.stringify(await acknowledgeBug({event,repository:process.env.GITHUB_REPOSITORY,token:process.env.GH_TOKEN})));
  } catch { console.error('Bug intake failed; inspect GitHub configuration. No coding session was started.');process.exitCode=1; }
}
