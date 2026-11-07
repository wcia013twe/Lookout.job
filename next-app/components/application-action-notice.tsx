"use client";
type NextAction={date:string;label:string};
export default function ApplicationActionNotice({title,company,action,next,onOpen}:{title:string;company:string;action?:{reason:string}|null;next?:NextAction|null;onOpen:()=>void}) {
 if(!action&&!next)return null;
 const date=next?new Date(next.date).toLocaleString(undefined,{month:'short',day:'numeric',year:'numeric',...(next.date.length===10?{timeZone:'UTC'}:{hour:'numeric',minute:'2-digit',timeZoneName:'short'})}):'';
 return <button className={`col-span-full flex min-h-11 flex-wrap items-center gap-x-3 gap-y-1 rounded-lg text-left text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 ${action?'text-board-warning':'text-board-muted'}`} onClick={onOpen} aria-label={`${action?`Needs action for ${title} at ${company}: ${action.reason}`:`Next action for ${title} at ${company}`}${next?`. ${next.label}: ${date}`:''}`}>
  {action&&<><span className="shrink-0 rounded-full border border-current px-2 py-0.5 text-xs font-semibold">Needs action</span><span className="min-w-0 truncate">{action.reason}</span></>}
  {next&&<span title={next.label} className="tabular-nums">Next action <time dateTime={next.date}>{date}</time>{(!action||action.reason!==next.label)&&<> · {next.label}</>}</span>}
 </button>;
}
