# My Agent writing workspace

Left-aligned My Agent with writing settings on the left and scrollable employer-answer and outreach libraries on the right. Shared answers, profile answer selection and reusable application templates move into My Agent. Mobile stacks the panels. Illustrative guidance previews animate text with reduced-motion support; existing fictional demo content and reset behavior are reused.

Existing profile, answer and document services and MCP boundaries are unchanged. No AI generation or external submission is added.

Validation: `npm run validate:data` (147 roles), `npm run build`, `git diff --check`, mechanical design scan, and `scripts/check-profile-ui.mjs` passed. Reviewed desktop and mobile screenshots; profile drafts, switching, save/reload, relocated libraries, demo reset, no overflow and no cloud writes passed. Existing Next.js security advisory appeared during build; upgrade remains separate. No production deployment requested.
