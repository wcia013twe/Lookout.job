# Calmer referrals empty state

- Give first-time outreach a centered, readable form and one primary request action. Manual entry stays available as a quiet text action with an explicit cancel state.
- Hide empty conversation filters and their explanatory copy until contacts exist. Collapse templates behind a smaller disclosure; remove the idle saved-state notice and duplicate sending guidance.
- Extend the existing fictional browser fixture to capture empty desktop/mobile states and assert hidden filters and no overflow. Existing demo conversation, reset and no-backend-write checks remain covered.
- MCP mapping is unchanged: existing outreach request/contact tools and validation remain the same; this pass changes presentation only.
- Validation: 502 tests pass; typecheck; validate:data (147 roles); production build; browser outreach workflow, demo isolation/reset and desktop/mobile checks; git diff --check.
- Limits: browser cloud responses are intercepted fictional fixtures, not production service verification. The first production build stopped on an existing Next.js security advisory; retry passed without dependency changes.
