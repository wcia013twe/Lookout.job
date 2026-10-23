# Marketplace within Appearance

- Embedded the existing theme Marketplace below the color mode and pack texture controls in Appearance. Removed its standalone profile-menu shortcut.
- Reused the same theme browser with a settings-section heading and a stacked layout suited to the settings column. Direct /themes links remain valid. Theme concepts stay preview-only; favorites last only for the current visit.
- Demo coverage: added a focused detached-demo browser check for section order, removed menu shortcut, saved themes, Dashboard/Circles previews, dark desktop/light mobile, overflow and no account writes.
- Validation: TypeScript typecheck, data validation (147 roles), Impeccable detector (no findings), desktop/mobile browser checks and screenshot inspection passed.
- Limits: no real account writes or theme application; the existing preview-only behavior is unchanged. No new backend action or MCP tool boundary is introduced.
