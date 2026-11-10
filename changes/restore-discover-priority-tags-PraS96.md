# Restore Discover priority tags

- Restore the existing saved assessment tag in shared job facts, covering Discover cards, role previews and application details. Keep custom fit-label precedence and omit unsaved verdicts.
- Existing scoped batch publication/MCP validation is unchanged; no backend writes or priority vocabulary changes.
- Demo coverage: verify the existing isolated fictional Discover fixtures render their saved labels; no new interaction or fixture needed.
- Validation: 19 focused render, assessment/MCP-contract and demo tests; catalog validation (158 roles); frontend typecheck; production static build.
- Limits: no live browser inspection, hosted publication or private-job retagging. Plain Consider remains unsupported as a priority.
