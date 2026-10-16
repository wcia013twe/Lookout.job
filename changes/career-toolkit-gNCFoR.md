# Career Toolkit skill library

- Added native Career Toolkit navigation, category/search index and 37 deep-linked
  usage manuals with inputs, procedures, outputs, examples and runtime requirements.
- Reused 56 verbatim Career Ops source files at c78e14c with manifest hashes and MIT
  notice. Canonical manual catalog compiles into on-demand career-* agent guides.
- Existing read_guide authorization and read-only boundary apply; incremented developer
  context version. Copy requests can reference company/title from a saved application,
  never credentials, private resume links or account identifiers. No task auto-dispatch.
- Demo requests are explicitly fictional and prohibit real account/external actions;
  category/search/manual examples work without demo backend calls or account writes.
- Validation: npm test (316 passing, including database scenarios); validate:data
  (76 roles); frontend typecheck; static production build (37 exported manuals);
  source-hash/bundle reproducibility; browser checks for navigation, categories,
  search/empty/reset, editable examples and clipboard, reload persistence, all manual
  URLs, desktop dark/mobile light screenshots and no document overflow/page errors.
  Impeccable finish review: ship. Incumbent DESIGN.md/sidecar preserved.
- Limits: source reuse provides instructions, not installed scanning, PDF rendering,
  cron, model or messaging runtimes. Hosted guides require normal gateway release and
  live verification. No production deployment or external execution in this pass.

## Library organization follow-up

- Replaced the long default list with an eight-category overview, two skill previews
  per category and links to each full category. Shortened category labels; added
  consistent SVG category/skill icons and a mobile category selector.
- Removed upstream branding/source links from the interface and copied requests;
  retained pinned source attribution and the MIT license in the repository.
- Refreshed manual/guide versions and developer context for the copy changes.
- Validation: 319 tests passed; data validation, frontend typecheck and static
  build passed. Browser checks verified overview previews, search, category drill-in,
  mobile selector, clipboard/editing, all 37 manuals and absence of product/source
  references in visible UI and copied requests. Fixed and verified View all focus
  and scroll transfer; finish reviewer scored the finding resolved, ship.

### Executable toolkit follow-up

Imported 207 MIT upstream files at pinned commit c78e14c, including 108 network
providers, guarded HTTP/DNS helpers, document templates/fonts, HTML/PDF builders,
ATS/keyword/fact checks and analytics primitives. SHA-256 manifest and reproducible
import script preserve verbatim source. No parallel UI/tracker, local shell parsers,
installer/updater/model wrappers or scheduler added.

Seven narrow local MCP tools connect saved search targets, profile evidence and
application history to these executables. Hosted scoped context/results and private
PDF reservation/finalization/read tools share owned persistence; browser adapter
reads the same RLS results. Generated resumes register in the existing library,
without default selection, fact verification or approval. Leads are retained with
provider diagnostics and require official verification before existing batch
publication. Analytics preserves insufficient data, explicit submission evidence,
completed milestones, currency/source quality and partial-window coverage.

Guides now reference executable tools and require refreshed runner discovery.
Developer contract version advanced. Fictional runner demo data exercises sourced
analytics, scheduled-vs-completed interviews and failed-source history without real
accounts/writes. The existing copy-only admin demo remains isolated.

Validation: 334 Node/PGlite tests, data validation, frontend typecheck/static build.
Live public Greenhouse smoke read 655 listings, returned a bounded two-lead sample,
and verified one posting via the official ATS API. Actual headless Chromium generated
a 49,848-byte, one-page fictional resume; rendered PNG inspected for layout. A real cover-letter PDF also rendered (26,438 bytes, one page). No real
application submission. All 108 provider modules load; only Greenhouse was live-tested.
Backend migration/functions are not deployed by this feature; normal release and
local runner dependency/browser install + restart are required for connected Muse.
ATS is a heuristic HTML-source audit, not a binary PDF parser. Interrupted PDF
uploads may require inspection/fresh event key if rerendered bytes differ.
