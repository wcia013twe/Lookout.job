# Lightweight test harness

- Keep Node's built-in runner and cap default file concurrency at four to bound concurrent PGlite instances and worker load.
- Share the esbuild/React/VM setup across three component render suites, preserving fresh fixture contexts and every behavior assertion.
- Remove two overlapping Career Ops hash tests; the complete manifest integrity check remains in career-execution. Remove the tracker CSS source-spelling assertion; theme parsing and first-paint behavior remain covered.
- Remove duplicate database execution from documented baseline commands: npm test already includes test:db scenarios. Update focused OpenWiki verification guidance.
- Validation: npm test passed (1,022 passed, five skipped, zero failures); npm run validate:data passed (158 roles); git diff --check and changed helper syntax checks passed. Existing fictional demo and render behavior checks passed in the full suite; no product/demo fixtures or MCP actions changed.
- Limits: no production build or hosted checks needed for this test-only change. No speedup claim: other checkouts were running heavy suites concurrently. Initial sandboxed validation was interrupted following a loopback integration timeout and incomplete frontend dependency installation; final validation used locked dependencies and loopback access.
