# Preference match display

- Replaced the four displayed scores with one circular preference match in Discover, onboarding examples and application views. The percentage comes from the saved agent assessment; records without an overall score show it as unavailable.
- Simplified search and application agent guidance and the existing `publish_batch` contract to accept one score and timestamp. Historical assessments remain readable without calculating or backfilling a score. The same validation applies to MCP and database writes.
- Updated resettable demo data and rendering, MCP and database coverage. Catalog validation and frontend typecheck passed; the full test suite was rerun. A demo card recording verified the visible change; the preview interaction timed out.
- Production build compiled and generated pages but was blocked by the installed Next.js security version check. The migration and gateway changes require the normal production release; they have not been deployed.

- Apply Now pack animations now expire 24 hours after the latest recommendation arrives, including while waiting for the activation cooldown. Jobs remain available; records without a timestamp do not animate. The detached demo exercises fresh and expired packs.
- Verified the expiry boundary, demo reset, typecheck, data validation and browser interaction; a fresh recording shows the unobstructed preference match.
