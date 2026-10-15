'use client';

import {useEffect, useRef, type RefObject} from 'react';
import {routines,sampleRoutine} from './room-motion';

export function useRoomMotion(roomRef:RefObject<HTMLDivElement|null>,paused:boolean,membersKey:string){
 const pauseRef=useRef(paused);
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
  function paint(actor:HTMLButtonElement,index:number){
   const routine=routines[Number(actor.dataset.routine)];
   const sample=sampleRoutine(routine,clocks[index],preference.matches);
   actor.style.setProperty('--move-x',`${sample.x}cqw`);
   actor.style.setProperty('--move-y',`${sample.y*2/3}cqw`);
   actor.style.setProperty('--direction',String(sample.direction));
   actor.style.setProperty('--walk-y',`${[0,41.4365,82.873,41.4365][sample.frame]}%`);
   actor.style.zIndex=String(Math.round(sample.y));
   if(actor.dataset.mode!==sample.mode){actor.dataset.mode=sample.mode;const label=actor.querySelector('[data-journey]');if(label)label.textContent=sample.journey;}
   return sample;
  }
  function draw(now:number){
   raf=0;
   if(!visible||document.hidden){room!.dataset.sleeping='true';return;}
   const delta=last?Math.min((now-last)/1000,.1):0;last=now;
   if(visible&&!document.hidden){
    const boxes:{left:number;right:number;top:number;bottom:number}[]=[];
    actors.forEach((actor,index)=>{
     if(!pauseRef.current&&!preference.matches&&!actor.matches(':hover,:focus-visible'))clocks[index]+=delta;
     const sample=paint(actor,index);
     // Pack only the labels; characters continue along their floor routes.
     const bubbleWidth=154/width*100,bubbleHeight=(sample.mode==='walking'?48:90)/width*150;
     const left=sample.x-bubbleWidth/2,right=sample.x+bubbleWidth/2;
     let bottom=sample.y-18.75,top=bottom-bubbleHeight,shift=0;
     for(const previous of boxes){if(left<previous.right+1&&right>previous.left-1&&top<previous.bottom+1&&bottom>previous.top-1){const amount=bottom-previous.top+2;shift+=amount;top-=amount;bottom-=amount;}}
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
