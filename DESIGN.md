---
name: Job signal board
description: Incumbent visual system of the Next.js workspace UI.
colors:
  board-bg: "#0e1116"
  board-panel: "#101016"
  board-text: "#f5f4fa"
  board-muted: "#bfc2cf"
  board-accent: "#e9dcff"
  board-accent-hover: "#f4ebff"
  board-ink: "#211332"
  board-line: "#343442"
  board-tag: "#242430"
typography:
  headline:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "24px"
    fontWeight: 700
    lineHeight: "32px"
    letterSpacing: "-0.025em"
  title:
    fontSize: "18px"
    fontWeight: 700
  body:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "14px"
    lineHeight: "1.625"
  label:
    fontSize: "14px"
rounded:
  md: "6px"
  lg: "8px"
  xl: "12px"
  2xl: "16px"
spacing:
  1: "4px"
  2: "8px"
  3: "12px"
  4: "16px"
  5: "20px"
  6: "24px"
  8: "32px"
components:
  button-primary:
    backgroundColor: "{colors.board-accent}"
    textColor: "{colors.board-ink}"
    rounded: "{rounded.lg}"
    padding: "8px 16px"
  button-primary-hover:
    backgroundColor: "{colors.board-accent-hover}"
  button-secondary:
    backgroundColor: "{colors.board-tag}"
    textColor: "{colors.board-text}"
    rounded: "{rounded.lg}"
    padding: "8px 16px"
  field:
    backgroundColor: "{colors.board-tag}"
    textColor: "{colors.board-text}"
    rounded: "{rounded.lg}"
    padding: "8px 12px"
  role-card:
    backgroundColor: "{colors.board-panel}"
    rounded: "{rounded.2xl}"
    padding: "16px"
---

# Design System: Job signal board

## Current Circles composition: conversations with context

The active overview uses a collection/member rail, a central conversation stream
and message-first composer, and a supporting context rail. It inherits all existing
workspace tokens and both themes. Job/round attachments reuse the application identity and stage tracker as a compact row;
offer comparisons have a concise two-column preview and their existing thread detail
shows the shared fields. Collections filter the same shared posts. The cloud cottage
is retained behind Open clubhouse, with an illustration invitation in the context rail.
The existing thread detail/reply/review layout remains the reading surface. See
`.impeccable/surfaces/circles.md` for the surface contract. Earlier compositions below
record design history.

## Current Circles composition: one dashboard

The active dashboard now centers on one activity stream plus the small member
constellation. A compact featured milestone appears once above the stream, with
a portrait, name, company and handwritten stage callout. A curved SVG arrow
points toward the portrait; published offer stages use “Offered!”. Large generic
headlines and excerpts are removed from this feature. Full shared text remains
available in the existing contribution detail. The other event types share one
author/date/title/preview/action row pattern. Selecting a member filters this
same stream rather than adding a second list. Separate content collections in
the earlier composition below are historical.

Circles is a single responsive dashboard with a photo-backed identity header,
inline search, featured celebration, opportunities, shared resources and a compact
interactive member constellation. It has no Overview/People/Moments navigation.
Settings, Share, Circle switching and conditional draft review sit in the header.
All content uses the same published data and existing contribution detail. The
recovered comps supply the portrait, navy/lavender and handwritten visual language,
not separate destinations. The historical three-view design below is superseded.

## Circles: approved three-view composition

Circles uses the recovered member-constellation, achievement-wall and crew-lobby
comps as visual references. Overview, People and Moments share an identity
header, private Circle label, consistent portrait treatments, persistent tab
navigation and the existing contribution detail/review surface. Navy surfaces
and lavender actions inherit the workspace palette; Caveat Regular is hosted
locally for short personal annotations and quotes. Controls and factual metadata
retain the workspace sans-serif typography. A photographic mountain backdrop
anchors the identity; an architectural photo supports the opportunity feature.
The emblem is geometric SVG. Generated portraits are fictional demo-only assets.

