# My Agent writing workspace

Left-aligned My Agent with writing settings on the left and scrollable employer-answer and outreach libraries on the right. Shared answers, profile answer selection and reusable application templates move into My Agent. Mobile stacks the panels. Illustrative guidance previews animate text with reduced-motion support; existing fictional demo content and reset behavior are reused.

Existing profile, answer and document services and MCP boundaries are unchanged. No AI generation or external submission is added.

Validation: `npm run validate:data` (147 roles), `npm run build`, `git diff --check`, mechanical design scan, and `scripts/check-profile-ui.mjs` passed. Reviewed desktop and mobile screenshots; profile drafts, switching, save/reload, relocated libraries, demo reset, no overflow and no cloud writes passed. Existing Next.js security advisory appeared during build; upgrade remains separate. No production deployment requested.

## Preview follow-up

Shared question bank is collapsed beneath Writing style, retaining shared-answer editing and profile selection. Outreach previews now show one of Recruiter, Existing connection, Alumni, Founder and Followup, with wrapping previous/next arrows. Employer preview shows a labeled fictional answer rather than repeating instructions. Text reveal reserves its full height and exposes complete text to assistive technology. Demo checks exercise all five slides, wraparound and the collapsed bank.

## Highlighted preview follow-up

Outreach carousel, arrows, subject, message and six-category key now share one subtle gradient box. Sandboxed iframe uses escaped template text, no scripts or network access, theme-aware colors and reduced-motion text reveal. Highlight toggle hides both the sentence marks and key. All six existing category labels/descriptions are preserved; unavailable timeline context is not invented. Demo checks inspect iframe marks and the toggle.

Verification: production build, data validation, design scan, and desktop/mobile profile checks passed. Inspected the dedicated iframe screenshot to verify colored text rendering. The full key remains visible in the expanded gradient panel. Existing Next.js dependency security advisory remains unresolved.

Iframe text stays visible by default and uses progressive emphasis rather than initially transparent characters, avoiding a blank preview when the browser defers iframe animation. The demo check asserts readable text throughout.

## Unified writing workspace

Implemented the approved prototype: one shared panel with Employer answers / Outreach tabs, directly editable tone/length/guidance, the matching preview, and one profile-save footer. The save action remains the versioned application-profile save and clearly includes other pending profile changes; the duplicate My Agent footer is removed. Keyboard tabs support arrows/Home/End, and changing channels preserves drafts. Outreach template selection and arrows share a toolbar; highlight labels reveal descriptions inline. Sandboxed script-disabled iframe is measured by its parent to fit the message and remove the large empty gap. Shared question bank remains collapsed below. Demo fixtures are reused and representative interactions updated. Existing profile, answer and document MCP boundaries are unchanged; no AI generation or backend service is added.

Validation: `npm run validate:data` (147 roles), production build, `git diff --check`, design scan and updated profile UI check passed. Reviewed employer/outreach desktop captures and mobile-light capture against the approved prototype. Verified direct editing, draft preservation, keyboard tab navigation, save/reload, profile switching, all five templates, highlight toggle/key, demo reset and no overflow or cloud writes. Existing Next.js security advisory remains; upgrade is separate.

## Remove secondary My Agent controls

Removed the reusable Templates library and Account-wide submission resume control from My Agent as requested. Existing stored documents/defaults and backend/MCP contracts are unchanged. Shared question bank and outreach preview templates remain. Demo coverage asserts both controls are absent. Validation: data validation (147 roles), production build, `git diff --check`, and desktop/mobile profile UI checks passed, including the writing workspace, shared question bank, profile save/reload and reset with no cloud writes. Existing Next.js dependency advisory remains.
