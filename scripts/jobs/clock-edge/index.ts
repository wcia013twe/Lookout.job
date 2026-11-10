// Harness-only entry point: clock dependency and response-only clock telemetry.
import '../virtual_clock.mjs';
const nativeServe=Deno.serve;
Deno.serve=(handler:any)=>nativeServe(async(request:Request)=>{
 const response=await handler(request);
 const headers=new Headers(response.headers);headers.set('x-job-fixture-now',new Date().toISOString());
 return new Response(response.body,{status:response.status,statusText:response.statusText,headers});
});
await import('../../../supabase/functions/agent-gateway/index.ts');
