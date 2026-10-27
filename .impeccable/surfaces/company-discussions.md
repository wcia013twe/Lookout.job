# Company discussions

Mode: Operate. Code-led extension of Community within the existing workspace visual system.

## Purpose and composition

One search bar leads a company grid. Where you’re interviewing comes first, based on owned application and tracker progress at screen/interview stages; rejected, withdrawn and offer outcomes are excluded. Other companies come from readable published Circle threads. Shared posts never infer private interviewing progress.

Cards show company identity, owned role and current stage, preferring a scheduled milestone at the current process level. Inside each card, personal relevance precedes up to three actual published conversation titles, followed by a specific company browsing action. Each title opens the existing thread directly; source metadata preserves stage, date, author/type and differing role context. Ordering favors same-company stage, then role and reported-date relevance, without borrowing context from unrelated company attachments. All company discussions opens the existing company discussion list. No activity or people counts are displayed. Search covers permitted threads across current memberships, even when submitted from the company view. Back and clear restore the overview. Selected company state resets after opening an original thread or reloading; the Community Companies view itself remains in the URL.

## Visual contract

Inherit semantic board colors and Inter/system typography, shared company identity, fine panel borders, rounded controls, restrained accent states and 44px actions. Recommended tiles use a quiet accent tint. Preserve the existing full thread reader. The content is bounded to 1120px: two company columns above 700px, one below, with wrapping conversation titles and metadata. Support both themes, keyboard focus and reduced motion. No new global tokens or system primitives; preserve DESIGN.md and .impeccable/design.json.

## Evidence and states

The overview loads a bounded page of 50 permitted source threads; pagination explores additional sources. Tiles and topics are not global activity totals. Cards without loaded conversations invite company exploration or a question in the existing Circle, without claiming no older reports exist. Unknown dates remain explicit. Support loading, retryable errors, empty search, empty company discussions and recommendations without loaded previews.

The isolated, resettable demo includes a Bloomberg interviewing application with a fictional scheduled technical milestone whose date is unknown, and three fictional threads: technical experience, OA timeline and project preparation. These do not assert employer policy or verified recruiting behavior.

## Backend mapping and verification

Use existing knowledge.search with scope current_memberships (MCP search_circle_knowledge), knowledge.read (MCP read_circle_thread), and existing reviewed contribution/reply tools. Owned tracker/application timelines furnish recommendation context. No new backend service, global sharing, company statistics, autonomous Muse work or notifications.

Checked desktop1440 and mobile390 in both color themes, direct card-to-thread navigation, company browsing, reply entry, search/empty/clear, reload, source boundaries and overflow. The latest finish reviewer returned Ship for the card hierarchy, source metadata and direct actions. Documentation audit confirmed existing token/component consistency. Hosted deployment is outside this pass; see the feature change note for checks and limits.
