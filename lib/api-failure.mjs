// Safe diagnostics shared by browser/domain adapters. Never render raw SQL, payloads or tokens.
const cleanCode=value=>typeof value==='string'&&/^[A-Z0-9_]{1,48}$/.test(value)?value:null;
export class ApiFailure extends Error {
 constructor(operation,error={},status) {
  const code=cleanCode(error?.code)||(error instanceof TypeError||/fetch|network|offline/i.test(error?.message||'')?'NETWORK_ERROR':'REQUEST_FAILED');
  const http=Number.isInteger(status)&&status>=0?status:Number.isInteger(error?.status)?error.status:null;
  let explanation='The server could not complete this request. Try again; if it persists, report the operation and code shown here.';
  if(['PGRST202','PGRST205','42P01','42883','42703'].includes(code))explanation='The required API is missing or out of date on the connected backend. The backend deployment or schema cache must be fixed; an empty account does not cause this error.';
  else if(code==='FEATURE_UNAVAILABLE')explanation='This feature is not enabled on the connected backend. It must be enabled before this page can load.';
  else if(code==='INVALID_RESPONSE')explanation='The API returned an invalid response. This is a service error, not an empty result.';
  else if(code==='40001')explanation='The saved record changed. Reload it and reconcile your edits before saving again.';
  else if(http===401||['28000','PGRST301','PGRST302','PGRST303'].includes(code))explanation='Your session is missing or expired. Sign in again, then retry.';
  else if(http===403||code==='42501')explanation='The server denied access. Check the signed-in account and its permissions; retrying unchanged will not grant access.';
  else if(http===404||code==='P0002')explanation='The requested record was not found or is no longer available to this account.';
  else if(http===429)explanation='The server is rate limiting requests. Wait before trying again.';
  else if(code==='NETWORK_ERROR'||http===0)explanation='The API could not be reached. Check your connection, then retry.';
  else if(code==='22023'||http===400)explanation='The API rejected this request. Review the entered values before retrying.';
  const name=typeof operation==='string'&&/^[a-zA-Z0-9_.:-]{1,120}$/.test(operation)?operation:'request';
  super(`${name} failed [${code}${http?`; HTTP ${http}`:''}]. ${explanation}`);
  this.name='ApiFailure';this.operation=name;this.code=code;this.status=http;
 }
}
export function apiFailure(operation,error,status){return error instanceof ApiFailure?error:new ApiFailure(operation,error,status);}
export const apiErrorText=(operation,error)=>apiFailure(operation,error).message;
export async function callApi(operation,request,validate=data=>data!==null&&data!==undefined) {
 try {
  const response=await request();
  if(response?.error)throw apiFailure(operation,response.error,response.status);
  if(!response||!validate(response.data))throw apiFailure(operation,{code:'INVALID_RESPONSE'},response?.status);
  return response.data;
 } catch(error){throw apiFailure(operation,error);}
}
