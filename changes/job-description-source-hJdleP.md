# Job description source boundary

- Added a shared bordered quotation and source-domain link beneath About the job in Discover and application details. Plain text remains escaped; only HTTP(S) source links render. Missing descriptions retain an honest empty state, and fictional demo descriptions stay labeled.
- Updated frontend behavior documentation. Existing demo fixtures exercise the shared renderer without external links.
- Validation: changed component bundle compilation, data validation, diff check and Impeccable detector passed.
- Limits: browser visual verification and full frontend build not run; offline dependency install failed on uncached packages.