People uses a desktop radial arrangement with an equivalent three-column member
selector on phones. Selecting a member reveals only deliberately shared content.
Moments gives one published milestone a portrait-led celebration, supporting
moments and a chronological shared-moment strip. Overview favors opportunities
and resources with a supporting shared-update column. No comparative hiring
pipeline or artificial contribution score appears. All views use semantic buttons,
visible focus, wrapping content, and the same exact-review sharing controls.
Light mode uses the existing pale workspace surfaces and a darker lavender for
text links and annotations, while the photographic header retains dark overlays.

## Overview

The implemented workspace uses a dark canvas, subtly separated panels, pale lavender actions, and compact sans-serif typography. Discover's role cards establish the shared visual vocabulary used by forms, application lists, and onboarding.

This is a description of the incumbent React UI, not a new brand direction. Source authority is `next-app/app/globals.css`, `next-app/components/ui.jsx`, `role-card.jsx`, and `app-shell.jsx`; the legacy root static UI is not the deployed visual reference.

**Key Characteristics:**
- Dark surfaces with restrained borders.
- Lavender primary actions and active navigation.
- Rounded controls with generous touch targets.
- Wrapping layouts and responsive content grids.

## Colors

### Primary

Pale lavender (`board-accent`) marks primary buttons, active navigation, and analysis links. Its lighter hover variant provides pointer feedback; deep purple ink provides primary-button text contrast.

### Neutral

`board-bg` is the page canvas; `board-panel` is the card and active-tab surface; `board-tag` groups navigation, fields, and metadata. Near-white text carries primary content, muted gray carries supporting copy, and `board-line` separates sections and outlines controls.

Role rarity colors are data-driven accents from `next-app/lib/role-display.js`. Cards mix the tier color at 55% with the shared border color; preserve that relationship rather than replacing the shared palette.

## Typography

Use the inherited Inter/system sans-serif stack. Page headings use the headline token, while section and role headings use the title token. Supporting copy and control labels use the body and label roles; metadata uses small text (12px). Form values use larger text (16px). Shared headings constrain explanatory copy to the Tailwind prose width (65ch).

Role titles use snug line height (1.375); supporting copy uses relaxed line height. Company names and labels are bold where observed. Inter is named in CSS; rendering can fall back to the system stack.

## Layout

The shell is centered at a maximum width of 1152px, with 16px horizontal padding and compact phone spacing. Horizontal padding becomes 24px from the medium breakpoint (768px). The body may shrink below 320px without introducing document-level horizontal overflow.

The header uses flat text links for Action board, Discover, Applications and Network, with a neutral count badge and a solid blue fill for the current page (ice blue with navy text in dark mode, deep blue with white text in light mode). At 1200px and above, brand, links and utilities share one row. Below that, navigation sits beneath the brand and right-aligned profile avatar. Theme and progress utilities remain in the profile menu below 768px. Desktop theme selection and the XP disclosure use quiet, borderless controls. Profile and progress popovers align inward from the right edge. The brand retains its last-scan date. Discover cards use one column initially, two from 768px, and three from 1024px, with 16px gaps. Mobile search occupies a full row above two equal filters. Shared forms commonly become two columns at 640px. Onboarding is a full-height focused composition outside the workspace header and navigation, using the approved scoped setup-room and dark-glass exception below. Its companion step uses a centered 896px maximum-width room: the selected companion is centered in a large speaker area on the left, with three vertically stacked participant radio tiles in a 190px right sidebar from 768px. On narrower screens, participants use one horizontally scrollable strip below the compact speaker. After companion selection, the server-backed agent-first setup uses a centered 672px maximum-width column. A compact top bar provides an exit to Profile; actions wrap within the current scene.

Application rows render as compact metadata cards on narrow screens, keeping company, title, type, opened/applied date, status and preparation state visible while reserving the full timeline for application details. They align with a table-like header on wider screens. Profile uses a labelled section selector below 768px and tabs above it. Network uses two underlined navigation tabs: Targets and Active processes. Targets uses divided company rows with company identity, team/role focus, next step and people count; columns stack on mobile. A target opens into Overview, People & outreach, and Applications sections. Active processes uses a desktop application list beside role-specific outreach, changing to a labelled process selector on mobile. Existing company contacts are disclosed separately from contacts attached to that process. Overview places research beside a next-action panel on wide screens and stacks them on smaller screens. People & outreach retains the existing phone list/detail handoff and desktop contact master-detail composition; Applications reuses the existing application list and detail dialog. Sections use a top border, 32px preceding margin, and 24px top padding, reduced on phones. Content generally follows the extracted 4px spacing rhythm.

