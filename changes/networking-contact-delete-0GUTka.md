# Networking contact deletion

- Expose Delete contact beside Edit person, replacing the buried History removal button. Inline confirmation names the person and explains removal of saved messages/history; Cancel preserves the contact. Locked/loading workspace states disable deletion.
- Reuse the existing outreach deletion queue and owner/revision-checked writer; MCP parity remains the existing scoped `delete_contact` operation. No backend or schema changes.
- Existing fictional people provide representative demo coverage. Browser checks at 1440px and 390px verified opening the confirmation, cancelling and confirming deletion; screenshots inspected. Demo state remains detached and resettable.
- Validation: 14 focused network/people/demo tests passed; catalog validation (158 roles), frontend typecheck, production build and git diff checks passed.
- Limits: no real account deletion, hosted sync or production deployment tested. Full test suite not run for this presentation-only change.
