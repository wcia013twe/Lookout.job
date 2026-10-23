# Theme picker and marketplace

The existing appearance controls offer System, Light, and Dark. The selection is browser-local (`lookout.color-mode`); the existing appearance behavior is preserved.

Profile navigation → Browse Marketplace opens `/themes/`. The Better Canvas-inspired layout places a large fictional workspace preview beside a theme gallery. Dashboard and Circles select the preview surface; Saved shows favorites from this visit. Six bundled theme concepts reuse the same preview renderer for thumbnails and the stage. Save for this visit is in-memory only and resets when the page unmounts. These are preview concepts, not installed themes or community listings; there are no purchases, downloads, publishing, or account mutations.

Agent boundary: browser appearance and marketplace preview controls are human actions. Direct users to Profile → Browse Marketplace to compare and select a preview. `save_theme_preferences` continues to manage account pack preferences only; it cannot install marketplace concepts or change browser appearance. No remote appearance parity is advertised.

## Demo interactions

The same marketplace works in fictional admin demo mode and uses authored sample content in both modes, with no account data, private files, backend writes, or external submissions. Switch Dashboard/Circles, preview Botanical, save it, open Saved, remove it from Saved to exercise the empty state, and return with Browse all themes. Navigate away and back to reset marketplace state. The existing theme picker remains unchanged.

Verification should cover keyboard selection, narrow-screen stacking, Browse/Saved navigation, favorites removal, first-paint fallback, and synchronization between header/profile appearance controls.
