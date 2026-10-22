# Interview debriefs and Circle forum drafts

The personal agent conducts the conversation in its existing chat, starting with
“How did it go?” and asking one relevant follow-up at a time. Basic website
controls let the person add or update the resulting summary themselves. New
debriefs append private notes; edits retain artifact revision history. They do
not change application status or assert an interview happened.

## Existing storage and MCP mapping

No database, Supabase function, schema, gateway instruction or tool changes are
required. The shared payload helpers are in `lib/interview-debrief.mjs`.

- Read: `list_artifacts` (`artifacts.list`, `workspace:read`) with `kind: notes`
  and `query: "Interview debrief [<applicationId>]"`; accept only an exact purpose
  prefix followed by a space. Then `read_artifact` for each body.
- Add/update: `save_artifact` (`artifacts.save`, `drafts:write`) with a UUID id,
  expectedVersion 0 for a new note or the current version for an edit, kind notes,
  format markdown, title `<company> · <round>`, purpose
  `Interview debrief [<applicationId>] <round>`, body containing the summary,
  company, sources [] and links []. Use the backend application UUID when available.
  ApplicationId in purpose is a retrieval convention, never an ownership boundary.
  Links stay empty because existing artifact links require real preparation tasks;
  do not invent tasks or identifiers. Other notes remain separate.
- Forum draft: `propose_circle_contribution` (`knowledge.propose`) with a chosen
  member Circle, expectedRevision 0, stable eventKey and type interview_report.
  Content is title, reviewed body, company, role, stage, sources [], provenance
  unknown and personalDisclosure true. Never copy internal IDs, full private
  history, recruiter messages or contact details. The website uses the same
  knowledge validation and membership checks. The user can edit the forum copy
  without changing their private debrief.
- Sharing: the existing Circle review/publish flow remains authoritative. Agent
  authorship does not grant approval; freeform reports need exact-revision human
  review. Saving a forum draft does not publish it. The draft link opens the
  existing forum thread; publication is a separate existing human action.

Agents should read current owned round context before the conversation, ask
about ambiguities, separate the user's impressions from employer feedback,
never invent missing details, and preserve existing summaries. Show the debrief
for review and save only within the user's instructions. Resolve stale versions
by reading and reconciling; do not overwrite silently. Do not claim a save,
sharing action, interview completion or agent activation from conversational assent.

## Verification limits

The UI refreshes debriefs on focus and every 30 seconds while visible. Unsaved
editor content stays local, and existing service ownership and version checks
remain in force. Demo notes and Circle drafts are fictional and resettable.
This pass does not start an agent, implement chat, synchronize email or deploy
backend capabilities. Hosted availability of the existing artifact/Circle tools
must be verified separately; a missing service shows an error rather than falling
back to local account writes.
