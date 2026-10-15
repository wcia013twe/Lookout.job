export type Point = {x:number;y:number};
export type Routine = {station:Point; aisle:Point; rest:Point; sprite:number; name:string; task:string; offset:number};
// Positions follow the furniture in clubhouse.webp, not a member's online state.
export const routines:Routine[] = [
 {station:{x:51,y:59},aisle:{x:48,y:68},rest:{x:38,y:84},sprite:1,name:'the rug',task:'celebrate',offset:0},
 {station:{x:73,y:44},aisle:{x:64,y:53},rest:{x:57,y:78},sprite:2,name:'the whiteboard',task:'write',offset:19},
 {station:{x:82,y:59},aisle:{x:69,y:65},rest:{x:69,y:88},sprite:3,name:'the practice corner',task:'read',offset:5},
 {station:{x:88,y:65},aisle:{x:77,y:78},rest:{x:82,y:91},sprite:4,name:'the sofa',task:'coffee',offset:11},
 {station:{x:18,y:39},aisle:{x:19,y:52},rest:{x:17,y:78},sprite:5,name:'the reading desk',task:'browse',offset:25},
 {station:{x:36,y:39},aisle:{x:36,y:53},rest:{x:32,y:70},sprite:0,name:'the application desk',task:'type',offset:3},
];
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
 if(time<24)return {...along([routine.station,routine.aisle,routine.rest],(time-17)/7),mode:'walking' as const,frame:Math.floor(time*7)%4,journey:'Stretching their legs'};
 if(time<29)return {...routine.rest,mode:'resting' as const,direction:1,frame:0,journey:''};
 return {...along([routine.rest,routine.aisle,routine.station],(time-29)/8),mode:'walking' as const,frame:Math.floor(time*7)%4,journey:`Heading to ${routine.name}`};
}
