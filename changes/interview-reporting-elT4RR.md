# Interview reporting

- Muse directions automatically save relevant conversation/source updates; candidate reports remain distinct from email evidence and authenticated human writes. Developer version 81 and application-workspace guide version 6 expose the contract.
- Debriefs are simple private interview notes using existing versioned artifacts. Existing notes remain readable/editable; the round form and embedded Circle sharing flow are removed. Edits retain source/link metadata.
- Minimal append-only corrections link an update to the current event it replaces. Same-app ownership, exact retry and one-successor rules apply through shared website/MCP validation. The brief ignores replaced dates; history stays visible.
- Removed interview-note interval polling and connected notes/brief refresh to the existing owned change feed, focus and reconnect, with stale-response guards.
- Demo coverage includes a fictional reschedule, candidate note, new notes and edits; reset/isolation checks included.
- Validation: `npm test` passed all 812 tests, including the new SQL website/MCP scenario; `npm run validate:data` validated 158 roles; frontend typechecking and production static build passed. `node scripts/check-interview-reporting-ui.mjs` passed desktop/mobile note create/edit and reschedule/history/current-brief checks with private network traffic blocked. `git diff --check` passed. Existing interview-brief browser coverage was updated; that older screenshot script was not rerun.
- Limits: no production migration/function/frontend deployment or live Muse/email/hosted-Realtime verification in this pass. Muse reports only during an actual authorized conversation/run. Rescheduling does not silently rewrite a saved preparation plan.
