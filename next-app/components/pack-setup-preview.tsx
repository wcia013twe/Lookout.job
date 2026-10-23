"use client";
import { useState } from "react";
import { secondary } from "./ui";
import styles from "./daily-drops.module.css";

export default function PackSetupPreview({title}:{title:string}) {
  const [open,setOpen]=useState(false);
  return <aside aria-label="Card pack preview" className="min-w-0 pt-2">
    <div className="flex flex-wrap items-baseline justify-between gap-2"><h3 className="text-sm font-semibold">Preview</h3><span className="text-xs text-board-muted">Fictional cards · not saved</span></div>
    <div className={styles.strip}>
      <div className={styles.header}>
        <div className={styles.info}>
          <h4 className={styles.title} style={{overflowWrap:"anywhere"}}>{title.trim()||"My discovery pack"}</h4>
          <div className={styles.banner}><strong>Sample day</strong><span>2 drops</span><span className={styles.newMarker}>2 new</span></div>
        </div>
        <button type="button" className={`${secondary} ${styles.packButton}`} aria-expanded={open} onClick={()=>setOpen(!open)}>{open?"Close preview":"Preview cards"}</button>
      </div>
      <div className="h-3"/>
      {open&&<div className={styles.full}>
        <div className={styles.rows}>
          {[["Example Compute","Backend Engineer","added","Employer verified · matches your search."],["Example Data","Systems Internship","pending","Team details need verification."]].map(([company,role,status,note])=><div className={styles.row} key={company}>
            <div className={styles.rowSummary}>
              <div className={styles.rowTitle}><strong>{company}</strong><span>{role}</span></div>
              <span className={styles.status} data-status={status}>{status}</span>
            </div>
            <div className={styles.rowDetails}><p className={styles.note}>{note}</p></div>
          </div>)}
        </div>
      </div>}
    </div>
  </aside>;
}
