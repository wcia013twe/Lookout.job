'use client';

import {useState, type ReactNode} from 'react';
import {control, primary, secondary} from '../../../components/ui';

const scenarios = [
  {id:'roundup', label:'Daily roundup', title:'A little momentum for your morning.', description:'Useful updates from your friends, connected to what you’re working on.', principle:'Your next step comes first', detail:'A short roundup connects shared experience to your own preparation. Nothing new? No message.'},
  {id:'share', label:'Share a tip', title:'Help a friend, without writing a post.', description:'Finish your task. Then turn a useful detail into something your Circle can use.', principle:'A suggestion, never an obligation', detail:'The agent asks once, shows the exact words and destination, and respects “not now.”'},
  {id:'celebrate', label:'Celebrate', title:'Good news deserves good company.', description:'Share a meaningful moment with the people who have been rooting for you.', principle:'Progress without comparison', detail:'No points, streaks or rankings. Personal milestones stay private until you approve sharing.'},
  {id:'impact', label:'Your impact', title:'The thing you shared helped someone.', description:'Small contributions can make someone else’s next step easier.', principle:'Real usefulness, honestly described', detail:'A saved resource, a reported benefit and an agent citation are different signals. They should stay different.'},
] as const;
type Scenario = typeof scenarios[number]['id'];
type Message = {speaker:'You'|'Lookout'; content:ReactNode};
type Phase = 'start'|'preview'|'editing'|'shared'|'declined'|'applied'|'continued'|'details';

function MessageBubble({speaker, children}:{speaker:Message['speaker']; children:ReactNode}) {
  return <div className={speaker==='You'?'ml-auto max-w-[90%] sm:max-w-[82%]':'max-w-[96%] sm:max-w-[92%]'}>
    <p className={`mb-2 text-xs font-semibold ${speaker==='You'?'text-right text-board-muted':'text-board-text'}`}>{speaker}</p>
    <div className={`rounded-2xl px-4 py-3 text-sm leading-7 sm:px-5 ${speaker==='You'?'bg-board-tag text-board-text':'bg-board-bg text-board-text'}`}>{children}</div>
  </div>;
}

function Roundup() {
  return <div>
    <p>Morning, Wes. A few things from KnightHacks worth bringing into your day.</p>
    <ul className="my-4 space-y-4">
      <li><strong>Maya shared a Databricks interview tip.</strong> Graph traversal came up in her round. Your interview is next week, so practicing an explanation aloud could help. It’s one person’s experience, not a prediction.</li>
      <li><strong>Jordan made it to a final round.</strong> A good moment to cheer them on.</li>
      <li><strong>Sam shared a SQL practice guide.</strong> It walks through reading query plans, a topic in your prep plan.</li>
    </ul>
    <p>Want me to add a graph practice session to your plan?</p>
  </div>;
}

function initialMessages(scenario:Scenario):Message[] {
  if(scenario==='roundup')return [{speaker:'Lookout',content:<Roundup/>}];
  if(scenario==='share')return [
    {speaker:'You',content:'I finished my Databricks interview. They asked graph questions.'},
    {speaker:'Lookout',content:<><p>I’ve marked your technical round complete and saved “graph questions” in your private notes.</p><p className="mt-3">That could help friends preparing for Databricks. Want me to draft a quick tip for KnightHacks?</p></>},
  ];
  if(scenario==='celebrate')return [
    {speaker:'You',content:'I got the offer from Figma!'},
    {speaker:'Lookout',content:<><p>That’s a big moment, Wes. I’ve recorded your offer in your private application timeline.</p><p className="mt-3">Want to share the good news with KnightHacks? I’ll leave compensation and your offer letter out.</p></>},
  ];
  return [{speaker:'Lookout',content:<><p>The query-plan guide you shared was saved by two people in KnightHacks.</p><p className="mt-3">Maya also chose to tell you: “This helped me explain index scans in my interview.”</p><p className="mt-3">Want to see the resource you shared?</p></>}];
}

const tipDraft = 'I finished a Databricks technical interview and graph questions came up. Practicing graph traversal and explaining your approach aloud may help. This was my experience; other rounds may be different.';
const celebrationDraft = 'I received an offer from Figma! Thanks for the encouragement along the way.';

