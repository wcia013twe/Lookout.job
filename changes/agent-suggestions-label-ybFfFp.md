# Agent Suggestions label

- Renamed the Network suggestions heading and accessible section label to Agent Suggestions. Existing fictional demo uses this same component; updated its UI documentation.
- Validation: eight existing Network/demo checks, catalog validation (158 roles), frontend typecheck and production build passed; git diff --check passed.
- Limits: local UI copy only; no hosted publication.

- Follow-up: commented out the visible Agent Suggestions heading as requested; the suggestion cards and accessible section name remain.

- Follow-up: commented out the complete suggestions section, preserving saved records and people cards. Styled the LinkedIn link blue with its mark, and saved Gmail threads with an email icon box and Open Gmail label. Updated the fictional demo browser check for the hidden section.
- Follow-up checks: 25 focused Network/demo checks, typecheck, catalog validation (158 roles) passed. Full npm test had 1,030 passes, 5 skips and one reserved-demo-domain failure introduced by preview URLs; removed those URLs from shipped fixtures and reran the complete affected demo/Network tests successfully. The full suite was not repeated after that correction. Desktop/mobile browser checks cover hidden suggestions, branded links, drafts/history, process filtering, reset and no cloud access; screenshots inspected. Process organization was reviewed as advice only; no association model or automatic ranking was added.

- Application organization follow-up: added a tracked/imported Application filter, an unlinked-people option and linked company/role labels on cards. Reuses explicit application tags and canonical role links; filtering is read-only and does not infer involvement from employer names or rewrite contacts. Added detached demo checks for filtering, unlinked people, labels and URL state.
- Application-filter validation: npm test passed (1,039 passed, 5 skipped); 11 focused Network/demo tests passed; typecheck, production build (426 offline assets), validate:data (158 roles) and diff checks passed. Final detached desktop/mobile check passed application filtering, unlinked people, linked labels, URL state, original process deep links, draft/history preservation, demo reset and no cloud access. Reviewed both screen sizes. Fixed an optional-public-catalog runtime issue found by the UI check; final build/UI checks include that fix. No hosted deployment or real-contact association updates were performed.
