import {mkdir,readFile,writeFile,rename,rm,readdir,stat} from 'node:fs/promises';
import path from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import type {Payload} from './types.ts';
const safe=(value:string)=>createHash('sha256').update(value).digest('hex');
// Immutable snapshots are referenced only by a successfully fenced SQL
// checkpoint. An old attempt can write an orphan, but cannot change a newer
// attempt's checkpoint or overwrite a snapshot another attempt reads.
export class SearchStaging {
 readonly directory:string;
 constructor(root:string,jobId:string,runId:string){this.directory=path.join(root,safe(jobId+':'+runId));}
 async read(key:unknown):Promise<Payload|null>{
  if(typeof key!=='string'||!/^\d+-[a-f0-9]{64}-[a-f0-9-]{36}\.json$/.test(key))return null;
  try{return JSON.parse(await readFile(path.join(this.directory,key),'utf8'));}catch(error){if((error as NodeJS.ErrnoException).code==='ENOENT')return null;throw error;}
 }
 async write(attempt:number,sourceId:string,data:Payload){
  await mkdir(this.directory,{recursive:true,mode:0o700});
  const key=`${attempt}-${safe(sourceId)}-${randomUUID()}.json`,temporary=path.join(this.directory,key+'.tmp');
  await writeFile(temporary,JSON.stringify(data),{mode:0o600,flag:'wx'});await rename(temporary,path.join(this.directory,key));return key;
 }
 async clear(){await rm(this.directory,{recursive:true,force:true});}
}
export async function pruneSearchStaging(root:string,maxAgeMs=7*24*60*60*1000){
 await mkdir(root,{recursive:true,mode:0o700});
 for(const entry of await readdir(root,{withFileTypes:true}))if(entry.isDirectory()&&/^[a-f0-9]{64}$/.test(entry.name)){
  const directory=path.join(root,entry.name);try{if(Date.now()-(await stat(directory)).mtimeMs>maxAgeMs)await rm(directory,{recursive:true,force:true});}catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;}
 }
}
export const observationHash=(row:Payload)=>createHash('md5').update(row.description||'').digest('hex');
