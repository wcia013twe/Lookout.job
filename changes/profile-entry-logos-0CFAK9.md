# Connect profile organization logos

- Work and education entries use the canonical shared CompanyLogo component. Projects retain their project icon.
- Extracted the renderer from role-card with a compatibility re-export, keeping existing consumers on one implementation. Logo.dev/cached failures and absent or fictional names fall back to a briefcase across logo surfaces.
- Fixed fallback contrast in dark mode. Demo organization names explicitly carry the demo marker to avoid fictional lookups.
- Validation: typecheck and static production build passed; npm test passed 957 tests (5 skipped); catalog validation passed for 158 roles. Logo/demo unit checks passed; mocked browser checks passed work/school success, failure fallback, name-change recovery, project-icon preservation, demo reset and desktop/mobile overflow checks without account writes. Screenshots inspected. Mechanical design detector returned no findings.
- Live Logo.dev GET checks returned 200 image/png for NVIDIA and Stripe using the existing configured publishable token; no credentials exposed or modified.
- No backend/schema change, live account write, push or hosted deployment.
