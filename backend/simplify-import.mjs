// Shared authenticated browser boundary. The database owns validation and versions.
export function createSimplifyImporter(client,expectedUserId){
 return async(action,payload={})=>{
  if(!client||!expectedUserId)throw Error('Sign in to import your Simplify history.');
  const {data:{user},error}=await client.auth.getUser();
  if(error||user?.id!==expectedUserId)throw Error('Account changed. Choose your CSV again.');
  const response=await client.rpc('simplify_import',{action,payload});
  if(response.error)throw Error(response.error.code==='40001'?'Your tracker changed. Preview the CSV again.':response.error.code==='PGRST202'?'CSV import needs the latest Lookout backend release.':'Import could not be completed. Try again or preview the file again.');
  const after=await client.auth.getUser();
  if(after.error||after.data.user?.id!==expectedUserId)throw Error('Account changed. Choose your CSV again.');
  if(!response.data||typeof response.data.version!=='number'||(action==='list'?!Array.isArray(response.data.records):!Array.isArray(response.data.decisions)))throw Error('Import returned an incomplete response. Try again.');
  return response.data;
 };
}
