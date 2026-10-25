# Repair release evidence

Local first stage: release signaling recognizes every exact, distinct issue marker from the fetched PR, validates each owned auto-fix issue separately, and keeps backend-changing PRs blocked. Unknown issue prose is never executed.

Validation: 8 bug-release tests passed; 158 role records validated; git diff --check passed. Regression coverage includes duplicate/malformed/unsafe markers, multiple issues, unauthorized/unlabelled issues, idempotent signaling and backend fail-closed behavior.

Backend evidence transport awaits explicit approval. No backend readiness changes, evidence publication, production writes or deployment in this stage. Full-suite/CI checks will run with the coherent final contract.

Approved second stage: backend readiness now requires a reviewed point-in-time operator-attestation record, exact pinned Git source hashes and function identities, unchanged current runtime source, fix/source/release ancestry and successful frontend release. Evidence identity joins releaseId; superseded/missing/pending/failed/mismatched records and migrations fail closed. Backend receipts leave issues open for retry; every issue marker is recognized. CI recomputes SHA-256/Git hashes and checks relative imports. Developer context 63 documents provenance and limitations. Publication follows actual deployment/readback in a separate evidence-only PR to avoid circular hashes.

Validation: 12 focused tests pass, including source hash/dependency failures, stale evidence IDs, wrong ancestry/project, incomplete bundles, failed/pending releases and multi-issue handling; full test suite and production build run before publication. No new credentials/scopes, production user data writes or synthetic bug submissions. Live authenticated Muse testing remains outstanding.
