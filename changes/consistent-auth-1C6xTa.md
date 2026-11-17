# Consistent sign-in

- Use the shared login screen for signed-out workspace and onboarding routes, and offer email/password account creation alongside Google.
- Keep demo authentication fictional and retain the existing human-only authentication boundary.
- Validation: full `npm test`, `npm run validate:data`, frontend typecheck and production build; browser demo recording covers login and signup.
- Limits: hosted signup confirmation, email delivery, redirect configuration, provider linking and real sign-in were not exercised. The OpenWiki note describes local source, not a deployed release.