## Elevation & Depth

The shared shell, cards, and controls use surface color and borders rather than shadows. Dialogs use a dark backdrop and a bounded scrolling surface. The global focus indicator is a 3px solid lavender outline (`#d3b0ff`) offset by 3px. Pack reveal uses a 300ms blur/vertical reveal with `cubic-bezier(0.16, 1, 0.3, 1)`; reduced-motion preferences disable animation and transition. Onboarding is static: character portraits and step changes have no animation or motion controls.

## Shapes

Controls and company logos use gently rounded corners; header navigation has no surrounding container; role cards and empty states use the largest shared corner. Compact metadata chips use the smallest extracted radius. Shared buttons, fields, and navigation items have a minimum height of 44px. Preserve flexible widths and wrapping rather than forcing narrow-screen truncation.

## Components

Primary buttons use bold small text and the accent/ink pairing. Secondary buttons use semibold small text, the tag surface, and a line border that changes to the accent on hover. Disabled buttons use 50% opacity; primary buttons also show a disabled cursor.

Fields fill the available width, use a line border, larger input text, muted placeholders, and the global focus outline. Labels appear above fields with an 8px gap. Selection uses the accent/ink pairing; field carets use the focus lavender.

Role cards combine a company logo or initials, bold company name, tier badge, role title, wrapping metadata chips, two-line supporting copy, expandable analysis, and wrapping actions anchored at the bottom. Logos occupy 40px squares. Metadata chips use 8px horizontal and 4px vertical padding.

Header navigation items use compact text with 44px targets. Inactive items are muted, hover uses primary text, and the current page uses bold primary text without a filled background. Empty states use a bordered panel, centered heading and copy, and a primary action when supplied.

## Do's and Don'ts

- Do reuse the shared color tokens and `ui.jsx` controls.
- Do retain the global focus indicator, 44px minimum control height, wrapping behavior, and reduced-motion handling.
- Do use surface tones and borders to separate shared panels.
- Don't use the legacy root static UI as the reference for new React screens.
- Don't replace data-driven rarity accents with primary action styling.

### Onboarding surface exception

Onboarding uses the user-approved rainbow glass reference: near-black navy backdrop, static curved illuminated upper band, translucent blue glass controls, and cyan/mint/lilac/pink edge lighting on the character stage. Glass uses backdrop filtering with a readable dark fallback. Text stays solid white/cool gray; selected controls use a pale cyan edge and blue-purple fill. This is scoped to `.setup-experience`; shared workspace tokens remain unchanged. No motion.


### Workspace refinement — October 2026

Workspace pages now use `.workspace-shell` scoped navy/cyan tokens and the setup card's restrained cyan, mint, lavender and pink edge spectrum. `glass-panel` owns the shared translucent fill and edge; `glass-inset` owns recessed editing areas; `glass-toolbar` groups controls. Setup CSS and routes keep their existing visual authority. Typography retains the incumbent Inter/system stack, with responsive 26–32px page headings and 44px controls. Tracking rows become a two-column metadata composition below the wide table breakpoint. Framer Motion is limited to pack reveals, tier placement, and preparation disclosures, respecting reduced-motion preferences. Reduced transparency switches glass surfaces to opaque navy. Profile and referrals retain only their composition rules in the profile CSS module; controls and material tokens are shared. The Action Board widgets use distinct blue and pink cloud surfaces as described below; that exception does not neutralize the shared workspace theme.

### Tier banners and daily pack

Role banners sit behind the overlapping title sheet. Each tier uses a deep tinted
glass base, a complementary refracted facet and a fine luminous upper edge; labels
stay white over dark glass. Spring-smoothed sheen responds to mouse position and
keyboard focus. Touch and reduced-motion users receive a static material.

