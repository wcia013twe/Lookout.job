"use client";

import {useEffect, useRef, useState} from 'react';
import {ResponsiveSankey} from '@nivo/sankey';
import {applicationFlow} from '../../lib/application-flow.mjs';
import type {Application} from './workflow-types';

// SVG colors are explicit so Nivo can interpolate gradient links in both themes.
const colors:Record<string,string>={applied:'#5485d1',waiting:'#a97abd',screen:'#c68a35',interview:'#4589ad',offer:'#309675',rejected:'#c76d7d',withdrawn:'#8a859e'};
export default function ApplicationFlowChart({applications,trackerItems}:{applications:Application[];trackerItems:Record<string,unknown>}) {
 const flow=applicationFlow(applications,trackerItems),container=useRef<HTMLDivElement>(null);
 const [wide,setWide]=useState(false);
 useEffect(()=>{if(!container.current)return;const observer=new ResizeObserver(([entry])=>setWide(entry.contentRect.width>=640));observer.observe(container.current);return()=>observer.disconnect();},[]);
 return <section className="mt-6 rounded-xl border border-board-line bg-board-panel p-4 sm:p-6" aria-labelledby="application-flow-title">
  <h3 id="application-flow-title" className="text-lg font-semibold">Application flow</h3>
  <p id="application-flow-description" className="mt-1 text-sm text-board-muted">{flow.total} {flow.total===1?'application':'applications'} · Current recorded stages and outcomes</p>
  {flow.total>0 ? <>
   <div ref={container} className="mt-6 h-72 sm:h-96" data-application-flow-chart>
    <ResponsiveSankey data={{nodes:flow.nodes,links:flow.links}} margin={{top:16,right:wide?162:16,bottom:16,left:wide?146:16}}
     align="justify" sort="input" colors={node=>colors[node.id]} nodeThickness={14} nodeSpacing={22} nodeBorderWidth={0} nodeBorderRadius={4}
     linkOpacity={0.35} linkHoverOpacity={0.6} linkHoverOthersOpacity={0.18} enableLinkGradient linkBlendMode="normal"
     label={node=>`${node.name} (${node.value})`} enableLabels={wide} labelPosition="outside" labelPadding={12} labelOrientation="horizontal"
     labelTextColor="var(--color-board-text)" theme={{text:{fontFamily:'inherit',fontSize:13}}} animate={false}
     role="img" ariaLabel="Applications flowing into their current recorded outcomes" ariaDescribedBy="application-flow-description"
     nodeTooltip={({node})=><div className="rounded-lg border border-board-line bg-board-panel px-3 py-2 text-sm text-board-text">{node.name}: <strong>{node.value}</strong></div>}
     linkTooltip={({link})=><div className="rounded-lg border border-board-line bg-board-panel px-3 py-2 text-sm text-board-text">Applications → {link.target.name}: <strong>{link.value}</strong></div>}
    />
   </div>
   <dl aria-label="Application flow counts" className="mt-4 flex flex-wrap gap-x-6 gap-y-3 text-sm">{flow.destinations.map((destination:{id:string;label:string;count:number})=><div key={destination.id} className="flex items-center gap-2"><dt className="flex items-center gap-2"><span aria-hidden="true" className="size-2.5 rounded-sm" style={{backgroundColor:colors[destination.id]}}/>{destination.label}</dt><dd className="font-semibold tabular-nums">{destination.count}</dd></div>)}</dl>
  </> : <p className="py-10 text-sm text-board-muted">Your flow will appear when an application or hiring stage is recorded.</p>}
  <p className="mt-5 text-xs leading-relaxed text-board-muted">Saved jobs and drafts are excluded. Missing responses are not marked as ghosted. This shows the latest recorded state, not every step an application took.</p>
 </section>;
}
