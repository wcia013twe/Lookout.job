# Profile requires sign-in

- Hide My Profile from the profile dropdown until a non-anonymous account is signed in. Detached fictional demo keeps its profile link.
- Gate /profile/ before profile providers/editors mount; signed-out direct visits return to Discover after auth initialization. Signing out removes the editor immediately and redirects. Query-selected sections use the same gate.
- Updated current-state README and added production-export browser coverage for guests (including no editor flash), fictional signed-in sessions, sign-out, anonymous sessions, and detached demo isolation. Existing owned backend validation and scoped profile/MCP actions remain unchanged; this is a frontend navigation boundary.
- Validation: TypeScript typecheck, npm test (515 tests including database scenarios), data validation (147 roles), production static-export build, and all four browser access scenarios passed. Live Chrome verified the signed-out menu and direct profile redirect; localhost preview now runs from this checkout.
- Limits: sign-in/sign-out tests used fictional intercepted auth responses, not a real OAuth login. Static hosting still serves the route shell; private backend authorization remains server-enforced. No push or production deployment.
