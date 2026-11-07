import {localDate,logInteraction,recordMeeting} from '../../lib/outreach-conversation.mjs';
// Fictional examples only; never merge these into account contacts or requests.
export const outreachDemoMessages = [
  {
    id: 'recruiter', label: 'Recruiter example', name: 'Alex (fictional)',
    company: 'Robinhood', contactType: 'recruiter',
    connection: 'We both studied computer science at Example University.',
    evidence: 'During my internship, I built a query cache that cut test-workload latency by 30%.',
    reason: 'Your team’s work on database reliability interests me because I enjoy debugging distributed systems.',
    message: 'Hi Alex,\n\nI’m Demo Candidate, a final-year computer science student and former backend engineering intern. We both studied computer science at Example University.\n\nDuring my internship, I built a query cache that cut test-workload latency by 30%. Your team’s work on database reliability interests me because I enjoy debugging distributed systems.\n\nI have a fictional return-offer deadline in two weeks. I’d like to interview for the Backend Engineer role at Robinhood.\n\nThanks,\nDemo Candidate',
  },
  {
    id: 'referral', label: 'Referral example', name: 'Jamie (fictional)',
    company: 'Stripe', contactType: 'alumni',
    connection: 'We met at the Example University systems club.',
    evidence: 'I recently built a distributed query service that sustained 2,000 requests per second in a demo benchmark.',
    reason: 'Your team’s work on query scheduling caught my attention because I want to work on predictable performance under load.',
    message: 'Hi Jamie,\n\nI’m Demo Candidate, a final-year computer science student. We met at the Example University systems club.\n\nI recently built a distributed query service that sustained 2,000 requests per second in a demo benchmark. Your team’s work on query scheduling caught my attention because I want to work on predictable performance under load.\n\nWould you feel comfortable referring me for the Infrastructure Engineer role at Stripe?\n\nThanks,\nDemo Candidate',
  },
];

// Relative dates keep each reset coherent without creating real activity.
export function demoConversation(contact, date, entries) {
  const result={...contact};
  entries.forEach(([offset,direction,channel,body],index)=>{
    const day=new Date(`${date}T12:00:00Z`);day.setUTCDate(day.getUTCDate()+offset);
    Object.assign(result,logInteraction(result,{id:`${contact.id}-message-${index+1}`,direction,channel,date:day.toISOString().slice(0,10),body}));
  });
  return result;
}

