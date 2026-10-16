# Circles clubhouse controls

- Renamed Company Intel to Experiences in Circle navigation.
- Side chat uses rounded text bubbles with owned messages aligned right and a distinct theme-aware tint. Added a fictional owned chat example; reset remains isolated.
- Moved Share activity from post editors into the clubhouse as an accessible on/off switch, initially off. It opens the existing authored activity composer; publication still requires review. No automatic tracker sharing or new permission setting. Existing website and MCP draft/publication contracts are unchanged.
- Validation: TypeScript, all 350 tests (including database scenarios), focused Circle/domain tests, catalog validation, desktop/mobile visual inspection, switch on/off behavior and mechanical UI detector. Production static export passed with webpack caching temporarily disabled to fit available disk space; config restored afterward.
- Preview: /circles/preview/. No external messages, publication or backend changes.
