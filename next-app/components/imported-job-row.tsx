import type {Application} from './workflow-types';
import {ApplicationIdentity} from './tracker-progress';
export default function ImportedJobRow({application:a}:{application:Application}){
 const imported=a.imported!,r=imported.record,sources=imported.source_rows||[];
 return <li className="glass-inset rounded-2xl border border-board-line p-4"><details>
  <summary className="min-h-11 cursor-pointer rounded-lg focus-visible:outline-2 focus-visible:outline-board-accent"><span className="inline-grid w-[calc(100%-1.5rem)] grid-cols-2 gap-x-4 gap-y-2 align-middle sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center"><span className="tracker-role col-span-2 min-w-0 sm:col-span-1"><ApplicationIdentity company={a.company} title={a.title} location={a.location||'Location not recorded'}/></span><span className="text-sm">{r.status==='APPLIED'?'Applied':'Saved'} · {r.employmentType==='FT'?'Full-time':'Internship'}{r.archived?' · Archived':''}</span><span className="text-sm text-board-muted">Simplify import{r.appliedDate&&<span className="block">Applied {r.appliedDate}</span>}</span></span></summary>
  <div className="mt-4 space-y-3 pl-3 text-sm">
   <p>{r.status==='APPLIED'?`Applied date: ${r.appliedDate||'Not recorded'}. User-reported from Simplify.`:'Saved in Simplify. No application reported.'}</p>
   {r.statusDate&&<p>Status date: {r.statusDate}</p>}{r.archivedDate&&<p>Archived date: {r.archivedDate}</p>}
   {r.notes&&<p className="max-w-prose whitespace-pre-wrap break-words">{r.notes}</p>}
   {r.url?<a className="inline-flex min-h-11 items-center underline underline-offset-4" href={r.url} target="_blank" rel="noopener noreferrer">Open original job link</a>:<p>No job link was included in this export.</p>}
   {(imported.source_rows?.length||0)>1&&<details><summary className="min-h-11 cursor-pointer">Original reports ({sources.length})</summary><ul>{sources.map((source:any,i:number)=><li className="border-t border-board-line py-2" key={i}>{source.status} · {source.appliedDate||source.statusDate||'Date not recorded'}{source.notes&&<p className="whitespace-pre-wrap break-words">{source.notes}</p>}</li>)}</ul></details>}
  </div>
 </details></li>;
}
