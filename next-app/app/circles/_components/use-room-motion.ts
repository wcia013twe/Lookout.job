'use client';

import {useEffect, useRef, type RefObject} from 'react';
import {routines,sampleRoutine,sampleTravel,type Point} from './room-motion';

export function useRoomMotion(roomRef:RefObject<HTMLDivElement|null>,paused:boolean,membersKey:string,gathered=false){
 const pauseRef=useRef(paused);
 const gatherRef=useRef(gathered);
 useEffect(()=>{gatherRef.current=gathered;},[gathered]);
 useEffect(()=>{pauseRef.current=paused;},[paused]);
 useEffect(()=>{
  const room=roomRef.current;if(!room)return;
  const actors=Array.from(room.querySelectorAll<HTMLButtonElement>('[data-routine]'));
  const preference=matchMedia('(prefers-reduced-motion: reduce)');
  const clocks=actors.map(actor=>routines[Number(actor.dataset.routine)].offset);
  let raf=0,last=0,visible=true,width=room.clientWidth;
  function wake(){room!.dataset.sleeping=String(!visible||document.hidden);if(!raf&&visible&&!document.hidden){last=0;raf=requestAnimationFrame(draw);}}
  const observer=new IntersectionObserver(entries=>{visible=entries[0]?.isIntersecting??false;wake();});observer.observe(room);
  document.addEventListener('visibilitychange',wake);
  const resize=new ResizeObserver(()=>{width=room.clientWidth;});resize.observe(room);
  let lastGathered=gatherRef.current;
  const travel:(null|{start:Point;end:Point;elapsed:number})[]=actors.map(()=>null);
  const previous:Point[]=actors.map((actor,index)=>sampleRoutine(routines[Number(actor.dataset.routine)],clocks[index]));
  function paint(actor:HTMLButtonElement,index:number){
   const routine=routines[Number(actor.dataset.routine)];
   const base=sampleRoutine(routine,clocks[index],preference.matches);
   let sample:{x:number;y:number;direction:number;mode:string;frame:number;journey:string}=base;
   const trip=travel[index];
   if(trip){
    const arrived=preference.matches||trip.elapsed>=5;
    sample=arrived?{...trip.end,direction:1,mode:gatherRef.current?'resting':'working',frame:0,journey:''}:{...sampleTravel(trip.start,trip.end,trip.elapsed/5),mode:'walking',frame:0,journey:gatherRef.current?'Joining the rug':'Back to their station'};
    if(arrived&&!gatherRef.current){travel[index]=null;clocks[index]=0;}
   }
   previous[index]=sample;
   actor.style.setProperty('--move-x',`${sample.x}cqw`);
   actor.style.setProperty('--move-y',`${sample.y*2/3}cqw`);
   actor.style.setProperty('--direction',String(sample.direction));

   actor.style.zIndex=String(Math.round(sample.y));
   if(actor.dataset.mode!==sample.mode){actor.dataset.mode=sample.mode;const label=actor.querySelector('[data-journey]');if(label)label.textContent=sample.journey;}
   return sample;
  }
  function draw(now:number){
   raf=0;
   if(!visible||document.hidden){room!.dataset.sleeping='true';return;}
   const delta=last?Math.min((now-last)/1000,.1):0;last=now;
   if(visible&&!document.hidden){
    if(gatherRef.current!==lastGathered){
     lastGathered=gatherRef.current;
     actors.forEach((actor,index)=>{const routine=routines[Number(actor.dataset.routine)];travel[index]={start:previous[index],end:lastGathered?routine.rest:routine.station,elapsed:0};});
    }
    const boxes:{left:number;right:number;top:number;bottom:number}[]=[];
    const samples=actors.map((actor,index)=>{
     if(!pauseRef.current&&!actor.matches(':hover,:focus-visible')){if(travel[index])travel[index]!.elapsed+=delta;else if(!preference.matches)clocks[index]+=delta;}
     return paint(actor,index);
    });
    const bodies=samples.map(sample=>({left:sample.x-5.5,right:sample.x+5.5,top:sample.y-16.5,bottom:sample.y}));
    actors.forEach((actor,index)=>{
     const sample=samples[index];
     const bubbleWidth=140/width*100,bubbleHeight=(sample.mode==='walking'?48:gatherRef.current?54:70)/width*150;
     const left=sample.x-bubbleWidth/2,right=sample.x+bubbleWidth/2;
     let bottom=sample.y-16.5,top=bottom-bubbleHeight,shift=0;
     const obstacles=[...boxes,...bodies.filter((_,bodyIndex)=>bodyIndex!==index)];
     // Keep labels clear of both other labels and the companions themselves.
     for(let pass=0;pass<10;pass++){
      let moved=false;
      for(const obstacle of obstacles){if(left<obstacle.right+.5&&right>obstacle.left-.5&&top<obstacle.bottom+.5&&bottom>obstacle.top-.5){const amount=bottom-obstacle.top+1;shift+=amount;top-=amount;bottom-=amount;moved=true;}}
      if(!moved)break;
     }
     boxes.push({left,right,top,bottom});
     actor.style.setProperty('--label-lift',`${Math.max(0,shift)*2/3}cqw`);
    });
   }
   raf=requestAnimationFrame(draw);
  }
  actors.forEach(paint);raf=requestAnimationFrame(draw);
  return ()=>{cancelAnimationFrame(raf);observer.disconnect();resize.disconnect();document.removeEventListener('visibilitychange',wake);delete room.dataset.sleeping;};
 },[roomRef,membersKey]);
}
