# Job Signal Board maintenance

- `data/jobs.json` is the source of truth. Update data before touching the UI.
- Daily catalog maintenance should update `data/jobs.json` rather than rebuilding the workspace. Feature requests may extend the React workspace pages.
- `Discover` shows public roles whose `discoveredDate` matches `lastRun` and which have not been opened by the user. Split it into a full-time grid followed by an internship grid. `Auto Tracker` is client-side and receives a role only after the user opens its application link. Catalog maintenance should update `data/jobs.json`; personal Muse batches and drafts use the scoped backend tools. Opening links is not applying.
- Auto Tracker should remain a compact row view with company, job title, type, date opened/applied, status, and separate full-time and internship counters.
- Aim for up to 20 full-time roles and up to 10 internships per run. These are discovery targets, not an acceptance filter: quality wins when sources do not support the counts.
- Deduplicate by canonical application URL and then by normalized company/title/location.
- Preserve every existing `applicationStatus`; only new records start as `New`.
- Valid priorities: `Apply Now`, `Strong Consider`, `Skip Unless Team Fit`. Valid types: `FT`, `Internship`.
- Set `postedDate` to `null` if the source does not disclose it. Do not invent dates. Record result recency in `sourceFreshness` and label anything older than 72 hours in that field.
- Use SimplifyJobs’ Summer 2027 Internships list and HiringCafe as lead sources. Treat both as discovery inputs only: verify availability, job details, and the canonical application URL on the employer or ATS page before recording a role.
- Full-time criteria: favor technically selective and high-leverage backend, distributed systems, databases, AI infrastructure, retrieval/search/ranking, ML systems, inference, and developer-infrastructure roles at companies whose outcome can trade up from an Oracle SWE return path.
- Internship discovery criteria: optimize for recall among plausibly high-upside opportunities; do not hide a credible role merely because it is not yet clear whether it would justify delaying graduation. Surface obvious trade-ups (NVIDIA ML systems, Databricks, Together AI core infrastructure, LinkedIn ranking/search, Meta recsys/ML infrastructure) and potential trade-ups (SingleStore systems, Snowflake infrastructure/AI, strong database or compute startups, high-quality applied ML, strong AWS ML-systems teams).
- Keep generic SWE internships that mostly replicate Oracle/Goldman experience out unless a specific team, technical scope, brand, or conversion path points to a genuine trade-up.
- When a company has both internship and new-grad roles, surface either or both when each is independently plausible. Do not demand proof that an internship is worth delaying graduation before listing it. Use `whyItFits` to distinguish “surface it” from “accept it”: name the role’s upside tier (obvious trade-up, potential trade-up, or probably not worth delaying for) and what needs verification—team, conversion, compensation, or scope.
- Together AI: surface core inference, training infrastructure, ML systems, platform, kernels, compilers, scheduling, hardware-utilization, and model-systems internships prominently. Generic SWE, frontend, API-integration, generic internal-tooling, or low-depth solutions work can be lower priority, but do not hide a potentially strong opening merely because the team detail is incomplete; explicitly flag that team verification is needed.
- When a current candidate resume or profile is available in the workspace, ground each top-priority recommendation in concrete matching evidence and one material gap. Never invent resume experience; otherwise state that the resume comparison is unavailable.
- Run `npm run validate:data` before committing. Commit and push only the relevant dashboard/data changes.

## Simple session workflow

- One writing task, one isolated checkout, one `codex/` branch and one PR. This applies to code, documentation, catalog updates and dependency changes. Reuse the same checkout and branch for follow-ups; do not let two sessions write in it concurrently.
- Keep the shared `main` checkout for inspection and fast-forward updates. Make edits and install dependencies in the task checkout. Preserve unfamiliar edits; never reset, restore or stash another session's work to make a checkout clean.
- Commit and push intentional progress before handing off or ending unfinished work. Report the checkout path, branch, PR, checks run and any remaining uncommitted work. After merge, remove the task checkout only when its work is committed or deliberately backed up.
- Give a brief, specific nudge when work risks crossing these boundaries: name the observed issue and the smallest correction, then continue safe independent work. For example: "This checkout is already being edited by another session; I'll start an isolated checkout for this task." Do not add approval rituals, new workflow tooling or recurring reminders for hypothetical problems. When ownership is unclear and proceeding could overwrite work, ask a focused question.

