# Resume Continue autofill

- Onboarding Continue now starts extraction for a selected private resume and opens the existing review directly, without the APILayer offer panel. The upload hint names APILayer.
- Saving selected fields, discarding, or closing continues to preferences. Failures retain the saved document and offer retry or skipping. My Profile keeps its existing explicit import entry.
- Uses the existing scoped resume parse and profile import contracts; backend ownership and version checks remain shared with MCP.
- Validation: all 838 npm tests passed; validate:data (158 roles); production static build; Impeccable detector (no findings); browser verification of desktop/mobile fictional review, explicit save, existing-history protection, unsaved drafts, memory-only demo reset, and signed-in onboarding automatic extraction/failure recovery.
- Limits: no live APILayer upload or hosted deployment. Onboarding itself deliberately disables demo mode; fictional extraction remains covered through the shared My Profile demo interaction.
