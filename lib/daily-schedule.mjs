export const dailyRoutines = [
  {id:'morning',title:'Morning sweep',time:'08:00',description:'Find opportunities and prepare your next steps.'},
  {id:'noon',title:'Midday check-in',time:'12:00',description:'Review progress, pending applications, and your job pack.'},
  {id:'afternoon',title:'Afternoon focus',time:'15:00',description:'Work on your weekly focus and interview preparation.'},
  {id:'evening',title:'Evening networking',time:'20:00',description:'Catch up on referrals, follow-ups, and networking.'},
];
export function defaultDailySchedule(timezone='UTC') {
  return {enabled:true,timezone,routines:dailyRoutines.map(({id,time})=>({id,time,enabled:true}))};
}
