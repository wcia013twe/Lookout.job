# Circles clubhouse controls

- Renamed Company Intel to Experiences in Circle navigation.
- Side chat uses rounded text bubbles with owned messages aligned right and a distinct theme-aware tint. Added a fictional owned chat example; reset remains isolated.
- Moved Share activity from post editors into the clubhouse as an accessible on/off switch, initially off. It opens the existing authored activity composer; publication still requires review. No automatic tracker sharing or new permission setting. Existing website and MCP draft/publication contracts are unchanged.
- Validation: TypeScript, all 351 tests (including database scenarios), focused Circle/domain tests, catalog validation, desktop/mobile visual inspection, switch on/off behavior and mechanical UI detector. Production static export passed with webpack caching temporarily disabled to fit available disk space; config restored afterward.
- Preview: /circles/preview/. No external messages, publication or backend changes.
- Integrated concurrent local-main file-preview work; preserved both surface notes, composer file controls and the activity switch. Rechecked merged TypeScript and full tests.

## Side chat follow-up

- Side chat has its own compact composer, with no file/context inputs or drop attachments. Forum composers keep existing attachments.
- @ searches published top-level forum posts by title/company/author. Keyboard or pointer selection inserts a durable post link in the message body, using existing website/MCP draft and review contracts. Links render in chat and thread details; no new backend fields or permission grants.
- Added a fictional forum mention and focused tests for draft exclusion, reference parsing and reviewed save/publish/read persistence.
- Follow-up validation: all 354 tests, TypeScript, catalog validation, production static export (cache disabled only during build), UI detector, desktop/mobile picker inspection, keyboard selection, draft review and referenced-post navigation passed.
