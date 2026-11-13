import {googleAccessToken} from './google-cloud.ts';
import type {Payload} from './types.ts';

export class CloudStaging {
 readonly bucket:string;
 readonly prefix:string;
 readonly request:typeof fetch;
 readonly accessToken:()=>Promise<string>;
 constructor(bucket:string,prefix:string,{request=fetch,accessToken=()=>googleAccessToken(request)}:{request?:typeof fetch;accessToken?:()=>Promise<string>}={}){
  if(!/^[a-z0-9][a-z0-9._-]{1,220}[a-z0-9]$/.test(bucket))throw Error('Invalid staging bucket');
  this.bucket=bucket;this.prefix=prefix+'/';this.request=request;this.accessToken=accessToken;
 }
 async call(url:string,init:RequestInit={}){
  return this.request(url,{...init,headers:{...init.headers,Authorization:`Bearer ${await this.accessToken()}`},signal:AbortSignal.timeout(20000),redirect:'error'});
 }
 address(key:string){return `https://storage.googleapis.com/storage/v1/b/${encodeURIComponent(this.bucket)}/o/${encodeURIComponent(this.prefix+key)}`;}
 async read(key:string):Promise<Payload|null>{
  const response=await this.call(this.address(key)+'?alt=media');
  if(response.status===404)return null;
  if(!response.ok)throw Error('Shared staging read unavailable');
  return response.json();
 }
 async write(key:string,data:Payload){
  const url=`https://storage.googleapis.com/upload/storage/v1/b/${encodeURIComponent(this.bucket)}/o?uploadType=media&ifGenerationMatch=0&name=${encodeURIComponent(this.prefix+key)}`;
  const response=await this.call(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});
  if(!response.ok)throw Error('Immutable staging write unavailable');
  await response.body?.cancel();
 }
 async clear(){
  let pageToken:string|undefined;
  do{
   const url=new URL(`https://storage.googleapis.com/storage/v1/b/${encodeURIComponent(this.bucket)}/o`);
   url.searchParams.set('prefix',this.prefix);url.searchParams.set('fields','items(name,generation),nextPageToken');
   if(pageToken)url.searchParams.set('pageToken',pageToken);
   const response=await this.call(url.href);if(!response.ok)throw Error('Shared staging list unavailable');
   const page=await response.json();
   for(const item of page.items||[]){
    if(typeof item.name!=='string'||!item.name.startsWith(this.prefix)||!/^\d+$/.test(item.generation))throw Error('Invalid staging object');
    const removed=await this.call(this.address(item.name.slice(this.prefix.length))+'?ifGenerationMatch='+item.generation,{method:'DELETE'});
    if(!removed.ok&&removed.status!==404&&removed.status!==412)throw Error('Shared staging cleanup unavailable');
    await removed.body?.cancel();
   }
   pageToken=page.nextPageToken;
  }while(pageToken);
 }
}
