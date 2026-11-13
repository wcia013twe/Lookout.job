import {createRemoteJWKSet,jwtVerify,type JWTVerifyGetKey} from 'jose';

export async function googleAccessToken(request:typeof fetch=fetch){
 const response=await request('http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token',{headers:{'Metadata-Flavor':'Google'},signal:AbortSignal.timeout(2000),redirect:'error'});
 if(!response.ok)throw Error('Google service identity unavailable');
 const body=await response.json();
 if(typeof body.access_token!=='string'||!body.access_token)throw Error('Google service identity unavailable');
 return body.access_token as string;
}

const googleKeys=createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'));
export function maintenanceAuthorization(audience:string,email:string,keys:JWTVerifyGetKey=googleKeys){
 if(!audience.startsWith('https://')||!email.endsWith('.gserviceaccount.com'))throw Error('Maintenance audience and Scheduler service account are required');
 return async(header:string|undefined)=>{
  const token=header?.match(/^Bearer ([^\s]+)$/)?.[1];if(!token)return false;
  try{
   const {payload}=await jwtVerify(token,keys,{issuer:['https://accounts.google.com','accounts.google.com'],audience,algorithms:['RS256'],requiredClaims:['exp','iat','sub','email','email_verified']});
   return payload.email===email&&payload.email_verified===true;
  }catch{return false;}
 };
}

export function cloudRunWakeup({project,region,job,request=fetch,accessToken=()=>googleAccessToken(request)}:{project:string;region:string;job:string;request?:typeof fetch;accessToken?:()=>Promise<string>}){
 if(![project,region,job].every(value=>/^[a-z][a-z0-9-]*$/.test(value)))throw Error('Invalid Cloud Run job address');
 const address=`https://run.googleapis.com/v2/projects/${project}/locations/${region}/jobs/${job}:run`;
 return async()=>{
  const token=await accessToken();
  const response=await request(address,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:'{}',signal:AbortSignal.timeout(5000),redirect:'error'});
  if(!response.ok)throw Error('Cloud Run wakeup unavailable');
  await response.body?.cancel();
 };
}
