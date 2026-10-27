# Resume Continue autofill

- Onboarding Continue now starts extraction for a selected private resume and opens the existing review directly, without the APILayer offer panel. The upload hint names APILayer.
- Saving selected fields, discarding, or closing continues to preferences. Failures retain the saved document and offer retry or skipping. My Profile keeps its existing explicit import entry.
- Uses the existing scoped resume parse and profile import contracts; backend ownership and version checks remain shared with MCP.
- Validation: all 838 npm tests passed; validate:data (158 roles); production static build; Impeccable detector (no findings); browser verification of desktop/mobile fictional review, explicit save, existing-history protection, unsaved drafts, memory-only demo reset, and signed-in onboarding automatic extraction/failure recovery.
- Limits: no live APILayer upload or hosted deployment. Onboarding itself deliberately disables demo mode; fictional extraction remains covered through the shared My Profile demo interaction.

## Processing feedback follow-up

- Replaced the generic auto-extraction message with a three-step processing list. Completed steps draw green checks; active work shows a spinner, with reduced-motion support.
- Successful saves show “Your profile is saved” and keep the confirmation visible until Continue. Extraction failures show an attention state and retry without claiming success.
- Shared fictional demo now verifies all three completed steps and the saved heading.
- Follow-up validation: frontend typecheck, data validation, production build, clean design detector, and desktop/mobile browser checks passed. Live provider processing remains unverified.

## Parser connection repair

- Removed the onboarding Try again control. Continue still makes one automatic parse request; failures show their actual message.
- Live-main now reads only NEXT_PUBLIC_LOOKOUT_API_URL from source local env files, so isolated previews connect to the configured parser without copying private credentials.
- Root cause locally: parser running on 8081 but preview had no API URL. Added coverage for public-only propagation and env precedence.
- Validation: three live-preview tests, typecheck, data validation, production build and production-build browser checks passed. Provider extraction with a real resume remains unverified.
