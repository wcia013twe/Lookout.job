import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';

// Public distribution assets only; never resolve a request path against disk.
export async function agentPackageResponse(request:Request,directory=fileURLToPath(new URL('../../public/agent-package/',import.meta.url))){
 const url=new URL(request.url);
 const headers={'Cache-Control':'no-store','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff'};
 const error=(status:number,message:string)=>new Response(JSON.stringify({error:message}),{status,headers:{...headers,'Content-Type':'application/json'}});
 if(request.method!=='GET')return error(405,'Use GET');
 if(url.search)return error(400,'No package parameters accepted');
 try{
  const manifestBytes=await readFile(join(directory,'manifest.json'));
  const manifest=JSON.parse(manifestBytes.toString('utf8'));
  if(!/^[0-9]+\.[0-9]+\.[0-9]+$/.test(manifest.version)||manifest.archive!==`lookout-agent-${manifest.version}.tgz`)return error(503,'Package unavailable');
  if(url.pathname==='/agent-package/manifest.json')return new Response(new Uint8Array(manifestBytes),{headers:{...headers,'Content-Type':'application/json'}});
  if(url.pathname!==`/agent-package/${manifest.archive}`)return error(404,'Not found');
  const archive=await readFile(join(directory,manifest.archive));
  return new Response(new Uint8Array(archive),{headers:{...headers,'Content-Type':'application/gzip','Content-Length':String(archive.length)}});
 }catch{return error(503,'Package unavailable');}
}
