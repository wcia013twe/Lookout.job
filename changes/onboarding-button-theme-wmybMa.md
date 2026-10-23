# Onboarding connection button theme

- Use the existing onboarding Button for Get connection setup and Copy connection setup. Both now inherit the approved pale-blue fill, dark text, 48px sizing, font weight, arrow and focus/disabled behavior used by the rest of onboarding.
- Preserve submit semantics, setup generation and clipboard behavior. No backend/service action changes; existing scoped connection tools remain the boundary.
- Demo already uses the same onboarding Button for Copy demo setup; this fix aligns real onboarding with that fictional preview without introducing account writes or new fixtures.
- Validation: TypeScript typecheck, data validation (147 roles) and Impeccable detector passed. Rendered the onboarding CSS at 390px and 1280px, confirmed colors, weight and no overflow, and inspected the mobile capture.
- Limits: visual check used a focused CSS render, not a live account connection; no credentials issued.
