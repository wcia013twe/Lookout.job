import {localDate,logInteraction} from '../../lib/outreach-conversation.mjs';
// Fictional examples only; never merge these into account contacts or requests.
export const outreachDemoMessages = [
  {
    id: 'recruiter', label: 'Recruiter example', name: 'Alex (fictional)',
    company: 'Example Systems', contactType: 'recruiter',
    connection: 'We both studied computer science at Example University.',
    evidence: 'During my internship, I built a query cache that cut test-workload latency by 30%.',
    reason: 'Your team’s work on database reliability interests me because I enjoy debugging distributed systems.',
    message: 'Hi Alex,\n\nI’m Demo Candidate, a final-year computer science student and former backend engineering intern. We both studied computer science at Example University.\n\nDuring my internship, I built a query cache that cut test-workload latency by 30%. Your team’s work on database reliability interests me because I enjoy debugging distributed systems.\n\nI have a fictional return-offer deadline in two weeks. I’d like to interview for the Backend Engineer role at Example Systems.\n\nThanks,\nDemo Candidate',
  },
  {
    id: 'referral', label: 'Referral example', name: 'Jamie (fictional)',
    company: 'Example Compute', contactType: 'alumni',
    connection: 'We met at the Example University systems club.',
    evidence: 'I recently built a distributed query service that sustained 2,000 requests per second in a demo benchmark.',
    reason: 'Your team’s work on query scheduling caught my attention because I want to work on predictable performance under load.',
    message: 'Hi Jamie,\n\nI’m Demo Candidate, a final-year computer science student. We met at the Example University systems club.\n\nI recently built a distributed query service that sustained 2,000 requests per second in a demo benchmark. Your team’s work on query scheduling caught my attention because I want to work on predictable performance under load.\n\nWould you feel comfortable referring me for the Infrastructure Engineer role at Example Compute?\n\nThanks,\nDemo Candidate',
  },
];

// Fresh records for each demo/reset; never used to seed a real account.
export function demoOutreachContacts(date = localDate()) {
  return [...outreachDemoMessages].reverse().map(example => {
    const contact = {
    ...example, id: `demo-${example.id}`, contact: example.name,
    title: example.id === 'referral' ? 'Infrastructure Engineer' : 'Backend Engineer',
    status: 'Not asked', source: 'Demo',
    };
    if(example.id === 'referral') {
      Object.assign(contact,logInteraction(contact,{id:'demo-sent',direction:'sent',channel:'LinkedIn',date,body:contact.message}));
      Object.assign(contact,logInteraction(contact,{id:'demo-reply',direction:'received',channel:'LinkedIn',date,body:'Hi! Happy to help. Are you more interested in storage systems or developer infrastructure? Send me the role link and a short summary of your backend work.'}));
      contact.followUpDate=date;
    }
    return contact;
  });
}
