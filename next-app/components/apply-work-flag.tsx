import {applicationWorkFlag} from '../../lib/application-request-state.mjs';
import type {Application} from './workflow-types';
export function WorkIndicator({working}:{working:boolean}) {
 return working?<svg aria-hidden="true" className="h-4 w-4 shrink-0 animate-spin motion-reduce:animate-none" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" opacity=".25"/><path d="M12 3a9 9 0 0 1 9 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>:null;
}
export default function ApplyWorkFlag({application,item={}}:{application:Application;item?:object}) {
 const flag=applicationWorkFlag(application,item);
 return flag?<span role="status" aria-label={`AI Apply: ${flag.label}`} className="inline-flex items-center gap-1.5 rounded-md bg-board-panel px-2 py-1 text-xs font-semibold text-board-muted"><WorkIndicator working={flag.working}/>AI Apply · {flag.label}</span>:null;
}