## Development and delivery

- Start every feature with `npm run feature:start -- <name>` from this repository. Work only in the returned fresh checkout; run `npm ci` and `npm ci --prefix next-app` there. This prevents shared edits, stale main, Git index races, and cloud-offloaded dependencies. Reuse that checkout for follow-ups.
- Commit the intended files, then run `npm run feature:publish -- --title "<feature>" --body-file <absolute-pr-description-file>`. This pushes, creates/updates a non-draft PR, labels it `merge-ready`, and immediately wakes the queue. Do not manually poll CI or merge each PR; inspect `npm run feature:status` when status is needed. Conflict or failed-check fixes stay on the same branch and use the same publish command.
- For feature work, refresh main and use a separate `codex/` branch/worktree for each parallel feature. Push the branch, open a PR and add `merge-ready` when implementation and local checks pass. GitHub validates current changes, merges ready PRs serially and deploys. The user authorized automatic PR creation, queueing, merges and deployment; do not ask for push/merge confirmation. Do not push feature changes directly to protected main. Address review findings on the feature branch; unresolved findings, failed CI or a failed completed production deployment pause the queue. Running deployments do not hold up validated merges.
- Keep a concise `CHANGELOG.md` entry for each feature pass, including validation and any verification limits.
- Keep React page framing and interactions in `next-app/`; use Tailwind utilities and shared theme tokens in `next-app/app/globals.css`. Keep domain models and backend contracts independent of presentation.
- The user authorized the complete Next.js/React/Tailwind migration. The production UI lives in `next-app/`, deployed as a static export by `.github/workflows/deploy.yml`. Legacy static modules are retained for regression/reference and shared models, not new UI work.

## Backend and agent work

- `supabase/migrations/` is the database schema source of truth. Do not maintain a duplicate schema dump.
- Read the root README desired interaction and the gateway/MCP/runner contracts before extending behavior.
- Keep human approval, user-reported progress, and validated submission receipts distinct.
- Keep migrations and server functions in `supabase/`, shared browser/domain modules in root `lib/`, production UI in `next-app/`, and retained static reference code/styles in `legacy/`. Do not copy shared models between runtimes.
- Run `npm test` (includes every database scenario) and `npm run validate:data`; use `npm run test:db` only for focused database debugging and rebuild the auth bundle for auth/cloud/client changes.
- Add new features with current-state documentation and honest verification limits; do not describe unconnected external services as live.
- `supabase/functions/agent-gateway/instructions.json` owns the agent interaction contract and developer message defaults. Increment `developerVersion` whenever instructions, defaults, settings mappings or advertised capabilities change, and deploy the gateway with the config through the production workflow after merge. Do not deploy feature branches directly to the shared production project. Personal versions are server-controlled triggers; never reset or edit them from clients.

## Demo coverage

- After completing a feature, update the admin demo fixtures and demo interactions to cover its representative content and important states. Treat demo coverage as part of feature completion, not a separate follow-up.
- Keep demo data clearly fictional, resettable and isolated from real account storage, backend writes, private files and external submissions. Include the relevant demo verification in the changelog.

## MCP parity

Every new or changed product service or user action must fit an existing scoped
MCP tool or ship with a narrowly scoped new MCP tool in the same feature pass.
The website and MCP must share backend validation, ownership and version checks;
do not add generic SQL/database-edit tools. Document the tool mapping and test
both paths. Human-only actions still need an explicit tool boundary that explains
or requests the human action; agents must never forge approvals or bypass consent.
Do not advertise parity until the capability is deployed and verified.
