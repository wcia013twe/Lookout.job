import {realpathSync} from 'node:fs';
import {mkdir,readFile,writeFile,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
const root=fileURLToPath(new URL('../',import.meta.url));
export async function buildAgentPackage(destination){
 await mkdir(destination,{recursive:true});
 const meta=JSON.parse(await readFile(join(root,'agent-package/package.json'),'utf8'));
 const temp=await mkdtemp(join(tmpdir(),'lookout-agent-pack-'));
 try{
  // No lifecycle scripts, dependencies, registry access or credentials are needed.
  const output=execFileSync(process.platform==='win32'?'npm.cmd':'npm',['pack','--ignore-scripts','--offline','--json','--pack-destination',temp,'--cache',join(temp,'cache')],{cwd:join(root,'agent-package'),encoding:'utf8'});
  const [pack]=JSON.parse(output);
  const expected=['README.md','config.example.json','package.json','watch.mjs'];
  if(JSON.stringify(pack.files.map(file=>file.path).sort())!==JSON.stringify(expected))throw Error('Unexpected package files');
  const bytes=await readFile(join(temp,pack.filename));
  const sha256=createHash('sha256').update(bytes).digest('hex');
  await writeFile(join(destination,pack.filename),bytes);
  const manifest={name:meta.name,version:meta.version,node:meta.engines.node,archive:pack.filename,sha256,bytes:bytes.length,files:expected};
  await writeFile(join(destination,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
  return manifest;
 }finally{await rm(temp,{recursive:true,force:true});}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(realpathSync(process.argv[1])).href){
 if(!process.argv[2])throw Error('Destination directory required');
 console.log(JSON.stringify(await buildAgentPackage(resolve(process.argv[2]))));
}
