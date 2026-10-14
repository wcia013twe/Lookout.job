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

The shell is centered at a maximum width of 1152px, with 16px horizontal padding and 24px vertical padding. Horizontal padding becomes 24px from the small breakpoint (640px). The body has a minimum width of 320px.

Navigation uses three columns below 640px and five columns above it. Header, account status, and card actions wrap. Discover cards use one column initially, two from 768px, and three from 1024px, with 16px gaps. Search and filter rows become a flexible column plus a 160px filter at 640px. Shared forms commonly become two columns at 640px. Onboarding is a full-height focused composition outside the workspace header and navigation, retaining the shared palette and controls. Its companion step uses a centered 1024px maximum-width scene: the selected intact character image sits beside compact radio choices from 768px, stacking on narrower screens. Later profile steps use a centered 576px maximum-width column. A compact top bar provides an exit to Profile; setup progress and actions stay centered.

Application rows render as separated cards on narrow screens and align with a table-like header from 768px. Sections use a top border, 32px preceding margin, and 24px top padding. Content generally follows the extracted 4px spacing rhythm; role-card padding becomes 18px from 640px.

## Elevation & Depth

The shared shell, cards, and controls use surface color and borders rather than shadows. Dialogs use a dark backdrop and a bounded scrolling surface. The global focus indicator is a 3px solid lavender outline (`#d3b0ff`) offset by 3px. Pack reveal uses a 300ms blur/vertical reveal with `cubic-bezier(0.16, 1, 0.3, 1)`; reduced-motion preferences disable animation and transition. Onboarding is static: character portraits and step changes have no animation or motion controls.

## Shapes

Controls and company logos use gently rounded corners; navigation containers use the larger rounded corner; role cards and empty states use the largest shared corner. Compact metadata chips use the smallest extracted radius. Shared buttons, fields, and navigation items have a minimum height of 44px. Preserve flexible widths and wrapping rather than forcing narrow-screen truncation.

## Components

Primary buttons use bold small text and the accent/ink pairing. Secondary buttons use semibold small text, the tag surface, and a line border that changes to the accent on hover. Disabled buttons use 50% opacity; primary buttons also show a disabled cursor.

Fields fill the available width, use a line border, larger input text, muted placeholders, and the global focus outline. Labels appear above fields with an 8px gap. Selection uses the accent/ink pairing; field carets use the focus lavender.

Role cards combine a company logo or initials, bold company name, tier badge, role title, wrapping metadata chips, two-line supporting copy, expandable analysis, and wrapping actions anchored at the bottom. Logos occupy 40px squares. Metadata chips use 8px horizontal and 4px vertical padding.

Navigation items use centered bold small text. Inactive items are muted, hover uses primary text, and the current page uses a panel background with accent text. Empty states use a bordered panel, centered heading and copy, and a primary action when supplied.

## Do's and Don'ts

- Do reuse the shared color tokens and `ui.jsx` controls.
- Do retain the global focus indicator, 44px minimum control height, wrapping behavior, and reduced-motion handling.
- Do use surface tones and borders to separate shared panels.
- Don't use the legacy root static UI as the reference for new React screens.
- Don't replace data-driven rarity accents with primary action styling.

### Onboarding surface exception

Onboarding uses the user-approved rainbow glass reference: near-black navy backdrop, static curved illuminated upper band, translucent blue glass controls, and cyan/mint/lilac/pink edge lighting on the character stage. Glass uses backdrop filtering with a readable dark fallback. Text stays solid white/cool gray; selected controls use a pale cyan edge and blue-purple fill. This is scoped to `.setup-experience`; shared workspace tokens remain unchanged. No motion.


### Workspace refinement — October 2026

Workspace pages now use `.workspace-shell` scoped navy/cyan tokens and the setup card's restrained cyan, mint, lavender and pink edge spectrum. `glass-panel` owns the shared translucent fill and edge; `glass-inset` owns recessed editing areas; `glass-toolbar` groups controls. Setup CSS and routes keep their existing visual authority. Typography retains the incumbent Inter/system stack, with responsive 26–32px page headings and 44px controls. Tracking rows become a two-column metadata composition below the wide table breakpoint. Framer Motion is limited to navigation highlights, pack reveals, tier placement, and preparation disclosures, respecting reduced-motion preferences. Reduced transparency switches glass surfaces to opaque navy. Profile and referrals retain only their composition rules in the profile CSS module; controls and material tokens are shared.
