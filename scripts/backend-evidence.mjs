import {createHash} from 'node:crypto';
import {posix} from 'node:path';
import {execFileSync} from 'node:child_process';
import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
const hash=(algo,bytes)=>createHash(algo).update(bytes).digest('hex');
export const sourceHashes=content=>{const bytes=Buffer.from(content);return {sha256:hash('sha256',bytes),gitBlobSha:hash('sha1',Buffer.concat([Buffer.from(`blob ${bytes.length}\0`),bytes]))};};
// Relative static imports must all exist in the observed bundle. No guessed files.
export function checkBundle(files,name){
 const map=new Map(files.map(f=>[f.name,f.content]));
 if(map.size!==files.length)throw Error('Duplicate bundle files');
 for(const path of [`supabase/functions/${name}/index.ts`,`supabase/functions/${name}/deno.json`])if(!map.has(path))throw Error('Missing entrypoint/config');
 for(const [path,content]of map){
  if(!/\.(?:mjs|ts|js)$/.test(path))continue;
  for(const m of content.matchAll(/\b(?:import|export)\s+(?:[^;'"\n]*?\s+from\s*)?['"]([^'"]+)['"]/g)){
   if(m[1].startsWith('.')){const target=posix.normalize(posix.join(posix.dirname(path),m[1]));if(!map.has(target))throw Error(`Missing relative dependency: ${target}`);}
  }
 }
}
export function makeEvidence({sourceCommit,observedAt,readbacks,readSource,operator}){
 if(!/^[a-f0-9]{40}$/.test(sourceCommit))throw Error('Exact source commit required');
 return {schemaVersion:1,status:'verified',provenance:'operator-attested-supabase-source-readback',verification:'point-in-time',operator,
  projectId:'umhqfqzpwmszhcknwtrs',sourceCommit,observedAt,functions:readbacks.map(f=>{
   if(f.status!=='ACTIVE'||f.verify_jwt!==false)throw Error('Unexpected deployed state/auth');
   checkBundle(f.files,f.name);
   return {name:f.name,id:f.id,version:f.version,status:f.status,verifyJwt:f.verify_jwt,files:f.files.map(file=>{
    if(readSource(sourceCommit,file.name)!==file.content)throw Error(`Production source mismatch: ${file.name}`);
    return {path:file.name,...sourceHashes(file.content)};
   }).sort((a,b)=>a.path.localeCompare(b.path))};
  })};
}
export function checkEvidenceSources(record,readSource){
 if(!/^[a-f0-9]{40}$/.test(record.sourceCommit??''))throw Error('Invalid source commit');
 for(const f of record.functions??[]){
  const files=f.files.map(file=>{
   if(!/^(?:supabase\/functions\/(?:agent-gateway|agent-mcp)\/[\w./-]+|lib\/search-profile\.mjs)$/.test(file.path)||file.path.includes('..'))throw Error('Invalid source path');
   const content=readSource(record.sourceCommit,file.path),hashes=sourceHashes(content);
   if(hashes.sha256!==file.sha256||hashes.gitBlobSha!==file.gitBlobSha)throw Error(`Evidence hash mismatch: ${file.path}`);
   return {name:file.path,content};
  });checkBundle(files,f.name);
 }
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const path='backend/releases/current.json';
 const text=await readFile(path,'utf8').catch(e=>{if(e.code==='ENOENT')return null;throw e;});
 if(text){
  const record=JSON.parse(text);
  if(!/^[a-f0-9]{40}$/.test(record.sourceCommit??''))throw Error('Invalid evidence source');
  try{execFileSync('git',['cat-file','-e',record.sourceCommit],{stdio:'ignore'});}
  catch{execFileSync('git',['fetch','--no-tags','origin',record.sourceCommit],{stdio:'inherit'});}
  checkEvidenceSources(record,(sha,path)=>execFileSync('git',['show',`${sha}:${path}`],{encoding:'utf8',maxBuffer:4000000}));
  console.log('Evidence hashes and relative dependency closure match the pinned source. Production observation remains operator-attested.');
 }else console.log('No backend evidence published; backend retry remains blocked.');
}
