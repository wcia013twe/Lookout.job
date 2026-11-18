# Circle image paths

- Resolve Circle backgrounds and built-in avatars against the configured frontend base path so they load on project-hosted deployments.
- Validation: `npm test` (1,489 passed), `npm run validate:data`, frontend typecheck, and static build with `NEXT_PUBLIC_BASE_PATH=/Lookout.job`; confirmed the image is included in the export.
- Limits: no authenticated hosted browser or visual recording was available; deployment remains separate.
