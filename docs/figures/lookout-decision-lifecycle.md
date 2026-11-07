# Lookout decision lifecycle

Native editable diagram translated from the user's Mermaid flowchart.

- The personal agent starts delegated discovery.
- Discover & Screen -> Prepare & Apply -> Track Application.
- Tracking exchanges updates with Network & Follow Up and Interview Preparation.
- A shared read/write bus connects all five stages to Shared Workflow State.
- Conditional dashed paths from preparation/applications, networking and interview
  preparation lead to Human Review & Feedback.
- Approval/correction updates shared state. The dashed return path represents the
  agent retrieving updated context and resuming authorized work.

Solid lines denote conceptual workflow progression or shared-state access; dashed
lines denote human intervention and resumption. These are logical relationships,
not a claim that every step runs automatically or is a separate service. In the
implementation, actual wake/resumption depends on the configured agent runtime,
current task authority and backend policy. Human feedback does not itself authorize
all subsequent actions. Networking/interview input can occur through their existing
interfaces; this figure does not claim every such interaction creates an application
Action Board inbox entry.

Files: `lookout-decision-lifecycle.drawio`, `.svg` and `.pdf`. The draw.io file
contains native text, shapes, groups and connectors. The SVG embeds that same
editable XML. The PDF is vector output suitable for a two-column-wide figure.

Verified XML references, expected nodes/edges, SVG source embedding, PDF text/vector
structure and visual rendering. Interactive diagrams.net editor import/round-trip
remains unverified. The architecture figure is unchanged by this addition.
