// Human-only boundary. Owner identity comes only from verified Supabase Auth.
// Storage failure leaves a pending reset and all records available for retry.
export function createResetHandler(admin) {
 const response=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
 return async request=>{
  if(request.method!=='POST')return response({error:'Use POST'},405);
  const token=request.headers.get('Authorization')?.match(/^Bearer (.+)$/)?.[1];
  if(!token||token.startsWith('jb_agent_'))return response({error:'Human sign-in required'},401);
  try {
   const {data:{user},error}=await admin.auth.getUser(token);
   if(error||!user||user.is_anonymous)return response({error:'Sign in required'},401);
   // Bound streaming bodies as well as Content-Length.
   const reader=request.body?.getReader();if(!reader)return response({error:'JSON body required'},400);
   let text='',bytes=0;const decoder=new TextDecoder();
   while(true){const {value,done}=await reader.read();if(done)break;bytes+=value.length;if(bytes>4096){await reader.cancel();return response({error:'Request too large'},413);}text+=decoder.decode(value,{stream:true});}
   text+=decoder.decode();let body;try{body=JSON.parse(text);}catch{return response({error:'Invalid JSON'},400);}
   if(!body||Array.isArray(body)||!['preview','reset'].includes(body.action)||Object.keys(body).some(k=>!['action','resetId','confirmation','expectedPersonalVersion'].includes(k)))return response({error:'Invalid reset request'},400);
   if(body.action==='preview'&&Object.keys(body).length!==1)return response({error:'Preview accepts no arguments'},400);
   if(body.action==='reset'&&(!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(body.resetId||'')||body.confirmation!=='RESET MY WORKSPACE'||!Number.isSafeInteger(body.expectedPersonalVersion)||body.expectedPersonalVersion<1))return response({error:'Current preview and exact confirmation required'},400);
   const rpc=async(operation,payload={})=>{
    const {data,error}=await admin.rpc('workspace_reset_service',{owner_id:user.id,operation,payload});
    if(error)throw Object.assign(Error('Reset rejected'),{code:error.code});return data;
   };
   if(body.action==='preview')return response({data:await rpc('preview')});
   let data=await rpc('begin',{resetId:body.resetId,confirmation:body.confirmation,expectedPersonalVersion:body.expectedPersonalVersion});
   if(data.state==='completed')return response({data}); // replay cannot erase new work
   const files=data.files;
   if(!Array.isArray(files)||files.some(f=>f.bucket!=='resumes'||!f.name.startsWith(user.id+'/')))throw Error('Invalid owned files');
   for(let offset=0;offset<files.length;offset+=100){
    const {error}=await admin.storage.from('resumes').remove(files.slice(offset,offset+100).map(f=>f.name));
    if(error)return response({error:'Private file deletion failed. Reset is incomplete; retry the same reset.',resetId:body.resetId,state:'pending'},503);
   }
   data=await rpc('finish',{resetId:body.resetId});
   return response({data});
  } catch(error) {
   return response({error:error.code==='40001'?'Workspace changed. Preview again or resume the pending reset.':'Reset could not finish. Preview its state before retrying.'},error.code==='40001'?409:503);
  }
 };
}
