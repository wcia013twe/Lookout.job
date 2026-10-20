"use client";
import {useWorkspace} from './workspace';
import {companyKey,decodeCompany,encodeCompany,isCompanyRecord,validateCompany} from '../../lib/network-model.mjs';
// Presentation adapter over the established private outreach service. No new RPC.
export function useNetworkCompanies(outreach){
 const w=useWorkspace(),owner=w.demo?'demo':w.user?.id||'guest';
 const records=outreach.records||[],rows=records.filter(isCompanyRecord).map(decodeCompany);
 async function save(row){
  validateCompany(row.record);
  if(!w.demo&&w.user&&window.JB?.auth?.userId!==w.user.id)throw Error('Account changed. Reopen the company.');
  const current=rows.find(r=>r.id===row.id);
  if((current?.revision||0)!==row.revision)throw Error('Company changed. Reopen its saved record before retrying.');
  if(rows.some(r=>r.id!==row.id&&companyKey(r.record.name)===companyKey(row.record.name)))throw Error('This company already exists. Open its current record.');
  const value={...records.find(r=>r.id===row.id),...encodeCompany(row),...(!w.user||w.demo?{_revision:row.revision+1}:{})};
  outreach.setRecords([...records.filter(r=>r.id!==row.id),value]);
  await outreach.flush();
  return {id:row.id,record:row.record,revision:row.revision+1};
 }
 const ready=w.demo||!w.user||outreach.ready;
 return {rows,save,refresh:outreach.refresh,error:!ready&&outreach.status.startsWith('Your outreach edits')?outreach.status:'',loading:!ready,ready,owner};
}
