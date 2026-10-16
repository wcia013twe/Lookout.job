const fields={application:['kind','label','company','role','jobId','jobUrl','stage'],referral:['kind','label','company','role','contact','url'],resource:['kind','label','url'],note:['kind','label','note']};
const privateLink=/storage\/v1\/object\/(sign|authenticated)\/|[?&](token|access_token|apikey|api_key|signature|x-amz-signature)=|mail\.google\.com\/|outlook\.office\.com\/mail\//i;
export function publicContextUrl(value){
 if(typeof value!=='string'||value.length>2000||privateLink.test(value))return undefined;
 try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password?u.href:undefined;}catch{return undefined;}
}
export function validateSharedContexts(contexts){
 if(!Array.isArray(contexts)||contexts.length>6)throw Error('Attach up to six context items.');
 for(const item of contexts){
  if(!item||typeof item!=='object'||Array.isArray(item)||!['application','referral','resource','note'].includes(item.kind)||typeof item.label!=='string'||!item.label.trim()||item.label.length>200)throw Error('Invalid shared context.');
  for(const [key,value] of Object.entries(item))if(!fields[item.kind].includes(key)||typeof value!=='string'||value.length>(['jobUrl','url'].includes(key)?2000:key==='note'?1000:200))throw Error('Context contains unsupported or private fields.');
  for(const key of ['jobUrl','url'])if(item[key]&&!publicContextUrl(item[key]))throw Error('Context links must be public HTTPS URLs.');
  if(privateLink.test(JSON.stringify(item)))throw Error('Private links cannot be attached.');
 }
 return contexts;
}
const text=(value,max=200)=>typeof value==='string'?value.trim().slice(0,max):'';
const compact=item=>Object.fromEntries(Object.entries(item).filter(([,value])=>value!==undefined&&value!==''));
export function applicationContext(application,stage){
 const company=text(application.company),role=text(application.title||application.role),jobUrl=publicContextUrl(application.applicationUrl||application.url||application.jobUrl);
 let jobId=text(application.employerJobId||application.jobId);
 if(!jobId&&jobUrl){const u=new URL(jobUrl);jobId=text(u.searchParams.get('gh_jid')||u.searchParams.get('job_id')||u.pathname.match(/(?:\/|-)(\d{5,})\/?$/)?.[1]);}
 return compact({kind:'application',label:text(`${company} · ${role}`),company,role,jobId,jobUrl,stage:text(stage||application.stage)});
}
export function referralContext(referral){
 const company=text(referral.company),contact=text(referral.contact||referral.name),role=text(referral.title||referral.role);
 return compact({kind:'referral',label:text(`${company} · ${contact||'Referral'}`),company,contact,role,url:publicContextUrl(referral.linkedin||referral.profileUrl)});
}

export function contextFromDrop({context,job,text}) {
 let item;
 if(context)item=JSON.parse(context);
 else if(job){
  const source=JSON.parse(job);item={kind:'application',label:textLabel(source.company||source.role||'Shared job')};
  for(const key of ['company','role','jobId','jobUrl','stage'])if(typeof source[key]==='string')item[key]=source[key];
 }else if(text?.trim()){
  const value=text.trim(),url=publicContextUrl(value);
  item=url?{kind:'resource',label:new URL(url).hostname,url}:{kind:'note',label:'Attached note',note:value.slice(0,1000)};
 }
 return item?validateSharedContexts([item])[0]:null;
}
const textLabel=value=>String(value).slice(0,200);
