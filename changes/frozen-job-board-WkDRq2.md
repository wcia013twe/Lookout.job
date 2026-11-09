# Reusable frozen Jobright board

- Freeze 794 real source listings at Jobright commit 9763907b1b91472ad3f1079270645717a8527244, with stable IDs, source order/date labels and hashed provenance. Capture 30 descriptions; retain all 30 unsuccessful attempts from the bounded first-60 capture without retries.
- Export an accessible five-column GitHub-style table and local frozen detail pages. Stage-specific exports include only allowed jobs; candidate profiles, evaluator labels and results are never part of source infrastructure.
- Publish only the generated static export to the separate public Lookout-eval-job-board repository, at user request. No Lookout production deployment or product data changes.
- Validation: focused parser/provenance/hash/subset regression, npm run validate:data, desktop/mobile browser checks (794 rows, no viewport overflow, detail navigation). Locked root and frontend installs completed. Product full suite/build not run: source tooling and standalone static artifact only, no runtime changes.
- Limits: Jobright-derived descriptions are not employer-verified availability. Most listings have no captured description; preserve that uncertainty. N02 private reference labels and participant execution remain separate. No product UI/demo/MCP capability changed; standalone board checks cover this infrastructure surface.

- Publication verified: GitHub Pages build succeeded; deployed jobs JSON contains 794 rows and matches its SHA-256 manifest. Public export commit: 9257b36.
