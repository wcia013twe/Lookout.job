# Remove the bottom company tier-list editor

- Removed the duplicate Company tier lists board below Application automation in both real and demo settings. Preserved the company-list selector, saved rankings and Card packs ranking editor.
- No backend or MCP contract changed: existing scoped tier-list tools and shared validation remain unchanged.
- Validation: npm run validate:data (147 roles); frontend typecheck. Static inspection confirms the shared real/demo automation view no longer renders TierLists, while Card packs retains it.
- Limits: no browser visual run or authenticated write; presentation-only removal.
