# Outreach starter templates

- Added five canonical templates for recruiter interviews, warm referrals, shared backgrounds, technical leaders and follow-ups, each with applicability, evidence requirements, subject and message.
- Referrals previews the library in guest, empty, populated and admin-demo states without creating contact records. Native disclosure controls let users inspect each template.
- The Nick Singh-derived cold-outreach skill remains the default for customization and tailoring. Agents receive the same library via the existing authenticated `read_guide("cold-outreach")` boundary, with version 3 of the guide and developer contract version 19. Required facts must be verified and placeholder text resolved before saving complete drafts; follow-ups require an actual sent message and no reply/opt-out.
- Updated MCP documentation and demo fixtures. Guide reads and demo fixture resets retain isolated copies of the library.
- Validation: all 293 tests pass (including database scenarios), data validation passes for 76 roles, frontend typecheck and production static build pass. Headless Chrome inspection confirmed all five previews expand on desktop (1440px) and mobile (390px), with no horizontal overflow; screenshots visually reviewed.
- Limits: local implementation only. Hosted gateway and frontend deployment and a live connected-agent round-trip are unverified; no production deployment or outreach sending performed.