export default function CircleExperience() {
  const [scenario,setScenario] = useState<Scenario>('roundup');
  const [phase,setPhase] = useState<Phase>('start');
  const [draft,setDraft] = useState(tipDraft);
  const selected=scenarios.find(item=>item.id===scenario)!;
  const personal=scenario==='share'||scenario==='celebrate';

  function choose(next:Scenario) {
    setScenario(next);
    setPhase('start');
    setDraft(next==='celebrate'?celebrationDraft:tipDraft);
  }

  function response():Message|null {
    if(phase==='shared')return {speaker:'Lookout',content:<><strong>Shared in this preview.</strong><p className="mt-2">Only the words you reviewed went to the fictional KnightHacks Circle. Your private notes stay private.</p><p className="mt-2">Ready to get back to your next step?</p></>};
    if(phase==='declined')return {speaker:'Lookout',content:personal?'Of course. I’ll keep this private and won’t ask again about this update. Let’s get back to your search.':'Got it. Your prep plan stays as it is. You can ask about these updates whenever you like.'};
    if(phase==='applied')return {speaker:'Lookout',content:<><strong>Added in this preview:</strong> a 20-minute graph traversal practice session. Start by explaining breadth-first and depth-first search aloud. Maya’s shared experience is a suggestion for practice, not a forecast of your interview.</>};
    if(phase==='continued')return {speaker:'Lookout',content:scenario==='celebrate'?'Back to your offer: we can prepare questions about the role, team and decision timeline.':'Back to your preparation: let’s work through a graph traversal problem and practice explaining your decisions.'};
    if(phase==='details')return {speaker:'Lookout',content:<><strong>Reading a query plan</strong><p className="mt-2">Your fictional shared resource explains index scans, sequential scans and when each is useful.</p><p className="mt-2 text-board-muted">Illustrative impact: two saves and one voluntarily shared comment. Agent citation counts alone would not support these claims.</p></>};
    return null;
  }

  const followup=response();

  return <section aria-labelledby="circle-experience-title" className="border-b border-board-line pb-10">
    <div className="mb-7 flex flex-wrap items-end justify-between gap-5">
      <div className="max-w-2xl">
        <h2 id="circle-experience-title" className="text-2xl font-semibold leading-tight tracking-tight">Your Circle, in the conversation.</h2>
        <p className="mt-3 max-w-prose text-sm leading-7 text-board-muted">Friends’ good news. A tip before your interview. A little help when you need it. Your agent brings the useful parts to you.</p>
      </div>
      <p className="text-xs leading-5 text-board-muted">Interactive concept · fictional people and activity</p>
    </div>

    <div className="mb-7 flex flex-wrap gap-2" role="group" aria-label="Choose a conversation scenario">
      {scenarios.map(item=><button key={item.id} type="button" aria-pressed={scenario===item.id} onClick={()=>choose(item.id)} className={scenario===item.id?primary:secondary}>{item.label}</button>)}
    </div>

    <div className="grid min-w-0 gap-7">
      <div className="min-w-0 rounded-2xl border border-board-line bg-board-panel">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-board-line px-5 py-4 sm:px-6">
          <p className="text-sm font-semibold">A conversation with Lookout</p>
          <span className="text-xs text-board-muted">Preview · no messages sent</span>
        </div>
        <div className="space-y-5 px-4 py-6 sm:px-6">
          {initialMessages(scenario).map((message,index)=><MessageBubble key={`${scenario}-${index}`} speaker={message.speaker}>{message.content}</MessageBubble>)}

          {personal&&phase!=='start'&&phase!=='declined'&&<MessageBubble speaker="You">Share this with my Circle.</MessageBubble>}

          {(phase==='preview'||phase==='editing')&&<div className="rounded-xl border border-board-line p-4 sm:p-5">
            <h3 className="text-sm font-semibold">Review before sharing</h3>
            <p className="mt-1 text-xs leading-6 text-board-muted">Destination: KnightHacks · Circle members only</p>
            {phase==='editing'?<form className="mt-4" onSubmit={event=>{event.preventDefault();setDraft(draft.trim());setPhase('preview');}}>
              <label className="block text-sm" htmlFor="circle-preview-draft">Your message</label>
              <textarea id="circle-preview-draft" className={`${control} mt-2 min-h-40 leading-7`} value={draft} onChange={event=>setDraft(event.target.value)} required maxLength={2000}/>
              <div className="mt-3 flex flex-wrap gap-2"><button className={primary} type="submit" disabled={!draft.trim()}>Review edited message</button><button className={secondary} type="button" onClick={()=>setPhase('declined')}>Keep private</button></div>
            </form>:<><p className="mt-4 whitespace-pre-wrap break-words text-sm leading-7">{draft}</p><p className="mt-4 text-xs leading-6 text-board-muted">Only this text. No notes, transcript or files attached. Check anything you added before sharing.</p><div className="mt-4 flex flex-wrap gap-2"><button className={primary} type="button" onClick={()=>setPhase('shared')}>Share in preview</button><button className={secondary} type="button" onClick={()=>setPhase('editing')}>Edit message</button><button className={secondary} type="button" onClick={()=>setPhase('declined')}>Keep private</button></div></>}
          </div>}

          <div role="status" aria-live="polite" aria-atomic="true">{followup&&<MessageBubble speaker={followup.speaker}>{followup.content}</MessageBubble>}</div>

          {phase==='start'&&<div className="flex flex-wrap gap-2 pt-1">
            {scenario==='roundup'?<><button type="button" className={primary} onClick={()=>setPhase('applied')}>Add graph practice in preview</button><button type="button" className={secondary} onClick={()=>setPhase('declined')}>Leave my plan as is</button></>:personal?<><button type="button" className={primary} onClick={()=>setPhase('preview')}>{scenario==='share'?'Draft a tip':'Preview the good news'}</button><button type="button" className={secondary} onClick={()=>setPhase('declined')}>Not now</button></>:<><button type="button" className={primary} onClick={()=>setPhase('details')}>View shared resource</button><button type="button" className={secondary} onClick={()=>setPhase('continued')}>Back to my preparation</button></>}
          </div>}
          {phase==='shared'&&<button type="button" className={secondary} onClick={()=>setPhase('continued')}>{scenario==='celebrate'?'Back to my offer':'Back to my preparation'}</button>}
          {phase!=='start'&&phase!=='preview'&&phase!=='editing'&&<button type="button" className="block min-h-11 text-sm text-board-muted underline underline-offset-4 hover:text-board-text" onClick={()=>choose(scenario)}>Restart this example</button>}
        </div>
      </div>

      <aside className="min-w-0" aria-label="Why this interaction works">
        <h3 className="text-xl font-semibold leading-snug tracking-tight">{selected.title}</h3>
        <p className="mt-3 text-sm leading-7 text-board-muted">{selected.description}</p>
        <div className="mt-6 border-t border-board-line pt-5"><h4 className="text-sm font-semibold">{selected.principle}</h4><p className="mt-2 text-sm leading-7 text-board-muted">{selected.detail}</p></div>
        <p className="mt-6 text-xs leading-6 text-board-muted">Explore freely. These examples don’t update applications, publish to a Circle, change preparation plans or connect a delivery channel.</p>
      </aside>
    </div>
  </section>;
}
