---
name: cold-outreach
description: Draft personalized job-search emails, LinkedIn messages, referral requests, and follow-ups from candidate evidence and researched contacts. Use when preparing outreach, not submitting applications or sending messages.
---

# Cold outreach

Prepare editable messages and contact records grouped by company. Ground candidate claims in the current profile/résumé and verify a contact’s current company, title and LinkedIn URL. Never invent people, accomplishments, shared connections, offers or deadlines.

Aim for a brief note with a relevant achievement, a specific company/team reason and one clear ask. Keep email subjects concise and informative; adapt LinkedIn messages to the channel. Put missing facts in a separate review list rather than placeholders in a supposedly ready draft. Don’t claim a résumé is attached unless it will be.

Recruiters handle interview-process questions. Engineers can discuss referrals or team fit; senior contacts need a technical reason for the approach. Consider university recruiting for students and founders at small companies. Honor user preferences about contact types.

Use offers and timelines only when supplied and current. Keep follow-ups concise; suggest a configurable cadence of several days between nudges and stop on replies or opt-outs. Weekday/business-hour timing is an anecdotal suggestion, not a guarantee. Do not schedule or send without authorization.

## Job Signal Board handoff

Prefer filling the native contact and message fields in the Referrals page when browser control is available. Otherwise return JSON for its Muse import, with no Markdown inside the JSON. Shape:

```json
{"contacts":[{"company":"Company","contact":"Full name","contactType":"recruiter","title":"Target job title","linkedin":"https://www.linkedin.com/in/verified-profile/","link":"https://employer.example/jobs/role","connection":"Confirmed shared context, or empty","evidence":"Candidate fact supporting fit","reason":"Specific team/company reason","subject":"Email subject","message":"Complete copy-ready message","sourceUrl":"Public source validating the contact"}]}
```

Allowed contactType values: recruiter, engineer, senior, manager, alumni, other. Do not use example URLs in real output. Leave absent optional URLs empty. Return contacts only when name and company are known; unresolved research stays outside the import. Messages remain drafts. Copying, opening LinkedIn and marking a record contacted are distinct actions; none proves a message was sent or an application submitted.

## Source

Adapted in original language from [Nick Singh's cold-email guidance](https://www.nicksingh.com/posts/cold-email-tips-to-land-your-dream-job-with-examples). The article motivates brief notes, relevant achievements, genuine personalization, truthful timing, clear asks and deliberate follow-ups. Do not reproduce its templates or claim its anecdotes predict outcomes.
