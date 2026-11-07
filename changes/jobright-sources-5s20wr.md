# Jobright public source lists

Added the official Jobright software engineering new-grad and internship lists to browser/MCP/SQL defaults and the existing direct worker provider registry. Read all rows, preserve inherited companies, title-filter before public detail requests, require identity-matched explicit public employer URLs, and use the existing employer verification, temporary staging, screening and final deduplication. All unresolved links remain diagnostic; coverage is always partial.

Validation: full `npm test`: 1,027 passed, 5 skipped, 0 failures. Runtime TypeScript check, generated search-document bundle check and `validate:data` (158 roles) passed. Jobright fixtures cover list parsing, identity/URL rejection, full-list concurrency, existing verification batches, real copied prior-history dedup and isolated demo coverage. Browser/MCP/SQL defaults match. Local API health passed; both running Docker containers use the Jobright image and recognize both source addresses.

Local rollout: migration applied and recorded locally; account read-back confirms both sources enabled through built-in defaults with personalVersion unchanged. Existing run retains its pinned sources; future runs include both additions. The same staging volume was retained during runtime replacement.

Live limit: Docker read 829 new-grad rows and 100 internship rows on 2026-11-07. Three sampled detail pages from each omitted employer apply URLs; all six remained unresolved and produced zero saved jobs. Earlier public inspection found the same omission on ten new-grad pages. No authenticated/paid API integration, hosted deployment or claim of exhaustive Jobright coverage. See `jobright-sources-5s20wr-proof.json`.

Checkout: `/private/tmp/lookout-features/jobright-sources-5s20wr/repo`; branch `codex/jobright-sources-5s20wr`. Routine local landing only; nothing pushed. Unrelated shared-main edits are preserved.
