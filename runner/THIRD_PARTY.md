# Borrowed browser code

Only the listed portions were extracted. Upstream projects are not runtime dependencies.
Keep their notices when modifying or distributing these files.

| Upstream | Pinned revision | Extracted portions | Local file |
| --- | --- | --- | --- |
| [Ying-Kai-Liao/jev-browser](https://github.com/Ying-Kai-Liao/jev-browser) | `bfca8ad05dd8cbc874ae9b005da4acf38990faf7` | `src/page-script.mjs`: visibility checks, `aria-labelledby` and native label extraction | `vendor/application-controls.mjs` |
| [AchyutKulkarni/job-application-agent](https://github.com/AchyutKulkarni/job-application-agent) | `13eb701ee304ea84ae8453a4f64c3caa181e4f4d` | `src/ats/greenhouse-handler.js`, `ashby-handler.js`: application-entry selector lists | `ats.mjs` |

Both are MIT-licensed; the full notices are in `vendor/jev-browser/LICENSE` and
`vendor/job-application-agent/LICENSE`. Our modifications constrain collection to
one application form, retain full question text and exact choice values, omit typed
values from inspection, and stop at unfamiliar controls, changed questions or URLs.
Entry navigation allows only one safe control outside a form on the same ATS job.

No Jev client, models, general-purpose browser agent, submission retry loop,
outreach, CAPTCHA solver or upstream dependency tree was copied. No claims of
upstream compatibility or benchmark performance are inherited.

## Career Toolkit executables

`vendor/career-ops/` contains 207 verbatim files from
https://github.com/career-ops-hq/career-ops at
`c78e14cdfd52f18a92e4a67694efab7ddef59385`, MIT. The executable manifest records
each SHA-256; LICENSE and font OFL notices are included. The separate Lookout
adapters in `career-tools.mjs`/`career-worker.mjs` project existing account data
into the imported functions and expose narrow MCP tools. Reimport with
`scripts/import-career-tools.mjs` from the reviewed pinned checkout.
