# Profile dropdown cleanup

- Removed Appearance from the profile dropdown. Browse Marketplace was already removed in local main; both now live through My Profile → Appearance.
- Extended the detached-demo Appearance browser check to assert neither shortcut appears in the menu. No service/backend action changes.
- Identified the stale Chrome UI: port 3000 was running from the older onboarding-lookout-MdMA5g feature checkout. Preserve that clean checkout and restart the local preview using this updated checkout.
- Validation: TypeScript typecheck and data validation passed. Live Chrome verified both menu shortcuts absent after restarting port 3000 from this checkout; screenshot saved to /private/tmp/lookout-menu-cleanup.png. Detached-demo assertions were extended but not rerun in this pass.
- Limits: no push, publication or production deployment.
