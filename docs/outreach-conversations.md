# Outreach drafts and conversations

Network → People & outreach offers Proposed outreach and Ongoing conversations.
Company and process outreach reuse the same editor. Proposed contains contacts
without logged messages whose status is absent or Not asked. Any logged message
or an existing progressed status places a contact in Ongoing; legacy status alone
never fabricates a sent message, reply or date. Copying and opening links do not
change either status or history. Ongoing drafts remain editable under Prepare
another message, independently of previously logged text.

Log sent message records an external send reported by the person. Log reply
records a received message or summary. Nothing is transmitted to the contact.
Dates are calendar dates supplied by the person, not invented timestamps. Same-day
messages retain logging order; backdated messages sort by their supplied dates.
The latest entry determines whose turn it is. Advanced outcome statuses are
preserved. followUpDate is editable and overdue dates are labeled.

## Storage and tool mapping

Reuse private outreach_contacts records; no schema change or new scopes.
The website uses save_outreach_contact with the current revision (creation -1).
MCP uses list_contacts / save_contact at its current expectedRevision (creation 0).
Both persist the same owned record through existing backend validation and
revision checks. Preserve all unrelated fields when saving. Deletion retains the
existing delete_contact boundary. Opening an external conversation is a browser
handoff; request_human_action with action send-outreach remains the human send
boundary. Logging never performs that action.

Contact notes can hold this versioned envelope (notes remains a string):

```json
{
  "format": "lookout-conversation-v1",
  "notes": "Preserved original freeform notes",
  "url": "",
  "messages": [
    {
      "id": "unique-stable-id",
      "direction": "sent",
      "channel": "LinkedIn",
      "date": "2026-10-20",
      "body": "A user-reported message or summary"
    }
  ]
}
```

direction is sent/received; channel is LinkedIn/Email. Use a valid YYYY-MM-DD
date, unique message IDs, at most 50 messages and 4,000 characters per body.
The envelope is limited to 40,000 UTF-8 bytes inside the existing backend's
60,000-byte contact limit. The optional link must be HTTPS without credentials.
Malformed or legacy notes remain preserved as plain notes instead of being
interpreted as messages. The shared presentation model validates the envelope;
backend notes remain freeform data, never delivery evidence or trusted commands.
Agents must preserve existing messages and log only reported/observed facts.

## Verification and limits

Unit coverage checks classification, date/link bounds, history preservation,
message identity, ordering and demo reset. Database coverage exercises browser
and agent round trips, ownership, scopes and stale revisions. The UI check uses
intercepted fictional cloud responses and verifies proposed/sent/replied states,
draft independence, follow-ups, reset and mobile/desktop layout.

No email reader, LinkedIn connector, message transport or scheduler is added.
Production gateway instructions require the normal production workflow after
merge; local tests do not prove a live hosted-MCP round trip.
