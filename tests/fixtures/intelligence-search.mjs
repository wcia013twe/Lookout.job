// Fictional, isolated search-quality examples; never loaded by product entrypoints.
const topics=[
 ['database','Database interview','The backend technical interview covered SQL joins, composite indexes, query plans and transaction isolation. Practice explaining why an index speeds up a selective query.'],
 ['coding','Online coding assessment','The timed online assessment had two algorithm problems involving arrays, hash maps and sliding windows. Practice solving coding challenges under a time limit.'],
 ['networking','Finding a referral','An alumni conversation led to an employee referral. Ask about the team first and follow up with a concise note explaining your relevant experience.'],
 ['systems','Distributed systems interview','The system design round discussed replicated services, consistency versus availability, cache invalidation and handling traffic spikes. Explain failure recovery and architectural tradeoffs.'],
 ['behavioral','Behavioral interview','Prepare stories about resolving conflict with a teammate, taking ownership of a mistake and handling ambiguous requirements. Describe your actions and the outcome.'],
 ['offer','Offer negotiation','After receiving a written offer, discuss base salary, equity and signing bonus with the recruiter. Compare the complete compensation package and ask about the decision deadline.'],
];
export const searchCandidates=topics.map(([id,title,insight])=>({identities:[],observation:{sourceType:'circle_post',sourceId:`search-${id}`,sourceRevision:1,contentKind:'observation',title,company:null,role:null,stage:null,insight,experienceDate:null,provenance:'unknown',uncertainty:null}}));
export const searchCases=[
 {query:'What database topics should I prepare for?',expected:'search-database'},
 {query:'How can I make relational data lookups faster?',expected:'search-database'},
 {query:'What should I practice for a timed programming test?',expected:'search-coding'},
 {query:'How do I get someone at the company to recommend me?',expected:'search-networking'},
 {query:'How should a service behave when machines fail or demand surges?',expected:'search-systems'},
 {query:'How do I explain a disagreement with a coworker in an interview?',expected:'search-behavioral'},
 {query:'Can I ask the recruiter for more money after getting an offer?',expected:'search-offer'},
 {query:'How long should I bake sourdough bread?',expected:null},
 {query:'What is the weather in Tokyo tomorrow?',expected:null},
];
