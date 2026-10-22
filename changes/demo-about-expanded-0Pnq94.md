# About Me demo readability

- Order background as contact/name, professional summary, professional links, work experience, education, projects, skills/languages, then work authorization notes.
- Show all filled background facts as readable labeled values in both demo and normal mode. Each section and individual experience/education/project entry uses a pencil button to expand its editor and a checkmark to return to reading. New entries open for editing. Hidden editors stay mounted so the existing save and review flow preserves every field.
- Rename shared authorization notes to work authorization notes, explain their use across profiles, and point to the existing country/sponsorship settings. Preserve the existing authorization field and save contract.
- Add clearly fictional authorization context to the resettable admin demo fixture. Demo editing continues through the existing memory-only profile interaction.
- Validation: npm run validate:data (76 roles); next-app typecheck; existing demo, demo-mode, profile-review, and profile-eligibility test files (4 passed); git diff --check; Impeccable detector (no findings).
- Follow-up validation: production static-export build; next-app typecheck; npm run validate:data (76 roles); existing demo, demo-mode, profile-review, and profile-eligibility tests (4 passed); Impeccable detector (no findings).
- Limits: no browser visual or click-through inspection. The separate application identity/eligibility disclosure is unchanged. No backend or MCP service behavior changed.