// Fresh records for each demo/reset; never used to seed a real account.
export function demoOutreachContacts(date = localDate()) {
  const contacts = [...outreachDemoMessages].reverse().map(example => {
    let contact = {
      ...example, id: `demo-${example.id}`, contact: example.name,
      title: example.id === 'referral' ? 'Infrastructure Engineer' : 'Backend Engineer',
      status: 'Not asked', source: 'Demo',
    };
    contact.tags=[`application:${example.id==='referral'?'demo-stripe':'demo-robinhood'}`];
    if(example.id === 'referral') {
      contact=demoConversation(contact,date,[
        [-8,'sent','LinkedIn','Hi Jamie, we met at the fictional university systems club. I am exploring the demo Infrastructure Engineer role at Stripe. My Query Lab project involved instrumenting query latency and investigating uneven worker utilization. Would you be comfortable pointing me toward the right team?'],
        [-7,'received','LinkedIn','Happy to help. The role spans reliability and infrastructure, but titles alone will not tell you the actual team. Are you more interested in storage/query systems or internal developer tools?'],
        [-6,'sent','LinkedIn','Storage and reliable execution are the stronger fit. My 2,000 requests/second result was a synthetic project benchmark, not production traffic. I would need mentorship on operating systems at real scale. What should I verify before assuming this would be a strong next step?'],
        [-5,'received','LinkedIn','Ask which team owns the headcount and for a recent project a new engineer owned end to end. I can make a fictional referral if you email your resume and a short project summary. Please use https://example.com/demo/stripe-role for this demo.'],
        [-4,'sent','Email','Moving our conversation to email as requested. I sent my demo resume separately. My project summary: instrumented query latency, identified scheduling skew and compared bounded queues with the original dispatch approach. The open questions are team ownership, mentorship and the balance between systems work and integrations.'],
        [-3,'received','Email','The fictional referral is submitted. It does not guarantee an interview. The recruiter will confirm the team; keep asking about the systems/integrations split. I can also introduce you to an engineer who joined last year.'],
        [-1,'sent','Email','The demo recruiter proposed a screen. Thank you. Before an introduction, I would like to understand how new engineers ramp up and whether they can own reliability work rather than only integrations.'],
        [0,'received','Email','Send me the two questions you most want answered and I will make the introduction. I suggest asking who reviews a new engineer’s first design and what their first three months of ownership looked like.'],
      ]);
      contact.status='Referred';contact.followUpDate=date;
    } else {
      contact=demoConversation(contact,date,[
        [-6,'received','Email','Fictional Robinhood recruiter update: we would like to arrange a backend conversation. Please share two available windows and any decision deadline you are working toward.'],
        [-5,'sent','Email','Tuesday afternoon or Wednesday morning works. I have a fictional return-offer deadline in two weeks. I am interested in backend reliability and would like to understand the exact team scope before making a decision.'],
        [-4,'received','Email','Wednesday works. I noted the deadline, though I cannot promise an accelerated decision. The first call will cover your background and the role; the technical conversation follows separately.'],
        [-2,'sent','Email','Thanks for the recruiter call. My open questions are how much of the work is core infrastructure versus product integration and who supports new engineers. I can discuss the query-latency investigation from my fictional Query Lab project.'],
        [-1,'received','Email','Your demo technical conversation is next. Prepare a project deep dive and be ready to explain reliability tradeoffs; this does not promise specific questions. I have passed the scope and mentorship questions to the hiring team.'],
        [0,'sent','Email','Thanks, Alex. I will prepare the project tradeoffs and distinguish the benchmark from production experience. Is there any additional preparation material, and can the hiring team address mentorship and on-call expectations after the round?'],
      ]);
    }
    const meetingDay=new Date(`${date}T12:00:00Z`);meetingDay.setUTCDate(meetingDay.getUTCDate()+(example.id==='referral'?2:-2));
    Object.assign(contact,recordMeeting(contact,{id:`${contact.id}-meeting`,kind:example.id==='referral'?'coffee_chat':'meeting',status:example.id==='referral'?'scheduled':'completed',date:meetingDay.toISOString().slice(0,10),location:example.id==='referral'?'Video call · fictional demo':'Recruiter call · fictional demo',notes:example.id==='referral'?'':'Fictional meeting notes: discussed team scope and the interview sequence. Follow up on mentorship and on-call expectations; no outcome was promised.'}));
    contact.professionalTitle=example.id==='referral'?'Infrastructure engineer':'Technical recruiter';
    contact.technicalInterests='Backend reliability, query execution, distributed systems';
    contact.relationshipSummary=example.id==='referral'?'Met at the fictional university systems club. Jamie made a referral and offered an introduction.':'Existing fictional recruiting contact. Discussed team scope, timing, and interview preparation.';
    contact.nextAction=example.id==='referral'?'Send the two questions for the engineer introduction.':'Wait for the recruiting update; keep preparing the project deep dive.';
    contact.suggestion={id:contact.id+'-suggestion',purpose:'maintain',rationale:example.id==='referral'?'Jamie offered an introduction to an engineer. Follow through on that existing offer.':'Keep your team-scope and mentorship questions ready for the next recruiter conversation.',action:example.id==='referral'?'Share two questions about onboarding and ownership.':'Review the questions for your next conversation.',sources:[{title:'Fictional demo context',url:'https://example.com/demo/context',observedAt:date}],createdAt:date+'T12:00:00Z',updatedAt:date+'T12:00:00Z',state:'active'};
    contact.message=example.id==='referral'?'Hi Jamie, thanks for offering the engineer introduction. My two questions are: who reviews a new engineer’s first design, and what did their first three months of ownership look like? Would you be comfortable passing those along?':'Hi Alex, for our next conversation, could we cover which team owns this role and how new engineers are supported during their first few months?';
    contact._updatedAt=date+'T12:00:00Z';
    return contact;
  });
  return [...contacts,{id:'demo-new-connection',contact:'Morgan (fictional)',company:'Stripe',professionalTitle:'Database engineer',technicalInterests:'Query planning, execution, storage',whyThem:'Public fictional technical work overlaps your query-engine interests. No relationship is established.',sources:[{title:'Fictional technical talk',url:'https://example.com/demo/talk',observedAt:date}],tags:['application:demo-stripe'],message:'Hi Morgan, I’m interviewing for the fictional infrastructure role and read your demo talk on query planning. In my Query Lab project, I investigated scheduling skew and query latency. Would you be open to a brief conversation about how new engineers take ownership?',status:'Not asked',source:'Demo',suggestion:{id:'demo-connect-suggestion',purpose:'connect',rationale:'You are interviewing for the fictional infrastructure role. Morgan’s query-planning talk could inform team research; exact team membership is unconfirmed.',action:'Open the fictional talk’s speaker route and ask about engineer ownership; confirm the team first.',sources:[{title:'Fictional technical talk',url:'https://example.com/demo/talk',observedAt:date}],createdAt:date+'T12:00:00Z',updatedAt:date+'T12:00:00Z',state:'active'}},{id:'demo-independent',contact:'Sam (fictional)',company:'',professionalTitle:'Independent engineer',relationshipSummary:'Former project collaborator. No current employer recorded.',nextAction:'Share an update when the project ships.',suggestion:{id:'demo-independent-dismissed',purpose:'maintain',rationale:'An earlier project update was dismissed; no new milestone is known.',action:'Wait for a real project milestone.',sources:[],createdAt:date+'T12:00:00Z',updatedAt:date+'T12:00:00Z',state:'dismissed'},status:'Not asked',source:'Demo'}];
}
