import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {stampRuntimeBundle,VERSION_PATH,readCommittedSource} from './runtime-version.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
const git=(...args)=>execFileSync('git',args,{cwd:root,encoding:'utf8'}).trim();
const project='osyrlausutnqzlegxmnd';
if(process.env.GITHUB_REF!=='refs/heads/main')throw Error('Production deployment requires the main-branch GitHub workflow.');
if(git('status','--porcelain'))throw Error('Deploy only a clean, committed checkout.');
const sourceCommit=git('rev-parse','HEAD');
if(process.env.GITHUB_SHA!==sourceCommit)throw Error('Workflow source commit mismatch.');
const names=git('ls-files','lib','supabase/functions').split('\n').filter(Boolean);
const files=names.map(name=>({name,content:readFileSync(new URL('../'+name,import.meta.url),'utf8')}));
const stamped=stampRuntimeBundle({files,sourceCommit,readSource:(sha,name)=>readCommittedSource(sha,name,root)});
const version=stamped.find(file=>file.name===VERSION_PATH);
writeFileSync(new URL('../'+VERSION_PATH,import.meta.url),version.content);
const cli=fileURLToPath(new URL('../node_modules/.bin/supabase',import.meta.url));
const run=args=>execFileSync(cli,args,{cwd:root,stdio:'inherit'});
console.log(`Deploying reviewed source ${sourceCommit} to ${project}`);
try {
 run(['link','--project-ref',project]);
 run(['db','push','--dry-run']);
 run(['db','push','--yes']);
 for(const name of ['agent-gateway','agent-mcp','workspace-reset'])run(['functions','deploy',name,'--project-ref',project,'--use-api']);
} finally {
 writeFileSync(new URL('../'+VERSION_PATH,import.meta.url),execFileSync('git',['show',`HEAD:${VERSION_PATH}`],{cwd:root,encoding:'utf8'}));
}