Zero2Sudo history uses compact native disclosures with separate skipped rows. The
pack uses a native modal dialog and restores focus on close. Its visual and motion
templates live in `next-app/styles/templates/` and are selected from pack content,
while factual tier colors remain data-driven. The sealed face uses smooth
pearlescent foil: broad cyan-gold-violet color travel, a pointer-responsive white
specular reflection and very low grain, never a decorative grid, stripe or
laser-like line.
Foil tearing, tier upgrades and bounded sparks run only while the pack is active;
the final tier earns a slower white-hot core, long tier-colored rays and particle
corona. Completed cards advance forward automatically and finish in a compact grid.
Reduced motion removes the WebGL scene and spatial effects. Paired drops stack in a
scrollable phone view.

### Color modes

The header offers System, Light and Dark. Tailwind v4's dark variant is driven by
`html[data-theme]`; semantic board colors and native color-scheme switch together.
A small pre-paint script respects the saved device preference, with guarded storage
and system fallback. Light mode pairs pale cyan/lavender pearl glass with dark navy
ink and darker action/status colors. Dark mode keeps the existing navy spectrum.
Tier banners and sealed foil remain deliberately dark in both modes; role sheets
and pack dialog chrome adopt the chosen palette. Setup keeps its approved night
composition. Preference changes never alter account or demo records.

Light workspace actions use one navy primary and blue-gray secondary system,
including application-tracker actions and the pack dialog's surrounding chrome.
Expressive objects inside the pack keep their tier and foil colors. Needs You
uses the shared workspace panel and compact divided-row treatment so its tasks
match neighboring application surfaces in both color modes.

#### Archived palette: Needs You solid cards (inactive)

The solid-card exploration is retained for future use but is not applied to the
current interface. Its four colorways were:

| Colorway | Surface | Border | Accent | Button ink |
| --- | --- | --- | --- | --- |
| Navy | `#102033` | `#285f7d` | `#59c7f8` | `#071923` |
| Plum | `#30133a` | `#765537` | `#ffd34d` | `#211804` |
| Oxblood | `#3a1421` | `#8a572c` | `#ffc948` | `#211604` |
| Indigo | `#14243a` | `#356b8d` | `#63c8f5` | `#071923` |

All four used `#f8fbff` primary copy and `#cad7e5` muted copy.

Onboarding uses the approved video-call-style companion setup room within the full-screen dark-glass setting: near-black navy backdrop, static curved illuminated upper band, and a translucent room with a centered selected companion in the focused speaker area and three participant tiles in a right sidebar on desktop or a bottom strip on mobile. Intact supplied images appear in the preview and participant tiles. A nameplate identifies the selected companion, while a status notice announces that it joined the setup room and explicitly labels the experience “Preview only.” Native radios select a companion, platform suggestions, or another agent. Room corners are 16px, participant corners 10px, and selected participants use pale cyan borders, a blue fill, and the label “Focused.” These `.call-*` patterns belong to onboarding within `.setup-experience`; shared workspace tokens remain unchanged. No live-call controls or motion are enabled. Character metadata reserves `animation: null` slots for future supplied media.

The companion choice records a preference; the following `AgentFirstSetup` scene checks the real connection and browsing tools before collecting minimum search intent. It asks the connected agent for one evidenced employer posting before presenting contextual recommendation, preparation, or automatic-application setup choices. Recommendations require no résumé; preparation progressively requests verified profile facts and a private résumé when required. Automatic-application setup remains a request subject to existing human, answer, and runner safeguards. Cards show fit evidence and whether fit is preliminary; task rows distinguish queued, completed, blocked, and uncertain work. Pause, refresh, and a recommendations-only fallback keep unresolved prerequisites visible. Website and agent tools share backend state rather than implying completed work from a selection or queued task.

Delivery preferences appear after the first result and save an inactive request until a runtime confirms the scheduler and channel. Managed Cappy hosting, inbound Muse push, and scheduler/channel activation are unverified capabilities and are described as blockers; updates use polling. Social sharing remains off. The demo explicitly labels fictional results. This behavior reuses existing controls and surface tokens without defining a new visual system.

### Action Board priority

