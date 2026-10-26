import {createServer, type IncomingMessage} from 'node:http';
import {createHandler} from '../../supabase/functions/agent-mcp/protocol.mjs';
import type {Reply} from './service.ts';
import type {Payload} from './types.ts';

type Dispatch = (token: string, operation: string, payload: Payload) => Promise<Reply>;
export function createApi({dispatch,allowedHosts=['localhost','127.0.0.1','[::1]'],allowedOrigins=['http://localhost:3000','http://127.0.0.1:3000']}: {dispatch: Dispatch; allowedHosts?: string[]; allowedOrigins?: string[]}) {
  const mcp=createHandler(dispatch,allowedOrigins);
  const server=createServer(async (req,res)=>{
    const json=(status:number,data: unknown)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(data));};
    let url:URL;
    try{url=new URL(req.url||'/', 'http://'+req.headers.host);}catch{return json(400,{error:'Invalid request URL'});}
    if(!allowedHosts.includes(url.hostname))return json(403,{error:'Host forbidden'});
    if(url.pathname==='/healthz' && req.method==='GET')return json(200,{status:'ok',service:'lookout-api'});
    if(!['/mcp','/v1/operations'].includes(url.pathname))return json(404,{error:'Not found'});
    const origin=req.headers.origin;
    if(origin && !allowedOrigins.includes(origin))return json(403,{error:'Origin forbidden'});
    if(origin){res.setHeader('Access-Control-Allow-Origin',origin);res.setHeader('Vary','Origin');}
    if(req.method==='OPTIONS'){
      res.writeHead(204,{'Access-Control-Allow-Methods':'POST, OPTIONS','Access-Control-Allow-Headers':'Authorization, Content-Type, Accept, MCP-Protocol-Version'});return res.end();
    }
    if(req.method!=='POST')return json(405,{error:'Use POST'});
    if(!req.headers['content-type']?.includes('application/json'))return json(415,{error:'Use application/json'});
    try {
      const bytes=await readBody(req);
      if(url.pathname==='/mcp'){
        const headers=new Headers();
        for(const [name,value] of Object.entries(req.headers))if(value!==undefined)headers.set(name,Array.isArray(value)?value.join(','):value);
        const response=await mcp(new Request(url,{method:'POST',headers,body:new Uint8Array(bytes)}));
        response.headers.forEach((value:string,name:string)=>res.setHeader(name,value));res.statusCode=response.status;return res.end(Buffer.from(await response.arrayBuffer()));
      }
      const token=req.headers.authorization?.match(/^Bearer (jb_agent_[a-f0-9]{64})$/)?.[1];
      if(!token)return json(401,{error:'Agent credential required'});
      let body;try{body=JSON.parse(bytes.toString('utf8'));}catch{return json(400,{error:'Invalid JSON'});}
      if(!body || Array.isArray(body) || typeof body!=='object' || Object.keys(body).some(k=>!['operation','payload'].includes(k)) || typeof body.operation!=='string')return json(400,{error:'Operation and payload required'});
      const result=await dispatch(token,body.operation,body.payload??{});
      return json(result.status,result.status===200?{data:result.data}:{error:result.error});
    }catch(error){return json(error instanceof BodyLimit?413:503,{error:error instanceof BodyLimit?'Request too large':'Request unavailable; read current state before retrying'});}
  });
  server.requestTimeout=30000;server.headersTimeout=10000;server.keepAliveTimeout=5000;
  return server;
}
class BodyLimit extends Error {}
async function readBody(req:IncomingMessage){
  const chunks:Buffer[]=[];let length=0;
  for await(const chunk of req){length+=chunk.length;if(length>262144)throw new BodyLimit();chunks.push(Buffer.from(chunk));}
  return Buffer.concat(chunks);
}
