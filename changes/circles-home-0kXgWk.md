# Circles homepage

Circles now opens a simple directory instead of automatically entering the first circle. Open a circle, manage its existing settings, or create/join a private circle from home. Back navigation returns to the directory; explicit circle/thread links still open their destination. The fictional preview uses the same directory and isolated create/join operations.

Service mapping: existing circles.list, circles.create, circles.join and settings operations remain unchanged for website and MCP. This adds navigation only.

Validation: frontend typecheck and static production build passed; 34 focused Circle, invite, conversation, and demo tests passed; data validation passed (76 roles); mechanical design detector returned no findings. Independent code review confirmed the browser-history state fix. Preview instructions now cover the homepage and reset. Visual/browser inspection was unavailable because the sandbox denied local HTTP binding. Initial npm install failed under restricted network/cache access; an approved dependency install succeeded.
