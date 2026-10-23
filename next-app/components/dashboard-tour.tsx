"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { useWorkspace } from "../lib/workspace";
import { dashboardTourKey, dashboardTourSteps, dashboardTourVersion, shouldStartDashboardTour } from "../lib/dashboard-tour.mjs";
import styles from "./dashboard-tour.module.css";
import DashboardTourIllustration from "./dashboard-tour-illustration";

type Rect = { top:number; left:number; width:number; height:number };

export default function DashboardTour() {
  const w = useWorkspace();
  const reduced = useReducedMotion();
  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState(0);
  const [spotlight, setSpotlight] = useState<Rect|null>(null);
  const [position, setPosition] = useState({top:24,left:16});
  const dialog = useRef<HTMLDialogElement>(null);
  const card = useRef<HTMLDivElement>(null);
  const next = useRef<HTMLButtonElement>(null);
  const key = dashboardTourKey(w.accountUser?.id || w.user?.id);

  useEffect(() => {
    const url = new URL(window.location.href);
    const request = url.searchParams.get("tour");
    if (!request) return;
    let dismissed = false;
    try { dismissed = w.demo ? w.store.get("ui.dashboardTour") === dashboardTourVersion : localStorage.getItem(key) === "dismissed"; } catch { /* Private browsing can disable storage. */ }
    url.searchParams.delete("tour");
    history.replaceState(history.state, "", url);
    const start=shouldStartDashboardTour(request, dismissed);
    if(start&&w.demo)w.store.set("ui.dashboardArrival",true);
    setVisible(start);
  }, [key, w.demo, w.store]);

  useEffect(() => {
    if (!visible) return;
    const node = dialog.current;
    const opener = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    node?.showModal();
    next.current?.focus();
    return () => {
      node?.close();
      document.body.style.overflow = previousOverflow;
      if (opener instanceof HTMLElement && opener.isConnected) opener.focus({preventScroll:true});
    };
  }, [visible]);

  useEffect(() => {
    if (!visible) return;
    const targets = dashboardTourSteps[step].targets.map((selector:string)=>document.querySelector<HTMLElement>(selector)).filter((element:HTMLElement|null):element is HTMLElement=>Boolean(element));
    targets[0]?.scrollIntoView({block:"nearest",behavior:"instant"});
    function positionCard() {
      const boxes = targets.map((target:HTMLElement)=>target.getBoundingClientRect()).filter((rect:DOMRect)=>rect.width>0 && rect.height>0 && rect.bottom>0 && rect.top<innerHeight);
      const top = boxes.length ? Math.max(8,Math.min(...boxes.map((r:DOMRect)=>r.top))-14) : 0;
      const left = boxes.length ? Math.max(8,Math.min(...boxes.map((r:DOMRect)=>r.left))-14) : 0;
      const right = boxes.length ? Math.min(innerWidth-8,Math.max(...boxes.map((r:DOMRect)=>r.right))+14) : 0;
      const bottom = boxes.length ? Math.min(innerHeight-8,Math.max(...boxes.map((r:DOMRect)=>r.bottom))+14) : 0;
      const rect = boxes.length ? {top,left,width:right-left,height:bottom-top} : null;
      setSpotlight(rect);
      const width = Math.min(360,innerWidth-32);
      const height = card.current?.offsetHeight || 250;
      setPosition({left:rect ? Math.max(16,Math.min(rect.left,innerWidth-width-16)) : Math.max(16,(innerWidth-width)/2),top:rect ? (bottom+height+28<innerHeight ? bottom+16 : Math.max(16,top-height-16)) : Math.max(16,(innerHeight-height)/2)});
    }
    positionCard();
    next.current?.focus({preventScroll:true});
    const observer = new ResizeObserver(positionCard);
    if(card.current)observer.observe(card.current);
    targets.forEach((target:HTMLElement)=>observer.observe(target));
    window.addEventListener("resize",positionCard);
    window.addEventListener("scroll",positionCard,true);
    return ()=>{observer.disconnect();window.removeEventListener("resize",positionCard);window.removeEventListener("scroll",positionCard,true);};
  }, [visible,step]);

  function finish() {
    try {
      if(w.demo) w.store.set("ui.dashboardTour",dashboardTourVersion);
      else localStorage.setItem(key,"dismissed");
    } catch { /* Dismissing remains usable without storage. */ }
    setVisible(false);
  }
  const current = dashboardTourSteps[step];
  return <dialog ref={dialog} className={styles.dialog} aria-labelledby="dashboard-tour-title" aria-describedby="dashboard-tour-description" onCancel={event=>{event.preventDefault();finish();}}>
    {visible && <>
      {spotlight ? <div className={styles.spotlight} style={spotlight} aria-hidden="true"/> : <div className={styles.scrim} aria-hidden="true"/>}
      <div ref={card} className={styles.card} style={position}>
        <motion.div key={step} initial={reduced?false:{opacity:0,y:6}} animate={{opacity:1,y:0}} transition={{duration:.18}}>
          <div className={styles.progress}><span className={styles.dots} aria-hidden="true"><i/><i/><i/><i/></span><span>{step+1} of {dashboardTourSteps.length}</span></div>
          <DashboardTourIllustration variant={current.illustration}/>
          <h2 id="dashboard-tour-title">{current.title}</h2>
          <p id="dashboard-tour-description">{current.text}</p>
        </motion.div>
        <div className={styles.actions}>
          <button type="button" className={styles.skip} onClick={finish}>Skip tour</button>
          <button ref={next} type="button" className={styles.next} onClick={()=>step===dashboardTourSteps.length-1?finish():setStep(value=>value+1)}>{step===dashboardTourSteps.length-1?"Got it":"Next"}</button>
        </div>
      </div>
    </>}
  </dialog>;
}