The “Your next actions” widget leads the Action Board in both the workspace and demo, using the larger desktop column (2:1), a 20px heading with a clipboard icon, and a neutral border. Each row leads with the task, then company/role context, a short reason and an explicit labeled action button. Empty checkbox-shaped disclosure triggers are removed. The first fictional application review is expanded on demo entry and reset; approval still requires reviewing the version. The next-actions widget uses an opaque navy working surface and weekly prep uses a quieter solid slate-plum surface. Blue and pink aurora gradients are confined to their headers, with hue-matched secondary text, borders and controls in both themes. Light mode uses near-white blue and lilac surfaces. Task buttons sit alongside their summaries when the panel is at least 520px wide and stack below on narrower panels. Expanded reviews have a separated form area, and the active disclosure uses the solid primary action palette. The columns have a 24px gap. The prep agenda shows all scheduled dates, session titles, durations and interview events together without a day picker. A date rail with 32px day numbers groups sessions through spacing instead of horizontal divider lines; empty days are omitted. Confirmed interviews use a clearly outlined, tinted event block with a calendar icon, company and stage. Longer reasons and interview links expand from individual task titles. Only today’s sessions show a labeled “Done” action. Daily budget controls and planner explanation live in an optional settings disclosure. Preparation follows the actions on mobile.

Application dialogs resolve their palette from the shared workspace theme, independently of the widget that opened them. The vertical status panel shows the recorded scheduled-round focus and source note beside its dates. Weekly prep displays a short reason from the saved task detail below its title; the demo connects concrete interview topics to its fictional Query Lab project and SQL-service internship. These are authored fixture facts, not a new inference engine for real-account skill gaps.

### Private company Network

Network opens a compact Companies list with role focus, people/application counts and the next step. Company Overview leads with a next step and readable brief; Circle context occupies the second desktop column and follows the brief on mobile. Personal focus and verification questions stay readable; people/outreach and applications retain counted tabs. Small inline editors handle focus, next step, brief or settings; sources, explicit links and archive use disclosure. The Stripe new-grad demo pairs an authored sample brief with clearly labeled example takeaways and source-conversation links. No live generation or notification service is implied. Process outreach reuses the existing message editor and application dialog. Due follow-ups retain compact divided rows and Open company navigation.

## Application profile settings

Profile uses an application-profile selector above four content tabs; My agent stays
visually separated at the end of the tab row. Overview uses a compact shared
identity header, three readiness rows, and account/writing summaries. About me
labels shared background explicitly. Application kit presents selected materials
and separate employer-answer/outreach writing settings before disclosed library
creation forms. Preference groups use summaries and progressive disclosure.
All colors inherit the shared theme tokens. A sticky desktop profile save bar
becomes an ordinary footer on mobile; shared background keeps its distinct
human verification and save action. No account assignment implies connectivity.

### Solid anchors in the aurora workspace

Discover groups its filters on an opaque navy surface with darker opaque controls. Light mode uses a pale blue surface and white controls. Active workspace navigation reuses the primary action colors, with compact desktop spacing to keep all six destinations on one row. Aurora backgrounds and role-card materials retain their existing treatment. The admin demo renders these same components with its existing fictional listings; no new data or service action is introduced.

### Applications solid-surface tracker

Applications uses the shared navy/ice-blue palette, with an aurora header over solid filters and filled Active, Saved jobs and Closed selections. Counts show actual view membership; separate full-time and internship counts describe the current filtered list. The main list groups rows on one opaque surface with Company & role, Type, Opened / applied and Application progress columns. Each row restores the five-stage timeline with smaller markers and a plain status/details action below it. Mobile places the full timeline below identity and type/date metadata. Shared tracker progress uses one theme-aware blue for reached stages and connectors in lists, application details and Network; upcoming stages use muted blue outlines. Preparation state remains separate from hiring status. Missing dates say “Date not recorded.” Detailed progress timelines also remain inside the existing application dialog, and Network retains its existing timeline layout. The resettable demo includes a fictional internship offer and a withdrawn role with missing dates.

The current tracker stage has a green center that gently pulses inside its blue marker over four seconds. The pulse changes only the center's opacity and scale; its outer ring and completed connectors stay blue. Light mode uses a deeper green. Reduced-motion preferences keep the center steadily visible. The shared selector covers horizontal timelines and vertical application details.
