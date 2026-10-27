# Interview reporting

During an authorized conversation or source check, Muse saves relevant process facts with `record_application_milestone` and reflections with `save_artifact`. No separate save confirmation is needed. Ambiguous applications or exact times still need clarification. These instructions do not create an email monitor, scheduler or immediate Muse wake-up.

Website `recordApplicationMilestone` and MCP `applications.milestone` share the same SQL validation and ownership checks. Website source `user` is authenticated; agent source `user_reported` preserves the candidate statement; `email` requires message evidence. Reports never create approval, observed submission receipts or status changes. Unknown timestamps remain null.

For a correction or reschedule, read the timeline and provide `supersedesId` for the current event being replaced. One successor is allowed; stale competing replacements fail. History is append-only and labeled as replaced. The brief/current outcome derivation ignores replaced events. A correction to a timeline observation does not change an explicit application status or automatically rewrite a preparation plan; a mismatching plan is visibly stale and Muse must revise it through existing versioned preparation tools.

Interview notes reuse private versioned `notes` artifacts with `purpose: Interview debrief [applicationId] Interview note`, Markdown body and owned `links: [{applicationId}]`. List/read first, use a stable UUID for retries, and preserve versions and human edits. Existing debriefs remain readable. The UI has one notes field; it no longer requires a round form or embeds a Circle sharing workflow. Saving notes never shares them.

The brief and notes panel subscribe to the existing owner-scoped `workspace:cloud-ready` invalidation and focus/reconnect reconciliation; there is no interval polling. Account switches/unmounts and older overlapping reads cannot overwrite the current panel. Demo fixtures and interactions remain fictional, disposable and isolated.

Requires the migration plus normal main-branch gateway/MCP and frontend release before hosted availability. Local SQL/contract/demo tests do not prove live Muse execution, email delivery or hosted Realtime behavior.
