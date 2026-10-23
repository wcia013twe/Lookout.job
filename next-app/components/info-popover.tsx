"use client";
import {useEffect, useId, useRef, type ReactNode} from "react";

export default function InfoPopover({label, children}: {label:string; children:ReactNode}) {
  const id=useId(), trigger=useRef<HTMLButtonElement>(null), panel=useRef<HTMLDivElement>(null);
  function place() {
    if(!panel.current||!trigger.current)return;
    const rect=trigger.current.getBoundingClientRect(), el=panel.current;
    el.style.left=`${Math.max(16,Math.min(rect.left,window.innerWidth-el.offsetWidth-16))}px`;
    el.style.top=`${Math.max(16,Math.min(rect.bottom+8,window.innerHeight-el.offsetHeight-16))}px`;
  }
  useEffect(()=>{
    const update=()=>{if(panel.current?.matches(":popover-open"))place();};
    window.addEventListener("resize",update);document.addEventListener("scroll",update,true);
    return ()=>{window.removeEventListener("resize",update);document.removeEventListener("scroll",update,true);};
  },[]);
  return <span className="inline-flex shrink-0 align-middle">
    <button ref={trigger} type="button" popoverTarget={id} aria-label={`About ${label}`} className="inline-flex size-11 items-center justify-center rounded-lg text-board-muted hover:bg-board-tag hover:text-board-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-board-accent">
      <svg aria-hidden="true" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10v.1"/></svg>
    </button>
    <div ref={panel} id={id} popover="auto" aria-label={`About ${label}`} onToggle={event=>{if(event.newState==="open")place();}} className="fixed inset-auto m-0 w-[calc(100vw-2rem)] max-w-sm rounded-xl border border-board-line bg-board-panel p-4 text-sm font-normal leading-6 text-board-text shadow-[0_8px_24px_rgba(0,0,0,0.18)]">
      {children}
    </div>
  </span>;
}
