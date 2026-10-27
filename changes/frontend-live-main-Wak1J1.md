# Follow local main in a stable frontend preview

- Add `make live`: an SSD-owned clean preview follows committed shared main every second, so feature landing updates the serving checkout and triggers Next.js hot reload. Task checkouts remain untouched.
- Dependency fingerprints trigger locked reinstall/restart. Dirty or divergent preview history stops sync safely; a run lock prevents concurrent ownership. Local services are reused, not restarted.
- Permit both loopback dev origins and support PORT in the local frontend launcher. Document task-preview versus main-preview behavior.
- Validation: 12 live-main/feature-delivery tests and catalog validation passed. Frontend typecheck and static production build passed. An isolated source/preview fixture and an already-open Chromium demo page verified commit → preview sync → visible React hot refresh, retaining a window marker without any reload call.
- No product/backend capability, MCP tool, database schema or demo behavior changed; demo is used only as isolated UI evidence. No production publication.
