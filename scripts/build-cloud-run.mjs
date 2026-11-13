import {spawnSync} from 'node:child_process';
import {mkdtempSync,writeFileSync,readFileSync,rmSync,openSync,closeSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';

const root=fileURLToPath(new URL('../',import.meta.url));
const sources=['.dockerignore','package.json','package-lock.json','backend/runtime','agent-package','scripts/build-agent-package.mjs','supabase/functions','lib','runner'];
function run(command,args,options={}){
 const result=spawnSync(command,args,{cwd:root,encoding:'utf8',...options});
 if(result.error)throw result.error;
 if(result.status!==0)throw Error(`${command} failed (${result.status})`);
 return result.stdout?.trim();
}
export function buildCloudRun(repository){
 if(!/^([a-z0-9-]+)-docker\.pkg\.dev\/[a-z0-9-]+\/[a-z0-9-]+\/[a-z0-9-]+$/.test(repository||''))throw Error('Supply an existing Artifact Registry image repository, without a tag.');
 if(run('git',['branch','--show-current'])!=='main'||run('git',['status','--porcelain']))throw Error('Build only committed, clean, landed local main.');
 const revision=run('git',['rev-parse','HEAD']);
 const directory=mkdtempSync(join(tmpdir(),'lookout-cloud-run-'));
 try{
  const archive=join(directory,'source.tar'),metadata=join(directory,'image.json'),descriptor=openSync(archive,'w',0o600);
  try{run('git',['archive','--format=tar',revision,...sources],{stdio:['ignore',descriptor,'inherit']});}finally{closeSync(descriptor);}
  run('tar',['-xf',archive,'-C',directory]);
  writeFileSync(join(directory,'supabase/functions/agent-gateway/runtime-version.json'),JSON.stringify({sourceCommit:revision})+'\n');
  run('docker',['buildx','build','--platform','linux/amd64','--push','--tag',repository+':'+revision,'--label','org.opencontainers.image.revision='+revision,'--metadata-file',metadata,'--file',join(directory,'backend/runtime/Dockerfile'),directory],{stdio:'inherit'});
  const digest=JSON.parse(readFileSync(metadata,'utf8'))['containerimage.digest'];
  if(!/^sha256:[a-f0-9]{64}$/.test(digest||''))throw Error('Build did not return an immutable image digest.');
  const image=repository+'@'+digest;console.log(image);return image;
 }finally{rmSync(directory,{recursive:true,force:true});}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 try{buildCloudRun(process.argv[2]);}catch(error){console.error(error.message);process.exitCode=1;}
}
