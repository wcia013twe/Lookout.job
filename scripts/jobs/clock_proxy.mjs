// Route-only isolated Supabase fixture ingress; no payload or authorization edits.
import {createServer} from 'node:http';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
export function createClockProxy({rest='http://rest:3000',edge='http://edge:9000'}={}){
return createServer(async(req,res)=>{
 try {
  const target=req.url.startsWith('/rest/v1/')?rest+req.url.slice('/rest/v1'.length):req.url.startsWith('/functions/v1/agent-gateway')?edge+req.url:null;
  if(!target){res.writeHead(404);res.end();return;}
  const chunks=[];let length=0;for await(const part of req){length+=part.length;if(length>262144){res.writeHead(413);res.end();return;}chunks.push(part);}
  const headers={...req.headers};delete headers.host;delete headers['content-length'];
  const reply=await fetch(target,{method:req.method,headers,body:['GET','HEAD'].includes(req.method)?undefined:Buffer.concat(chunks),redirect:'error',signal:AbortSignal.timeout(25000)});
  const responseHeaders=new Headers(reply.headers);for(const name of ['content-encoding','content-length','transfer-encoding','connection'])responseHeaders.delete(name);
  res.writeHead(reply.status,Object.fromEntries(responseHeaders));res.end(Buffer.from(await reply.arrayBuffer()));
 }catch{res.writeHead(503);res.end('Isolated fixture upstream unavailable');}
});
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))createClockProxy().listen(8000,'0.0.0.0');
