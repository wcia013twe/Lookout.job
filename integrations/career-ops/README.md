# Career Ops manuals in Lookout

Career Toolkit is a native, read-only skill library. It adapts instructional content
from [Career Ops](https://github.com/career-ops-hq/career-ops) at commit
`c78e14cdfd52f18a92e4a67694efab7ddef59385` (VERSION 1.36.0), under the
included MIT license. `upstream/` contains the verbatim selected source files;
`manifest.json` records their hashes. Keep the source attribution and license.

`catalog.json` is the canonical user-facing catalog: eight categories, 37 manuals,
inputs, procedure, outputs, requirements, examples and pinned source links. It is
public instructional content and must never contain account data. Manuals preserve
the upstream workflow intent and explicitly adapt local-filesystem assumptions to
Lookout's existing profile, application, preparation and outreach tools. Profile
interviews keep the useful one-question-at-a-time approach, but unsupported metrics
remain unknown. Regional manuals include localized market references. Scheduling
manuals explain runtime prerequisites rather than enabling a cron job.

Run `node scripts/build-career-toolkit.mjs` after changing the catalog. It verifies
source hashes and compiles the deployed guide bundle at
`supabase/functions/agent-gateway/skills/career-toolkit.json`.
`node scripts/build-career-toolkit.mjs --check` detects drift; tests exercise it.
The website imports only the catalog, not the large upstream instructions.
`read_guide` returns one full adapted guide on demand under existing workspace
read authorization. The developer index includes guide metadata, not full content.

No upstream executable scripts, package dependencies, web UI, tracker, plugin
installer, scheduler or renderer were installed. Guides referring to upstream
commands do not make those executables available. The copied agent request tells
the agent to check its actual capabilities. Copying never dispatches work; a
missing or older deployed guide yields an explicit gateway-update instruction and
pinned source fallback. Native output rendering, scheduling and new persistence
services are outside this manual-library pass.

## Updating

Review a specific upstream commit, copy selected files, update their manifest hashes,
adapt affected manuals and rebuild the guide bundle. Check instruction changes
against Lookout's permission boundaries. Bump changed guide versions and the
catalog version, then increment developerVersion. Run relevant tests, the full
suite, data validation, typecheck and static build. Deploy the gateway only through
normal production release; do not update the shared backend from a feature branch.
