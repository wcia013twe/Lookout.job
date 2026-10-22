# My Agent writing workspace

Left-aligned My Agent with writing settings on the left and scrollable employer-answer and outreach libraries on the right. Shared answers, profile answer selection and reusable application templates move into My Agent. Mobile stacks the panels. Illustrative guidance previews animate text with reduced-motion support; existing fictional demo content and reset behavior are reused.

Existing profile, answer and document services and MCP boundaries are unchanged. No AI generation or external submission is added.

Validation: `npm run validate:data` (147 roles), `npm run build`, `git diff --check`, mechanical design scan, and `scripts/check-profile-ui.mjs` passed. Reviewed desktop and mobile screenshots; profile drafts, switching, save/reload, relocated libraries, demo reset, no overflow and no cloud writes passed. Existing Next.js security advisory appeared during build; upgrade remains separate. No production deployment requested.

## Preview follow-up

Shared question bank is collapsed beneath Writing style, retaining shared-answer editing and profile selection. Outreach previews now show one of Recruiter, Existing connection, Alumni, Founder and Followup, with wrapping previous/next arrows. Employer preview shows a labeled fictional answer rather than repeating instructions. Text reveal reserves its full height and exposes complete text to assistive technology. Demo checks exercise all five slides, wraparound and the collapsed bank.

## Highlighted preview follow-up

Outreach carousel, arrows, subject, message and six-category key now share one subtle gradient box. Sandboxed iframe uses escaped template text, no scripts or network access, theme-aware colors and reduced-motion text reveal. Highlight toggle hides both the sentence marks and key. All six existing category labels/descriptions are preserved; unavailable timeline context is not invented. Demo checks inspect iframe marks and the toggle.

Verification: production build, data validation, design scan, and desktop/mobile profile checks passed. Inspected the dedicated iframe screenshot to verify colored text rendering (full-page browser captures can omit sandboxed iframe content). The full key remains visible in the expanded gradient panel. Existing Next.js dependency security advisory remains unresolved.
