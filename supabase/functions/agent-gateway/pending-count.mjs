// No credential, identity, event pointer, or write capability crosses this route.
export async function pendingCountResponse(request,readCount){
 const url=new URL(request.url);
 if(!url.pathname.endsWith('/agent-gateway/pending-count'))return null;
 const headers={'Content-Type':'application/json','Cache-Control':'no-store','Referrer-Policy':'no-referrer'};
 const reply=(value,status=200)=>new Response(JSON.stringify(value),{status,headers});
 if(request.method!=='GET')return reply({error:'Use GET'},405);
 const id=url.searchParams.get('watchId');
 if([...url.searchParams.keys()].some(k=>k!=='watchId')||url.searchParams.getAll('watchId').length!==1||! /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(id||''))return reply({error:'Watch ID required'},400);
 try{
  const {data,error}=await readCount(id);
  if(error||!Number.isSafeInteger(data)||data<0)return reply({error:'Count unavailable'},503);
  return reply(data);
 }catch{return reply({error:'Count unavailable'},503);}
}
