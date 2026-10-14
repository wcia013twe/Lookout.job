---
name: cold-outreach
description: Draft personalized job-search emails, LinkedIn messages, referral requests, and follow-ups from candidate evidence and researched contacts. Use when preparing outreach, not submitting applications or sending messages.
---

# Cold outreach

Prepare editable messages and contact records grouped by company. Ground candidate claims in the current profile/résumé and verify a contact’s current company, title and LinkedIn URL. Never invent people, accomplishments, shared connections, offers or deadlines.

Aim for a brief note with a relevant achievement, a specific company/team reason and one clear ask. Keep email subjects concise and informative; adapt LinkedIn messages to the channel. Put missing facts in a separate review list rather than placeholders in a supposedly ready draft. Don’t claim a résumé is attached unless it will be.

Recruiters handle interview-process questions. Engineers can discuss referrals or team fit; senior contacts need a technical reason for the approach. Consider university recruiting for students and founders at small companies. Honor user preferences about contact types.

Use offers and timelines only when supplied and current. Keep follow-ups concise; suggest a configurable cadence of several days between nudges and stop on replies or opt-outs. Weekday/business-hour timing is an anecdotal suggestion, not a guarantee. Do not schedule or send without authorization.

## Platform execution

At each connected run, call read_outreach_workspace to check pending requests and current contacts. Follow this platform skill from read_developer_context; no local skill installation or user-pasted prompt is required. Read the current candidate profile and roles using existing authorized tools. Research contacts for each requested company and prepare complete messages.

Call save_outreach_package with requestId, a stable eventKey and contacts. For existing contacts, include id and expectedRevision from read_outreach_workspace. Reuse exactly the same eventKey/payload after transport failure. A revision conflict means a person or another agent edited the contact: reread and preserve those changes. The platform preserves human outreach status. This saves drafts, never sends messages. If needed facts or research capabilities are unavailable, report the gap truthfully rather than fabricating contacts or completion.

Contact fields: company, contact, contactType (recruiter, engineer, senior, manager, alumni, other), title, linkedin, link, connection, evidence, reason, subject, message, sourceUrl. company/contact/contactType/message are required; other fields are optional. URLs must be HTTPS; linkedin must be a verified /in/ profile. Return one clear ask in a complete message, with no bracketed placeholders. The website will display the saved contacts and copy-ready messages automatically.

## Source

Adapted in original language from [Nick Singh's cold-email guidance](https://www.nicksingh.com/posts/cold-email-tips-to-land-your-dream-job-with-examples). The article motivates brief notes, relevant achievements, genuine personalization, truthful timing, clear asks and deliberate follow-ups. Do not reproduce its templates or claim its anecdotes predict outcomes.
