export const dailyRoutines = [
  {id:'morning',title:'Morning sweep',time:'08:00',description:'Find opportunities and prepare your next steps.'},
  {id:'noon',title:'Midday check-in',time:'12:00',description:'Review progress, pending applications, and your job pack.'},
  {id:'afternoon',title:'Afternoon focus',time:'15:00',description:'Work on your weekly focus and interview preparation.'},
  {id:'evening',title:'Evening networking',time:'20:00',description:'Catch up on referrals, follow-ups, and networking.'},
];
export function defaultDailySchedule(timezone='UTC') {
  return {enabled:true,timezone,routines:dailyRoutines.map(routine=>({...routine,enabled:true}))};
}

// Older saved defaults contained only id/time/enabled. Keep their choices and
// enrich the labels without restoring defaults the user deliberately removed.
export function readDailySchedule(value,timezone='UTC') {
  if(!value||!Array.isArray(value.routines))return defaultDailySchedule(timezone);
  return {...value,routines:value.routines.map((routine,index)=>({
    id:typeof routine.id==='string'?routine.id:`saved-${index}`,
    title:dailyRoutines.find(r=>r.id===routine.id)?.title||'Untitled task',
    description:dailyRoutines.find(r=>r.id===routine.id)?.description||'',
    ...routine,
  }))};
}
