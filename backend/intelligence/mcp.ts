import {createInterface} from 'node:readline';
import {pathToFileURL} from 'node:url';
import {DEMO_TOOLS, type DemoCall} from './contract.ts';
export function backendClient(url='http://127.0.0.1:8091',request:typeof fetch=fetch){
 const u=new URL(url);if(u.protocol!=='http:'||!['127.0.0.1','localhost'].includes(u.hostname)||u.username||u.password||u.pathname!=='/'||u.search||u.hash)throw Error('LOCAL_DEMO_BACKEND_REQUIRED');
 return async(operation:unknown,args:unknown)=>{const r=await request(new URL('/demo/intelligence',u),{method:'POST',redirect:'error',signal:AbortSignal.timeout(120000),headers:{'Content-Type':'application/json'},body:JSON.stringify({operation,arguments:args})});if(!r.ok)throw Error('DEMO_BACKEND_FAILED');return r.json();};
}
export function mcpHandler(call:DemoCall){return async(p:any)=>{
 if(!p||p.jsonrpc!=='2.0')return {jsonrpc:'2.0',id:p?.id??null,error:{code:-32600,message:'Invalid request'}};
 if(p.id===undefined)return null;
 const reply=(result:any)=>({jsonrpc:'2.0',id:p.id,result});
 if(p.method==='initialize')return reply({protocolVersion:'2025-11-25',capabilities:{tools:{}},serverInfo:{name:'lookout-intelligence-demo',version:'0.1.0'}});
 if(p.method==='ping')return reply({});
 if(p.method==='tools/list')return reply({tools:DEMO_TOOLS});
 if(p.method!=='tools/call')return {jsonrpc:'2.0',id:p.id,error:{code:-32601,message:'Method not found'}};
 try{const name=p.params?.name,args=p.params?.arguments;
  return reply({content:[{type:'text',text:JSON.stringify(await call(name,args))}]});
 }catch{return reply({isError:true,content:[{type:'text',text:'Demo intelligence call failed; inspect backend configuration and retry safely.'}]});}
};}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const handle=mcpHandler(backendClient(process.env.INTELLIGENCE_BACKEND_URL));
 for await(const line of createInterface({input:process.stdin})){try{if(line.length>16384)throw Error();const response=await handle(JSON.parse(line));if(response)process.stdout.write(JSON.stringify(response)+'\n');}catch{process.stdout.write(JSON.stringify({jsonrpc:'2.0',id:null,error:{code:-32700,message:'Invalid JSON request'}})+'\n');}}
}
