# Parallel-session publication — 2026-10-14

- Extend the isolated checkout and handoff workflow merged in PR #25. Fetch and merge current main before publishing; unresolved conflicts stop before any push or PR mutation.
- Generate a unique change-note file per new feature checkout, reject unfinished templates at publication and use that file for follow-ups. Keep CHANGELOG.md as a historical archive to avoid repeated parallel insertion conflicts.
- Keep the existing integration document as the workflow reference. Required GitHub CI and branch protections remain in place; this change does not provide immediate merges or replace the existing queue.
- Validation: publisher regression tests, full suite including database scenarios, catalog validation and git diff --check.
- Limits: exact overlapping code edits still require conflict resolution; existing branches without generated notes remain supported. The publication conflict path is tested locally, while GitHub integration runs on this follow-up PR.
