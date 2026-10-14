import { appendFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { githubApi } from './github-api.mjs';
const api=githubApi(process.env.GH_TOKEN),repo=process.env.GITHUB_REPOSITORY,sha=process.env.GITHUB_SHA;
if(!/^[a-f0-9]{40}$/.test(sha || '') || !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repo || ''))throw Error('Trusted deployment identity required');
const current=(await api('GET','/repos/'+repo+'/git/ref/heads/main')).object.sha;
if(sha!==current) {
 await appendFile(process.env.GITHUB_OUTPUT,'deploy=false\nbackend=false\n');
 console.log('A newer main commit exists; this stale deployment is skipped.');
} else {
 const runs=(await api('GET','/repos/'+repo+'/actions/workflows/deploy.yml/runs?branch=main&status=success&per_page=1')).workflow_runs;
 const previous=runs.sort((a,b)=>b.id-a.id)[0]?.head_sha;
 let backend=true;
 if(previous && /^[a-f0-9]{40}$/.test(previous)) {
  const files=execFileSync('git',['diff','--name-only',previous,sha],{encoding:'utf8'}).split('\n');
  backend=files.some(file=>file.startsWith('supabase/migrations/')||file.startsWith('supabase/functions/agent-gateway/')||file.startsWith('supabase/functions/agent-mcp/'));
 }
 await appendFile(process.env.GITHUB_OUTPUT,`deploy=true\nbackend=${backend}\n`);
 console.log(backend?'Backend changes require Supabase deployment before Pages.':'No backend changes; deploying the frontend.');
}
