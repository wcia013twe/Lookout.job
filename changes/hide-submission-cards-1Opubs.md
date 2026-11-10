# Hide submission cards temporarily

- Hide Submission cards from the website Action Board, its fallback and displayed counts; preserve Need your input cards and application details/history.
- Use the same presentation filter in the detached demo. Existing fictional drafts remain saved and resettable; the demo regression verifies visible input requests and unchanged underlying records.
- Backend/MCP read_action_board and scoped decision tools are unchanged. No new service action or submission permission.
- Validation: 22 focused Action Board/disclosure/detached-demo tests, 158-role data validation, frontend typecheck, production static build and git diff --check passed.
- Limits: no browser visual inspection, hosted deployment, real account writes or change to Muse submission authority.
