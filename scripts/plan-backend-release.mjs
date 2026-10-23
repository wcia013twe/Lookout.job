import {appendFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {githubApi,paginate} from './github-api.mjs';

export async function planBackendRelease({api,repo,sha}) {
  if(!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repo)||!/^([a-f0-9]{40})$/.test(sha))throw Error('Release identity required');
  const root='/repos/'+repo;
  const runs=await paginate(api,root+'/actions/workflows/deploy.yml/runs?branch=main&status=success','workflow_runs');
  const previous=runs.filter(r=>r.conclusion==='success'&&r.head_branch==='main').sort((a,b)=>b.id-a.id)[0];
  if(!previous)return {backend:true,reason:'First recorded release requires backend bootstrap'};
  if(previous.head_sha===sha)return {backend:false,reason:'Commit already released'};
  const comparison=await api('GET',`${root}/compare/${previous.head_sha}...${sha}`);
  if(!['ahead','identical'].includes(comparison.status))throw Error('Release is stale or diverged; refusing to roll production backward');
  if(!Array.isArray(comparison.files)||comparison.files.length>=300)throw Error('Release file comparison is incomplete');
  const backendPath=p=>p==='supabase/config.toml'||/^supabase\/(functions|migrations)\//.test(p||'');
  return {backend:comparison.files.some(f=>backendPath(f.filename)||backendPath(f.previous_filename)),reason:'Compared with last successful complete release'};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href) {
  try{
    const plan=await planBackendRelease({api:githubApi(process.env.GH_TOKEN),repo:process.env.GITHUB_REPOSITORY,sha:process.env.GITHUB_SHA});
    if(process.env.GITHUB_OUTPUT)await appendFile(process.env.GITHUB_OUTPUT,`backend=${plan.backend}\n`);
    console.log(plan.reason+'; backend='+plan.backend);
  }catch{console.error('Could not verify release scope; refusing partial deployment.');process.exitCode=1;}
}
