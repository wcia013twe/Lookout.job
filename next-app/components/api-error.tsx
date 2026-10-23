import {secondary} from './ui';
export default function ApiError({message,onRetry,cached=false}:{message:string;onRetry?:()=>void;cached?:boolean}){
 if(!message)return null;
 return <section role="alert" aria-label="API request failed" className="my-5 min-w-0 border-y border-board-line py-5">
  <h2 className="text-base font-semibold">Could not load or save your data</h2>
  <p className="mt-2 max-w-prose break-words text-sm leading-relaxed">{message}</p>
  {cached&&<p className="mt-2 text-sm text-board-muted">Any records shown below are the last loaded or locally saved copy. They have not been refreshed successfully.</p>}
  {onRetry&&<button type="button" className={`${secondary} mt-3`} onClick={onRetry}>Check again</button>}
 </section>;
}
