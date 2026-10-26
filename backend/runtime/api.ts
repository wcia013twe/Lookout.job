import {createServer, type IncomingMessage} from 'node:http';
import {createHandler} from '../../supabase/functions/agent-mcp/protocol.mjs';
import type {Reply} from './service.ts';
import {RESUME_PARSE_TOOL,validateResumeParse} from '../../lib/resume-import.mjs';
import {ResumeParseError} from './resume-parser.ts';
import type {Payload} from './types.ts';

type Dispatch = (token: string, operation: string, payload: Payload) => Promise<Reply>;
export function createApi({dispatch,allowedHosts=['localhost','127.0.0.1','[::1]'],allowedOrigins=['http://localhost:3000','http://127.0.0.1:3000'],parseHuman}: {dispatch: Dispatch; allowedHosts?: string[]; allowedOrigins?: string[]; parseHuman?: (token:string,payload:Payload)=>Promise<any>}) {
  const mcp=createHandler(dispatch,allowedOrigins,[RESUME_PARSE_TOOL]);
  const server=createServer(async (req,res)=>{
    const json=(status:number,data: unknown)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(data));};
    let url:URL;
    try{url=new URL(req.url||'/', 'http://'+req.headers.host);}catch{return json(400,{error:'Invalid request URL'});}
    if(!allowedHosts.includes(url.hostname))return json(403,{error:'Host forbidden'});
    if(url.pathname==='/healthz' && req.method==='GET')return json(200,{status:'ok',service:'lookout-api'});
    if(!['/mcp','/v1/operations','/v1/resume-import'].includes(url.pathname))return json(404,{error:'Not found'});
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
      if(url.pathname==='/v1/resume-import'){
        const token=req.headers.authorization?.match(/^Bearer ([^\s]+)$/)?.[1];
        if(!token)return json(401,{error:'Sign in required'});
        let payload;try{payload=JSON.parse(bytes.toString('utf8'));validateResumeParse(payload);}catch{return json(400,{error:'One uploaded resume ID is required.'});}
        if(!parseHuman)return json(503,{error:'Resume autofill is not configured yet.'});
        try{return json(200,{data:await parseHuman(token,payload)});}catch(e){return json(e instanceof ResumeParseError?e.status:503,{error:e instanceof ResumeParseError?e.message:'Resume parsing is unavailable. Your uploaded file is saved.'});}
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
