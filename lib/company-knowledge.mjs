import {companyKey,resolveCompany} from './network-model.mjs';
export const companyContexts=content=>[content,...(content.contexts||[]).filter(c=>['application','referral'].includes(c.kind)),...(content.offers||[])];
export function matchesCompanyContext(content,filters,registry=[]){
 if(filters.companyId&&filters.company)throw Error('Choose companyId or company.');
 const id=filters.companyId||(filters.company?resolveCompany(registry,filters.company):null);
 return companyContexts(content).some(context=>(!id||resolveCompany(registry,context.company)===id)&&(!filters.company||id||companyKey(context.company)===companyKey(filters.company))&&['role','stage'].every(key=>!filters[key]||companyKey(context[key])===companyKey(filters[key])));
}
