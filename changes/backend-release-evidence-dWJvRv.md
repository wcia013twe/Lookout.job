# Repair release evidence

Local first stage: release signaling recognizes every exact, distinct issue marker from the fetched PR, validates each owned auto-fix issue separately, and keeps backend-changing PRs blocked. Unknown issue prose is never executed.

Validation: 8 bug-release tests passed; 158 role records validated; git diff --check passed. Regression coverage includes duplicate/malformed/unsafe markers, multiple issues, unauthorized/unlabelled issues, idempotent signaling and backend fail-closed behavior.

Backend evidence transport awaits explicit approval. No backend readiness changes, evidence publication, production writes or deployment in this stage. Full-suite/CI checks will run with the coherent final contract.
