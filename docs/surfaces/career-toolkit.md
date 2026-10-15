# Career Toolkit

Mode: Read. An extension of Lookout's existing workspace. Users browse categories, select a skill and read a practical usage manual with copyable agent requests. Opening a manual does not execute work. Preserve existing account and demo boundaries.

## Direction contract

THESIS: A usable field manual for the user's agent, organized by the career task. Lists and readable documentation take precedence over a dashboard of feature cards.

OWN-WORLD: Inherit Lookout's system sans, board surface/text/line tokens, lavender active links, rounded form controls and existing light/dark modes. No new palette, imagery or dependencies.

STORY: Find a skill, understand its inputs and expected output, copy an example to the connected agent. Show setup requirements. Source notices remain in repository attribution, not in the product interface.

FIRST VIEWPORT: Existing workspace navigation with Career Toolkit added. A title and short introduction above search; an icon-led category sidebar beside a compact two-column overview with two example skills per category. Selecting a category reveals its full list; mobile uses a labeled category selector. Manuals use breadcrumbs, a readable article and a contextual agent request panel.

FORM: User-specified category/list/manual structure, directly shaped in the incumbent system; no concept selection needed. Seed: user-specified-career-manual. Category choices have clear selected states; copying a request has accessible success/failure feedback. Mobile stacks navigation above content.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance.


## Documentation assessment — 2026-10-15

Reviewed the catalog and interview manual in desktop dark and mobile light captures against the incumbent Discover capture and module CSS. This is an ordinary system extension: `DESIGN.md` and `.impeccable/design.json` remain unchanged.

The surface preserves the inherited Inter/system stack, semantic board background/panel/text/muted/line/tag/accent/ink variables, shared shell width and navigation, global focus treatment, 6–12px control/panel corners, 44px primary control targets, restrained dividers, and existing light/dark modes. Category links, grouped rows and readable manuals implement the requested native structure; their column widths, article measure and responsive stacking are local composition choices rather than new global tokens. No raster assets are introduced.

Pre-existing documentation drift: the root token values describe the original lavender palette, while the live workspace overrides those variables with navy surfaces and pale blue accents (and blue actions in light mode). The sidecar navigation specimen also shows a five-column segmented grid; the incumbent shell now uses wrapping text navigation. The toolkit inherits the live variables and shell rather than repairing or propagating these older descriptions.


## Refinement assessment — 2026-10-15

Reviewed the updated overview, selected-category and manual captures at desktop dark and mobile light sizes, plus the toolkit components and CSS. Short category labels, two preview skills per category and explicit full-list links make the entry point easier to scan while preserving list-based navigation. Mobile replaces the category strip with a labeled native selector.

The local SVG family uses a consistent 24-unit outline, rounded strokes and inherited current color; icons accompany text labels and remain decorative to assistive technology. Overview dividers, category selection, manual headings and request controls retain the incumbent board tokens, typography, shell and light/dark behavior. These refinements introduce no new global palette, imagery or dependencies.

Manuals and editable agent requests no longer expose upstream branding or source URLs; repository attribution remains the provenance boundary. The earlier recorded palette/navigation documentation drift remains unchanged. `DESIGN.md` and `.impeccable/design.json` are preserved because this is a local refinement of the incumbent system.

“View all” category links move keyboard focus to the results heading and scroll it into view with a 24px margin, preserving orientation after the overview changes to a full category list.
