// Entirely fictional candidate experiences; not claims about Bloomberg's hiring process.
// Pre-authorized synthetic reports bypass the account loader. No global sharing is enabled.
const rows=[
 ['oa-recent','OA finished yesterday','OA','2026-10-25','I completed the online assessment yesterday. Mine had two timed coding tasks. One used a hash map and the other involved a sliding window. I could run sample tests. Has anyone heard back after submitting?'],
 ['oa-different','My OA format was different','OA','2026-10-24','My online assessment had three shorter coding tasks, not two. I applied to the London new grad position. I do not know whether location or scheduling explains the difference.'],
 ['oa-wait','Waiting after the OA','OA','2026-10-23','I submitted my online assessment eight days ago and have not received an update. The portal still says in review. Anyone else waiting after the assessment? Please compare dates here.'],
 ['technical','Live technical round experience','Technical interview','2026-10-24','I had my live technical interview for the New York new grad position. We solved a graph traversal problem, discussed complexity, and walked through a bug in my solution. This is only my experience, not an official question list.'],
 ['technical-alt','Technical round felt different','Technical interview','2026-10-25','My London new grad technical interview involved a string parsing problem and a discussion of a project on my resume. I did not get a graph problem. The interviewer asked me to explain tradeoffs.'],
 ['waiting-thread','Anyone waiting after the technical round?','After technical','2026-10-25','I finished my New York new grad technical round nine days ago. No decision yet. I am still actively interviewing. Anyone else in this stage? Share your interview date and any recruiter updates in this thread.'],
 ['waiting-reply','Reply: still waiting too','After technical','2026-10-26','Reply to the waiting-after-technical discussion: I interviewed six days ago and am still waiting. My recruiter has not given me a deadline. I will update the thread when I hear something.'],
 ['next-step','Update: invited to the next round','After technical','2026-10-24','I heard back three business days after my technical interview and was invited to another conversation. A friend is still waiting; my timing is not a promise for anyone else.'],
 ['recruiter','Recruiter screen experience','Recruiter screen','2026-10-22','My recruiter screen covered graduation date, work authorization and why I was interested in the company. There was no live coding in my call. I have not reached the technical interview yet.'],
 ['rumor','Unconfirmed rumor about headcount','After technical','2026-10-26','I saw someone elsewhere claim that new grad hiring was paused. I have no firsthand confirmation or recruiter message. Has anyone received an actual update? Please do not treat this as confirmed.'],
 ['old-wait','Anyone waiting after technical? Old cycle','After technical','2024-10-25','I finished my new grad technical interview nine days ago and am waiting for a decision. Anyone else currently in process? This discussion belongs to the 2024 recruiting cycle, not 2026.'],
 ['senior','Senior engineer technical round','Technical interview','2026-10-25','My senior software engineer interview covered distributed cache design, operational incidents and leading a migration. I have seven years of experience; this was not a new grad interview.'],
 ['intern','Internship assessment experience','OA','2026-10-25','My summer internship online assessment contained two timed coding tasks. I have not applied for a full-time new grad role.'],
 ['other-employer','New grad technical round at another employer','Technical interview','2026-10-25','My Cedar Systems new grad technical interview involved graph traversal and debugging. I am waiting after that round and would like to compare timelines.'],
 ['generic-guide','Generic interview preparation checklist','Preparation',null,'Practice arrays, trees, graphs, complexity explanations and behavioral stories before a software engineering interview. This is general advice, not a candidate account of any employer process.'],
];
export const bloombergCandidates=rows.map(([id,title,stage,date,insight])=>({identities:[],observation:{sourceType:'circle_post',sourceId:id,sourceRevision:1,contentKind:'observation',title,
 company:id==='other-employer'?'Cedar Systems':id==='generic-guide'?null:'Bloomberg',
 role:id==='senior'?'Senior Software Engineer':id==='intern'?'Software Engineer Intern':id==='generic-guide'?null:'New Grad Software Engineer',stage,experienceDate:date,insight,provenance:'unknown',uncertainty:'Fictional evaluation data. Individual report, not verified employer policy.',
 postReferences:id==='waiting-reply'?[{circleId:'fictional-bloomberg',postId:'waiting-thread',revision:1,label:'Reply belongs to the waiting-after-technical discussion'}]:[]}}));
// Labels are fixed before executing retrieval. Top three should contain useful evidence, not answers.
export const bloombergCases=[
 {id:'recent-intel',query:'What are Bloomberg New Grad candidates reporting about their technical interviews in October 2026?',relevant:['technical','technical-alt'],exclude:['senior','intern','other-employer','old-wait','generic-guide']},
 {id:'oa-experience',query:'I just received the Bloomberg New Grad OA. What have other candidates experienced?',relevant:['oa-recent','oa-different'],exclude:['intern','senior','generic-guide']},
 {id:'oa-wait',query:'Anyone else waiting for Bloomberg New Grad after submitting the online assessment?',relevant:['oa-wait'],exclude:['waiting-thread','waiting-reply','old-wait','intern']},
 {id:'technical-format',query:'What did the live technical round involve for Bloomberg New Grad candidates?',relevant:['technical','technical-alt'],exclude:['recruiter','senior','other-employer','generic-guide']},
 {id:'join-discussion',query:'Where can I join people still waiting after their Bloomberg New Grad technical round in October 2026?',relevant:['waiting-thread','waiting-reply'],exclude:['old-wait','oa-wait','other-employer']},
 {id:'next-step',query:'What happened after candidates completed the Bloomberg New Grad technical interview, and how long did they wait?',relevant:['waiting-thread','waiting-reply','next-step'],exclude:['old-wait','oa-wait','senior']},
 {id:'different-formats',query:'Are Bloomberg New Grad candidates reporting different online assessment formats?',relevant:['oa-recent','oa-different'],exclude:['intern','technical','generic-guide']},
 {id:'screen-stage',query:'What are candidates saying about the Bloomberg New Grad recruiter screen before the technical interview?',relevant:['recruiter'],exclude:['technical','technical-alt','senior']},
 {id:'rumor-evidence',query:'Has anyone actually confirmed Bloomberg New Grad hiring is paused?',relevant:['rumor'],exclude:[],note:'Finding the rumor is not confirmation; preserve its explicit lack of evidence.'},
 {id:'unknown-recruiting',query:'What is the exact Bloomberg New Grad offer acceptance deadline for the Tokyo office?',relevant:[],exclude:[],note:'No report in this dataset answers this question.'},
 {id:'unrelated',query:'How do I repair a leaking kitchen faucet?',relevant:[],exclude:[]},
];
