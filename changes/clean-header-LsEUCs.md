# Cleaner workspace header

- Flattened the boxed navigation into text links with weight/color for the active page, retaining every route, label and action count.
- Aligned brand, navigation and utilities on desktop; kept a compact second navigation row on phones and tablets. Moved the profile avatar to the right and anchored its existing menu inward.
- Preserved theme selection, XP/progress access, profile navigation, authentication, demo controls and last-scan date. Removed the decorative tab animation and desktop-hidden tagline.
- Validation: TypeScript, static production build, 76-role data validation, and 18 demo/progress tests passed. Browser checks cover 1280px desktop, 390px phone, 320px phone, light/dark themes, profile/Escape dismissal, demo action counts and Action board navigation. Header refinements reuse existing demo fixtures; no fixture changes are needed for presentation-only styling.
- Mechanical design scan: only the existing Inter font warning; retained the incumbent typeface for this scoped update.
- Limits: no live authenticated sign-in or external employer action was exercised; no backend/domain changes.
