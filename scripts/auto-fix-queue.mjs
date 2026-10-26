// Read-only queue inspection for a separately configured triple t schedule.
import {pathToFileURL} from 'node:url';
import {githubApi,paginate} from './github-api.mjs';
const repository='wcia013twe/Lookout.job';
export async function readFixQueue({api,repo=repository}) {
  if(repo!==repository)throw Error('Unexpected repository');
  const root='/repos/'+repo;
  const issues=await paginate(api,`${root}/issues?state=open&labels=auto-fix&sort=created&direction=asc`);
  const eligible=issues.filter(i=>!i.pull_request&&i.state==='open'&&i.user?.login==='wcia013twe'&&
    i.labels?.some(l=>l.name==='auto-fix')&&Number.isSafeInteger(i.number)&&i.number>0);
  if(!eligible.length)return [];
  const pulls=await paginate(api,`${root}/pulls?state=all&base=main`);
  const queue=[];
  for(const issue of eligible){
    const comments=await paginate(api,`${root}/issues/${issue.number}/comments`);
    const legacyReservation=comments.some(c=>c.user?.login==='github-actions[bot]'&&c.body?.includes('<!-- lookout-cloud-launch-v1 -->'));
    const linked=pulls.filter(p=>p.head?.repo?.full_name===repo&&p.body?.includes(`<!-- lookout-auto-fix-issue:${issue.number} -->`)&&(p.state==='open'||p.merged_at));
    queue.push({issueNumber:issue.number,url:`https://github.com/${repo}/issues/${issue.number}`,
      state:legacyReservation?'needs_reconciliation':linked.length?'linked_pr':'queued',
      pullRequests:linked.map(p=>p.number)});
  }
  return queue;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  try{console.log(JSON.stringify(await readFixQueue({api:githubApi(process.env.GH_TOKEN)})));}
  catch{console.error('Queue could not be verified; do not start a repair.');process.exitCode=1;}
}
