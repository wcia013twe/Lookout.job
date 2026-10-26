import {createInterface} from 'node:readline';
import {pathToFileURL} from 'node:url';
const tools=[{name:'ingest_demo_intelligence',description:'Clean and embed the two fictional source datasets into the local demo store. Counts describe actual saves, not approvals.',inputSchema:{type:'object',properties:{},additionalProperties:false}},
 {name:'list_demo_intelligence_reports',description:'Inspect cleaned local fictional reports and vector dimensions; never returns raw source text or embedding values.',inputSchema:{type:'object',properties:{limit:{type:'integer',minimum:1,maximum:50}},additionalProperties:false}}];
export function backendClient(url='http://127.0.0.1:8091',request:typeof fetch=fetch){
 const u=new URL(url);if(u.protocol!=='http:'||!['127.0.0.1','localhost'].includes(u.hostname)||u.username||u.password||u.pathname!=='/'||u.search||u.hash)throw Error('LOCAL_DEMO_BACKEND_REQUIRED');
 return async(operation:string,args:any)=>{const r=await request(new URL('/demo/intelligence',u),{method:'POST',redirect:'error',signal:AbortSignal.timeout(120000),headers:{'Content-Type':'application/json'},body:JSON.stringify({operation,arguments:args})});if(!r.ok)throw Error('DEMO_BACKEND_FAILED');return r.json();};
}
export function mcpHandler(call:(op:string,args:any)=>Promise<any>){return async(p:any)=>{
 if(!p||p.jsonrpc!=='2.0')return {jsonrpc:'2.0',id:p?.id??null,error:{code:-32600,message:'Invalid request'}};
 if(p.id===undefined)return null;
 const reply=(result:any)=>({jsonrpc:'2.0',id:p.id,result});
 if(p.method==='initialize')return reply({protocolVersion:'2025-11-25',capabilities:{tools:{}},serverInfo:{name:'lookout-intelligence-demo',version:'0.1.0'}});
 if(p.method==='ping')return reply({});
 if(p.method==='tools/list')return reply({tools});
 if(p.method!=='tools/call')return {jsonrpc:'2.0',id:p.id,error:{code:-32601,message:'Method not found'}};
 try{const name=p.params?.name,args=p.params?.arguments??{};
  if(!tools.some(t=>t.name===name)||!args||typeof args!=='object'||Array.isArray(args))throw Error('INVALID_TOOL');
  if(Object.keys(args).some(k=>name==='list_demo_intelligence_reports'?k!=='limit':true)||('limit' in args&&(!Number.isInteger(args.limit)||args.limit<1||args.limit>50)))throw Error('INVALID_ARGUMENT');
  return reply({content:[{type:'text',text:JSON.stringify(await call(name,args))}]});
 }catch{return reply({isError:true,content:[{type:'text',text:'Demo intelligence call failed; inspect backend configuration and retry safely.'}]});}
};}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const handle=mcpHandler(backendClient(process.env.INTELLIGENCE_BACKEND_URL));
 for await(const line of createInterface({input:process.stdin})){try{if(line.length>16384)throw Error();const response=await handle(JSON.parse(line));if(response)process.stdout.write(JSON.stringify(response)+'\n');}catch{process.stdout.write(JSON.stringify({jsonrpc:'2.0',id:null,error:{code:-32700,message:'Invalid JSON request'}})+'\n');}}
}
