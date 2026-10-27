# Clarify first-match evidence contract (#56)

- Correct shared first_match guidance from availability to available:true and document exact job ID ownership, canonical HTTPS URL, 24-hour freshness, one-minute future tolerance, and trimmed evidence/fit lengths in shared instructions, MCP tool discovery and the backend contract. Developer version advances from 59 to 60.
- Keep database validation, authentication, ownership, revision and replay behavior unchanged. Add fictional database regressions for job-only and malformed evidence, future timestamps and cross-owner rejection; full valid evidence still advances onboarding.
- Validation: focused onboarding tests (8) and focused database scenario passed; npm test passed; npm run validate:data passed (158 roles); JavaScript/JSON syntax and git diff --check passed. Initial test setup lacked frontend dependencies; rerun used existing environment dependencies. Demo isolation remains covered by the existing onboarding test.
- Limits: no live Muse reproduction payload was supplied, so no valid-payload rejection was reproduced. No production data, deployment or synthetic live report. Backend gateway/MCP release remains separately authorized; Pages alone cannot publish this contract. No frontend implementation changed, so no production frontend build was run.

- Integration: includes reviewed PR60/61 changes; developerVersion advanced to 61 so the first-match guidance cannot reuse the CSV discovery version.
