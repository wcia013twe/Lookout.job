import type { ReactNode } from "react";
type RoleMeta = { company:string; roleTitle:string; roleType:string; date:string; status:string; workflow:string };
export default function NeedsYouRow({title,context,reason,children,role}: {title:string;context:string;reason:string;children:ReactNode;role?:RoleMeta}) {
 return <li className="py-4 md:py-5">{role ? <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
  <div className="min-w-0"><p className="text-xs font-semibold uppercase tracking-wide text-board-muted">{role.company}</p><h2 className="mt-1 break-words font-bold">{role.roleTitle}</h2><div className="mt-2 flex flex-wrap gap-1.5 text-xs text-board-muted"><span className="rounded-md bg-board-tag px-2 py-1">{role.roleType}</span><span className="rounded-md bg-board-tag px-2 py-1">{role.date}</span><span className="rounded-md bg-board-tag px-2 py-1">{role.status}</span></div></div>
  <span className="w-fit rounded-md border border-board-line px-2 py-1 text-xs font-semibold text-board-accent">{role.workflow}</span>
 </div> : <><h2 className="font-bold">{title}</h2><p className="mt-1 text-sm text-board-muted">{context}</p></>}<p className="mt-3 max-w-prose text-sm leading-relaxed">{role && <strong className="mr-1">{title}.</strong>}{reason}</p><div className="mt-3 md:mt-4">{children}</div></li>;
}
