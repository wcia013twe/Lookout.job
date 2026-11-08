// Presentation over the owned planner snapshot; never writes or invents dates.
export function relativeCalendarDate(date, today) {
 const days = Math.round((Date.parse(`${date}T12:00:00Z`) - Date.parse(`${today}T12:00:00Z`)) / 86400000);
 return days === 0 ? 'Today' : days === 1 ? 'In 1 day' : days > 1 ? `In ${days} days` : 'Overdue';
}
export function upcomingPreparationDates(agenda) {
 const days = new Map(agenda.days.filter(day => day.date >= agenda.today && (day.items.length || day.interviews.length || day.events?.length || day.completedMinutes)).map(day => [day.date, {...day,events:[...(day.events || [])]}]));
 const pending = [];
 for (const task of agenda.pending || []) {
  if (!task.date || task.date < agenda.today) { pending.push(task); continue; }
  const day = days.get(task.date) || {date:task.date,items:[],interviews:[],events:[],completedMinutes:0,plannedMinutes:0};
  const kind = task.kind || (task.roundId && task.id.startsWith('round:') ? 'Application round' : 'Prep due');
  day.events.push({...task,kind});
  days.set(task.date,day);
 }
 return {...agenda,days:[...days.values()].sort((a,b)=>a.date.localeCompare(b.date)),pending};
}
