"use client";

import { motion, useReducedMotion } from "framer-motion";
import type { ReactNode } from "react";
import ProfileIcon, { type ProfileIconName } from "./profile-icon";
import styles from "./dashboard-tour-illustration.module.css";

type Node = { x:number; y:number; icon:ProfileIconName; size?:number };
function Diagram({nodes,edges,reduced}:{nodes:Node[];edges:[number,number][];reduced:boolean}) {
  return <>
    <svg className={styles.connections} viewBox="0 0 256 150" fill="none">{edges.map(([from,to],index)=><motion.path key={index} d={`M${nodes[from].x} ${nodes[from].y} L${nodes[to].x} ${nodes[to].y}`} stroke="currentColor" strokeWidth="1.5" initial={reduced?false:{pathLength:0,opacity:0}} animate={{pathLength:1,opacity:.7}} transition={{duration:reduced?0:.5,delay:reduced?0:.15+index*.16}}/>)}</svg>
    {nodes.map((node,index)=><motion.span key={index} className={`${styles.node} ${index===0?styles.hub:""}`} style={{left:`${node.x/256*100}%`,top:`${node.y/150*100}%`,width:node.size||36,height:node.size||36}} initial={reduced?false:{opacity:0,scale:.7}} animate={{opacity:1,scale:1}} transition={{duration:reduced?0:.35,delay:reduced?0:index*.16}}><ProfileIcon name={node.icon} width={index===0?25:19} height={index===0?25:19}/></motion.span>)}
  </>;
}

function Paper({reduced,children}:{reduced:boolean;children?:ReactNode}) {
  return <motion.div className={styles.paper} initial={reduced?false:{opacity:0,y:8}} animate={{opacity:1,y:0}} transition={{duration:reduced?0:.35}}>
    <span className={styles.paperHeading}><ProfileIcon name="user" width={17} height={17}/><i/></span>
    {[.85,.65,.9,.55].map((width,index)=><motion.i key={index} className={styles.line} style={{width:`${width*100}%`}} initial={reduced?false:{scaleX:0}} animate={{scaleX:1}} transition={{duration:reduced?0:.35,delay:reduced?0:.2+index*.15}}/>)}
    {children}
  </motion.div>;
}

export default function DashboardTourIllustration({variant}:{variant:string}) {
  const reduced=Boolean(useReducedMotion());
  let content:ReactNode;
  if(variant==='network') {
    content=<Diagram reduced={reduced} nodes={[{x:128,y:60,icon:'user',size:52},{x:32,y:24,icon:'user'},{x:224,y:24,icon:'user'},{x:128,y:126,icon:'user'}]} edges={[[0,1],[0,2],[0,3]]}/>;
  } else if(variant==='workspace') {
    content=<Diagram reduced={reduced} nodes={[{x:42,y:75,icon:'conversation',size:52},{x:150,y:35,icon:'file',size:40},{x:214,y:108,icon:'check',size:40}]} edges={[[0,1],[0,2]]}/>;
  } else if(variant==='applications') {
    content=<Diagram reduced={reduced} nodes={[{x:30,y:75,icon:'briefcase',size:44},{x:128,y:75,icon:'file',size:44},{x:226,y:75,icon:'check',size:44}]} edges={[[0,1],[1,2]]}/>;
  } else if(variant==='circles') {
    content=<><Diagram reduced={reduced} nodes={[{x:128,y:42,icon:'user',size:44},{x:46,y:58,icon:'user'},{x:210,y:58,icon:'user'},{x:128,y:116,icon:'conversation',size:44}]} edges={[[0,1],[0,2],[1,3],[2,3]]}/><motion.span className={styles.messageDot} initial={reduced?false:{opacity:0}} animate={{opacity:1}} transition={{delay:reduced?0:1}}/></>;
  } else if(variant==='discover') {
    content=<div className={styles.roleStack}>{[0,1,2].map(index=><motion.div key={index} className={styles.roleTile} initial={reduced?false:{opacity:0,y:20,rotate:-7}} animate={{opacity:1,y:0,rotate:0}} transition={{duration:reduced?0:.45,delay:reduced?0:index*.18}}><ProfileIcon name="briefcase" width={21} height={21}/><i/><i/><span><b/><b/><b/></span></motion.div>)}</div>;
  } else if(variant==='review') {
    content=<><motion.div className={styles.reviewSheet} initial={reduced?false:{opacity:0,y:8}} animate={{opacity:1,y:0}} transition={{duration:reduced?0:.35}}>{[0,1,2].map(index=><motion.div key={index} initial={reduced?false:{opacity:0,x:-8}} animate={{opacity:1,x:0}} transition={{delay:reduced?0:index*.15}}><span className={index===1?styles.attention:styles.reviewDot}/><i/><ProfileIcon name={index===1?'user':'file'} width={16} height={16}/></motion.div>)}</motion.div><motion.span className={styles.floatingCheck} initial={reduced?false:{opacity:0,scale:.6}} animate={{opacity:1,scale:1}} transition={{duration:reduced?0:.35,delay:reduced?0:.7}}><ProfileIcon name="check" width={22} height={22}/></motion.span></>;
  } else {
    content=<><Paper reduced={reduced}/><motion.span className={styles.pen} initial={reduced?false:{opacity:0,y:-16,x:12,rotate:-10}} animate={{opacity:1,y:0,x:0,rotate:0}} transition={{duration:reduced?0:.8,delay:reduced?0:.2}}><ProfileIcon name="pen" width={25} height={25}/></motion.span><motion.span className={styles.floatingCheck} initial={reduced?false:{opacity:0,scale:.6}} animate={{opacity:1,scale:1}} transition={{duration:reduced?0:.35,delay:reduced?0:1}}><ProfileIcon name="check" width={22} height={22}/></motion.span></>;
  }
  return <div className={styles.illustration} aria-hidden="true">{content}</div>;
}
