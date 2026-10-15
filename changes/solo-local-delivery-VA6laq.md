# solo-local-delivery

- Made isolated feature work land in the shared local `main` checkout by default through `npm run feature:land`; routine delivery no longer creates or merges a GitHub PR.
- Updated feature setup to clone committed local `main`, preserve the real remote for optional publication, and require only Node.js, npm and Git for local work.
- Kept `feature:publish` and the merge queue as explicit options for GitHub review, protected CI or production publication.
- Validation: `node --test tests/feature-delivery.test.mjs` (10/10); `npm run validate:data`; `git diff --check`; `npm test` (285/286, with only the existing Windows CRLF comparison in `platform-outreach.test.mjs` failing).
- Limits: the unrelated platform-outreach line-ending assertion was not changed. No GitHub PR, remote push or production deployment was requested or performed.
