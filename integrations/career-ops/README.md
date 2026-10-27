# Career Ops manuals in Lookout

Career Toolkit is a native, read-only skill library. It adapts instructional content
from [Career Ops](https://github.com/career-ops-hq/career-ops) at commit
`c78e14cdfd52f18a92e4a67694efab7ddef59385` (VERSION 1.36.0), under the
included MIT license. `upstream/` contains the verbatim selected source files;
`manifest.json` records their hashes. Keep the source attribution and license.

`catalog.json` is the canonical user-facing catalog: eight categories, 39 manuals,
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
The skill page shows an overview, a sandboxed Skill.md iframe and one copy-invocation button. The page renders its canonical adapted guide and pinned source documents into script-free HTML directly from committed sources; no generated public files or account context are needed. Each skill page embeds its selected document directly in the iframe using `srcDoc`, so a missing document URL cannot fall back to the application shell.
`read_guide` returns one full adapted guide on demand under existing workspace
read authorization. The developer index includes guide metadata, not full content.

The updated local runner now vendors actual provider, document, ATS and analytics
code separately under `runner/vendor/career-ops/`. Its SHA-256 manifest pins the
same commit. `scripts/import-career-tools.mjs <reviewed-source-checkout>` reproduces
the dependency closure (249 files, including 108 network providers and the original scanner/tracker dedup/merge code), templates,
fonts and license. It excludes arbitrary local parsers and upstream interactive UI,
installers, self-updaters, model wrappers and user data. See `runner/README.md` for
executable MCP tools. The approved local Node discovery service reuses the existing isolated child/provider flow and original scanner identity + tracker dedup CLI on disposable mapped rows; it creates no parallel user tracker. Only Greenhouse/Lever are activated there, with provenance in backend/local/careerops-discovery-proof.json. Other services remain subject to the user’s separate approval. No personal-agent scheduler is activated. Local capabilities require a
runner restart; hosted persistence requires the normal backend release.

## Updating

Review a specific upstream commit, copy selected files, update their manifest hashes,
adapt affected manuals and rebuild the guide bundle. Check instruction changes
against Lookout's permission boundaries. Bump changed guide versions and the
catalog version, then increment developerVersion. Run relevant tests, the full
suite, data validation, typecheck and static build. Deploy the gateway only through
normal production release; do not update the shared backend from a feature branch.

## Interview answer writers

STAR Answer Writer and Interview Answer Builder are original Lookout coaching procedures informed by the linked Harvard MCS and The Muse articles (reviewed 2026-10-22), with pinned Career Ops interview references. Article text and sample answers are not vendored. Both resolve through the existing workspace-read `read_guide` boundary; private outputs use `list_artifacts`, `read_artifact` and `save_artifact` (drafts:write). They reuse the existing artifact validation and ownership/version checks. No new action, automatic onboarding generation or scheduler is introduced. Hosted guide availability requires the normal gateway release.

The executable import now includes the complete upstream search entry points: the
main scanner, reverse ATS scanner, HN and browser-based source scanners, ATS/company
discovery, JD fetching, liveness, portal validation, pipeline verification/ranking
and their dependency closure. `manifest.searchEntrypoints` lists the exact source
files. The originals remain unchanged; dependency versions are locked in Lookout.
Presence is distinct from execution: browser-based sources still need a configured
browser engine, and optional AI enrichment still needs its own configured provider.
Default server workers do not inherit agent credentials or model keys.

Lookout translates owned saved profiles into upstream filter inputs and persists
results through scoped versioned tools. It must reuse Career Ops predicates rather
than replace title/location/salary/visa/dedup behavior. A discovery predicate passing
on missing data means keep the lead, not verified eligibility. Personal narrative
analysis and four card ratings remain work for the connected agent. Simplify JSON
is an aggregate lead adapter because this pinned upstream has no Simplify provider;
it does not replace employer verification or the original search/filter layer.
