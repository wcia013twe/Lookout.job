// Demo-only event draft. No OAuth, event creation, attendees or interviewer content.
export function mockCalendarPreview(content){
 if(!['scheduled','in_progress'].includes(content.sessionStatus)||content.kind!=='mock_interview'||!content.scheduledAt||!content.durationMinutes)return null;
 const start=new Date(content.scheduledAt),end=new Date(start.getTime()+content.durationMinutes*60000);
 if(!Number.isFinite(start.getTime()))return null;
 const stamp=date=>date.toISOString().replace(/[-:]/g,'').replace(/\.\d{3}Z$/,'Z');
 const query=new URLSearchParams({action:'TEMPLATE',text:`Demo · ${content.title}`,dates:`${stamp(start)}/${stamp(end)}`,ctz:content.timeZone||'UTC',details:'Fictional Lookout mock interview. Call your own agent when you are ready. Interviewer preparation stays private in Lookout. This link opens an event draft; it does not save an event or activate reminders.'});
 return `https://calendar.google.com/calendar/r/eventedit?${query}`;
}
