export type Point = {x:number;y:number};
export type Routine = {station:Point; aisle:Point; rest:Point; sprite:number; name:string; task:string; offset:number};
// Positions follow the low furniture in cloud-cottage.webp; NPCs are decorative.
export const routines:Routine[] = [
 {station:{x:25,y:40},aisle:{x:31,y:48},rest:{x:33,y:62},sprite:0,name:'the application desk',task:'type',offset:3},
 {station:{x:85,y:67},aisle:{x:75,y:65},rest:{x:68,y:64},sprite:1,name:'the music nook',task:'music',offset:8},
 {station:{x:73,y:41},aisle:{x:65,y:48},rest:{x:60,y:48},sprite:2,name:'the practice board',task:'write',offset:20},
 {station:{x:22,y:64},aisle:{x:30,y:65},rest:{x:44,y:69},sprite:3,name:'the reading table',task:'read',offset:27},
 {station:{x:50,y:54},aisle:{x:53,y:58},rest:{x:54,y:61},sprite:4,name:'the celebration rug',task:'celebrate',offset:1},
];
export function sampleTravel(start:Point,end:Point,progress:number){
 const t=Math.max(0,Math.min(1,progress));
 return {x:start.x+(end.x-start.x)*t,y:start.y+(end.y-start.y)*t,direction:end.x<start.x?-1:1};
}
const distance=(a:Point,b:Point)=>Math.hypot(b.x-a.x,(b.y-a.y)*2/3);
function along(points:Point[],progress:number){
 const lengths=points.slice(1).map((point,index)=>distance(points[index],point));
 const total=lengths.reduce((sum,length)=>sum+length,0);
 let remaining=Math.max(0,Math.min(1,progress))*total;
 for(let index=0;index<lengths.length;index++){
  const length=lengths[index];
  if(remaining<=length||index===lengths.length-1){const a=points[index],b=points[index+1],t=length?remaining/length:0;return {x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t,direction:b.x<a.x?-1:1};}
  remaining-=length;
 }
 return {...points[0],direction:1};
}
export function sampleRoutine(routine:Routine,seconds:number,reduced=false){
 const time=((seconds%44)+44)%44;
 if(reduced||time<17||time>=37)return {...routine.station,mode:'working' as const,direction:1,frame:0,journey:''};
 if(time<24)return {...along([routine.station,routine.aisle,routine.rest],(time-17)/7),mode:'walking' as const,frame:Math.floor(time*7)%4,journey:'Hopping over for a little break'};
 if(time<29)return {...routine.rest,mode:'resting' as const,direction:1,frame:0,journey:''};
 return {...along([routine.rest,routine.aisle,routine.station],(time-29)/8),mode:'walking' as const,frame:Math.floor(time*7)%4,journey:`Heading to ${routine.name}`};
}
