import type { ReactNode } from "react";
export default function NeedsYouRow({title,context,reason,children}: {title:string;context:string;reason:string;children:ReactNode}) {
 return <li className="py-5"><h2 className="font-bold">{title}</h2><p className="mt-1 text-sm text-board-muted">{context}</p><p className="mt-3 max-w-prose text-sm leading-relaxed">{reason}</p><div className="mt-4">{children}</div></li>;
}
