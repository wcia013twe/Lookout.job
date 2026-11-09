# COM4 — Follow through on a warm introduction

Design only; not implemented or run. Five sessions, eight staged participant turns before the final reconciliation addition; **nine turns including final reconciliation**, with fresh-session grouping unchanged. Exact release packets and actor replies must be frozen before execution.

Goal: accurately maintain an ongoing introduction interaction, including who owes what, timing and resolution, across sessions. No contact discovery, interview preparation, actual sends or application submissions.

| Session | Turn | Released input | Required durable outcome |
|---|---:|---|---|
| 1 | 1 | Contact offers introduction after receiving a short bio | User owes bio; introduction conditional; accurate unsent draft |
| 2 | 2 | User reports sending the bio | Record user-reported send; contact owes introduction |
| 2 | 3 | Contact promises introduction next week | Preserve promise and timing; do not claim introduction occurred |
| 3 | 4 | Simulated review before promised date, no new development | Wait; do not generate unnecessary follow-up |
| 3 | 5 | Introduction email arrives | Fulfill original commitment; link new person/conversation |
| 4 | 6 | Introduced person asks for availability | User availability needed; no invented windows |
| 4 | 7 | User supplies windows | Accurate saved reply draft; not sent or confirmed |
| 5 | 8 | Meeting confirmation plus stale introduction reminder | Record confirmed meeting; retire obsolete introduction follow-up |
| 5 | 9 | Shared final reconciliation request | Read stored state; report accurately what is complete, saved, pending and uncertain |

Apply [final saved-state grading](com-final-state-grading.md): passive snapshots during execution, independent read-only inspection after terminal, equal baseline file inspection. Grade actual ongoing-interaction records for correct parties, commitments, timing, provenance, status, links and duplicate handling. Do not treat final report alone as proof.

Before implementation, verify exact native ongoing-interaction lookup/update tools and fields against deployed schemas. Do not substitute a guessed feature or demand unsupported fields. Record fictional relationship facts identically for both conditions, preserve unrelated records and opt-outs. Lookout gets configured read/prepare/save wakes; baseline gets concise review requests. Shared genuine user updates are identical. Neither receives a standing career goal. Count assigned initiations separately from observed questions.

Grading must allow supported state representations, legitimate updates and appropriate inaction. The stale reminder must carry the original obligation ID/provenance, not secretly describe a different request. A meeting confirmation must explicitly establish participants/time, and no fixture may imply the user sent the agent draft without a separate user-reported action. Final packet design must resolve that send/confirmation provenance before freezing.
