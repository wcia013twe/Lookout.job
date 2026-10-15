'use client';

import {type FormEvent} from 'react';
import {Field,control,primary,secondary} from '../../../components/ui';
import {types} from '../_lib/types';

type Props={filters:Record<string,string>;busy:boolean;search:(filters:Record<string,string>)=>void};
export default function CircleSearch({filters,busy,search}:Props){
 function submit(event:FormEvent<HTMLFormElement>){event.preventDefault();const form=new FormData(event.currentTarget);search(Object.fromEntries([...form.entries()].filter(([,value])=>String(value).trim()).map(([key,value])=>[key,String(value).trim()])));}
 return <form key={JSON.stringify(filters)} aria-label="Search Circle knowledge" onSubmit={submit} className="mb-7 space-y-3">
  <div className="flex flex-wrap items-end gap-3"><div className="min-w-0 flex-1"><Field label="Search this Circle"><input className={control} name="query" defaultValue={filters.query} placeholder="Interview tips, resources, opportunities…"/></Field></div><button className={primary} disabled={busy}>Search</button>{Object.keys(filters).some(key=>key!=='sort')&&<button type="button" className={secondary} disabled={busy} onClick={()=>search({sort:'newest'})}>Clear</button>}</div>
  <details><summary className="min-h-11 py-2 text-xs text-board-muted">Filters</summary><div className="grid gap-3 pb-4 sm:grid-cols-3">
   <Field label="Sort"><select name="sort" className={control} defaultValue={filters.sort||'newest'}><option value="newest">Newest</option><option value="relevance">Relevance</option></select></Field>
   {['company','role','stage'].map(name=><Field key={name} label={name[0].toUpperCase()+name.slice(1)}><input className={control} name={name} defaultValue={filters[name]}/></Field>)}
   <Field label="Type"><select name="type" className={control} defaultValue={filters.type||''}><option value="">All types</option>{Object.entries(types).filter(([key])=>key!=='reply').map(([key,label])=><option value={key} key={key}>{label}</option>)}</select></Field>
   <Field label="From"><input type="date" name="since" className={control} defaultValue={filters.since}/></Field><Field label="Through"><input type="date" name="until" className={control} defaultValue={filters.until}/></Field>
  </div></details>
 </form>;
}
