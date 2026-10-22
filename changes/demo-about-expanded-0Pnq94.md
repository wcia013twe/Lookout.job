# About Me demo readability

- Order background as contact/name, professional summary, professional links, work experience, education, projects, skills/languages, then work authorization notes.
- Expand background groups and individual experience/education/project entries automatically in demo mode; native disclosure controls still allow collapsing them.
- Rename shared authorization notes to work authorization notes, explain their use across profiles, and point to the existing country/sponsorship settings. Preserve the existing authorization field and save contract.
- Add clearly fictional authorization context to the resettable admin demo fixture. Demo editing continues through the existing memory-only profile interaction.
- Validation: npm run validate:data (76 roles); next-app typecheck; existing demo, demo-mode, profile-review, and profile-eligibility test files (4 passed); git diff --check; Impeccable detector (no findings).
- Limits: no browser visual inspection. The separate application identity/eligibility disclosure is unchanged. No backend or MCP service behavior changed.
