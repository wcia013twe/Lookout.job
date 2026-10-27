// Browser access for the deployed UI and the documented local development URLs.
// Native MCP clients omit Origin; authentication remains the handler's job.
const origins=new Set(['https://wcia013twe.github.io','https://lookout-job-signal-board.tenderibex16.chatgpt.site','http://localhost:3000','http://127.0.0.1:3000']);
export function withGatewayCors(handle){
 return async request=>{
  const origin=request.headers.get('Origin');
  const headers=new Headers({
   'Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info',
   'Access-Control-Allow-Methods':'GET, POST, OPTIONS',
   'Cache-Control':'no-store',
   'Vary':'Origin',
  });
  if(origin&&!origins.has(origin))return new Response(JSON.stringify({error:'Origin not allowed'}),{status:403,headers:{...Object.fromEntries(headers),'Content-Type':'application/json'}});
  if(origin)headers.set('Access-Control-Allow-Origin',origin);
  if(request.method==='OPTIONS')return new Response(null,{status:204,headers});
  const response=await handle(request);
  const result=new Response(response.body,{status:response.status,statusText:response.statusText,headers:response.headers});
  for(const [key,value]of headers)result.headers.set(key,value);
  return result;
 };
}
