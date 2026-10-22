# Remove profile interview page

- Remove profile-interview from the website catalog and static route generation, including related links and the sidebar promotion. Applies equally to normal and fictional admin demo modes.
- Background editing remains available on My Profile. The existing backend agent guide is unchanged; no service or MCP contract changed.
- Confirmed the static export contains no profile-interview page or links.
- Validation: production static-export build (includes typecheck); npm run validate:data (76 roles); Career Toolkit tests (5 passed, outside the sandbox because its subprocess was blocked); git diff --check; Impeccable detector (no findings).
- Verification limits: no browser click-through inspection.
