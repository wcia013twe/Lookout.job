import type { ReactNode } from "react";
type RoleMeta = { company:string; roleTitle:string; roleType:string; date:string; status:string; workflow:string };
export function TaskIcon({ calendar = false }: { calendar?: boolean }) {
 return <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">{calendar ? <><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 11h18M8 15h2M14 15h2"/></> : <><rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V2h6v2M9 10h6M9 14h6M9 18h3"/></>}</svg>;
}
export function ActionButton({label,onClick,disabled=false,expanded,controls,children}: {label:string;onClick:()=>void;disabled?:boolean;expanded?:boolean;controls?:string;children?:ReactNode}) {
 return <button type="button" className="handoff-action" aria-label={typeof children === "string" ? `${children}: ${label}` : label} aria-expanded={expanded} aria-controls={controls} disabled={disabled} onClick={onClick}>{children || "Review application"}<svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d={expanded ? "m6 15 6-6 6 6" : "M5 12h14m-6-6 6 6-6 6"}/></svg></button>;
}
export default function NeedsYouRow({title,context,reason,children,role,control}: {title:string;context:string;reason:string;children?:ReactNode;role?:RoleMeta;control:ReactNode}) {
 return <li className="action-board-row py-5" data-expanded={Boolean(children) || undefined}>
  <div className="action-row-top">
   <div className="min-w-0">
    <h3 className="font-semibold leading-snug">{title}</h3>
    <p className="mt-1 break-words text-sm text-board-muted">{context}</p>
    {role && <div className="action-row-meta mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-board-muted"><span className="action-workflow-status rounded-md bg-board-tag px-2 py-1">{role.workflow}</span><span>{role.roleType} · {role.date} · {role.status}</span></div>}
    <p className="action-row-reason mt-2 max-w-prose text-sm leading-relaxed text-board-muted">{reason}</p>
   </div>
   <div className="action-row-control">{control}</div>
  </div>
  {children && <div className="action-row-detail mt-5 pt-5">{children}</div>}
 </li>;
}
