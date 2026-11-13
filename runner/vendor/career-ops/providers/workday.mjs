// @ts-check
/** @typedef {import('./_types.js').Provider} Provider */

// Workday provider — hits the public CXS jobs endpoint (POST, paginated).
// Auto-detects from careers_url pattern
// `https://<tenant>.<instance>.myworkdayjobs.com[/<locale>]/<site>`,
// e.g. https://23andme.wd5.myworkdayjobs.com/23 →
//      POST https://23andme.wd5.myworkdayjobs.com/wday/cxs/23andme/23/jobs
//
// Workday only exposes a relative "postedOn" label ("Posted Today",
// "Posted 5 Days Ago", "Posted 30+ Days Ago"); postedAt is derived from it
// and omitted for the unbounded "30+ Days Ago" form.

import { BROWSER_LIKE_USER_AGENT, fetchJsonWithRetry, sleep } from './_http.mjs';

// Why one paginated pass (the unfaceted root crawl, or one facet-split slice)
// stopped. COMPLETE covers both "ran out of pages" and "hit the offset
// ceiling" — `clamped` (derived separately) tells those two apart.
const STOP_REASON = {
  COMPLETE: 'complete',
  EARLY_STOP: 'early-stop',
  NO_DATE_SKIP: 'no-date-skip',
  FETCH_ERROR: 'fetch-error',
  CAP: 'cap',
};

// jobs.workdayTruncated: whether the board is worth a second attempt.
// TRANSIENT is a fetch failure that a plain retry can plausibly clear;
// STRUCTURAL is a fixed bound (facet-split depth/slice/page budget, or a
// split facet that materially under-covers the board) that a repeat run
// reaches again for the same result. Exported so scan-ats-full.mjs's retry
// gate reads the same values rather than its own copy of the strings.
export const WORKDAY_TRUNCATED_REASON = {
  TRANSIENT: 'transient',
  STRUCTURAL: 'structural',
};

const PAGE_SIZE = 20;

// Safety cap on pagination — applied regardless of what the upstream reports
// as `total` (or, when `total` is absent, regardless of how many full pages
// keep coming back), so a misbehaving/compromised API can't drive this into
// fetching an unbounded number of pages. Override with `max_pages` on the
// portal entry for a tenant that genuinely exceeds it.
const DEFAULT_MAX_PAGES = 100;
// Hard ceiling even for an explicit override. 1500 pages (30,000 postings)
// covers known large tenants (dollartree: 23,609; oreillyauto: 17,061;
// cvshealth: ~16,800) with headroom — not a completeness guarantee, since a
// company directory this size has no fixed upper bound.
const MAX_PAGES_CAP = 1500;

// Retry policy for transient page failures (429 rate-limit, 5xx, timeouts/aborts),
// via providers/_http.mjs's shared fetchJsonWithRetry. Workday's CXS API is
// fronted by a WAF that rate-limits in bursts; without retry, a single 429
// silently truncates an entire tenant (e.g. a 3,383-posting tenant reduced to
// 20 jobs on page 2). Non-transient errors (4xx other than 429) are not
// retried — retrying a malformed request just wastes the budget.
const RETRY_POLICY = { retries: 3 };

// Delay between successive pages *within one tenant's own pagination loop*
// (not between tenants — that's scan-ats-full.mjs's concurrency, a separate
// knob). A burst of same-host requests with zero delay risks Workday's
// WAF-level rate limiting on any tenant that paginates several pages deep
// (large boards like rollsroyce, sec, roche). Only tenants that loop past
// page 1 pay this; no-date-skip and early-stopped tenants never do.
const INTER_PAGE_DELAY_MS = 250;

// Offset past which some tenants' CXS backend stops paginating: it reports
// `total` as exactly 2000 and answers offset=2000/4000 with the same postings
// as offset=0. Raising max_pages buys duplicates, not coverage — see the facet
// split below for the way around it.
const WORKDAY_OFFSET_CEILING = 2000;

// How many times a slice may itself be split. Two levels turn a clamped board
// into (values of facet A) x (values of facet B) queries, which cleared every
// clamped tenant observed; the bound exists because a tenant that reports a
// clamp at every level would otherwise recurse until it runs out of facets.
const MAX_SPLIT_DEPTH = 2;

// Total slice queries one tenant may spend. A pathological facet (hundreds of
// values, each still clamped) must not turn one board into an unbounded crawl.
const MAX_SPLIT_SLICES = 100;

// Page budget for a whole tenant, as a multiple of max_pages. A clamped board
// is crawled once unfaceted and then once per slice, and slices overlap, so the
// page count is not bounded by the board size — this is what stops one
// pathological tenant from eating a sweep.
const SPLIT_PAGE_BUDGET_FACTOR = 5;

// Workday returns postings newest-first, so pagination can stop once a
// page's oldest *dated* posting is well past --since — no point paying for
// (and rate-limit-risking) pages that are entirely stale. Only unambiguous
// numeric ages ("Posted N Days Ago", N < 30) count for this; the unbounded
// "30+ Days Ago" bucket never triggers it, so a wide --since (>=30 days)
// simply never early-stops rather than risk a false stop.
//
// The sort isn't perfectly monotonic day-to-day — some tenants (e.g. Adobe)
// return day-labels slightly out of order across consecutive postings ("27
// Days Ago | 26 Days Ago | 27 Days Ago"), roughly 1 day of jitter. The
// margin only needs to clear that; 2 is double it as a plain safety factor,
// not a second measurement.
const EARLY_STOP_MARGIN_MS = 2 * 86_400_000;

/** Resolve the page cap: a positive integer `max_pages` on the entry, capped. */
function resolveMaxPages(entry) {
  const v = entry?.max_pages;
  if (Number.isInteger(v) && v > 0) return Math.min(v, MAX_PAGES_CAP);
  return DEFAULT_MAX_PAGES;
}

// ── Dead-tenant detection ────────────────────────────────────────
//
// The CXS API's 422/401/403 bodies carry no marker of their own (a bare
// `{"errorCode":"HTTP_422",...}`, identical whether the board is genuinely
// gone or just hit a transient WAF blip), so raw status alone isn't safe to
// hand to dead-boards.mjs — a spread sample of 1200 tenants (2026-09) found
// HTTP 500 failures whose careers page loads fine (live tenant, unrelated
// hiccup), and even 2 of 614 raw-422 tenants with a clean careers page.
// Two signals held across a repeat pass days later, always the same result:
// - 422, careers page bounces to `community.workday.com/maintenance-page`
//   (612 of 614 raw 422s, ~99.7%).
// - 401/403, careers page redirects to `*.myworkday.com/wday/drs/outage`
//   ("Workday is currently unavailable") — this is a per-board signal, not a
//   per-tenant one: a restricted/retired board on an otherwise-live tenant
//   (other boards on the same tenant answering normally) still redirects here
//   every time it's checked.
// Only page-0's request is checked — a tenant that fails mid-pagination
// already has this file's own transient/structural handling and isn't
// touched here.
const WORKDAY_MAINTENANCE_MARKER = 'community.workday.com/maintenance-page';
const WORKDAY_OUTAGE_REDIRECT_RE = /^https:\/\/[a-z0-9.-]+\.myworkday\.com\/wday\/drs\/outage(?:[/?]|$)/i;
const CONFIRMED_DEAD_API_STATUSES = new Set([422, 401, 403]);

/**
 * A page-0 CXS failure with one of these statuses is worth the one extra
 * careers-page fetch to check for Workday's own dead-board signals. Errors
 * are swallowed here (a failed probe proves nothing) — the caller rethrows
 * the original error either way, this only decides whether to relabel it as
 * a synthetic 404 so dead-boards.mjs's existing 404 path (shared with every
 * other provider) picks it up.
 */
async function confirmDeadViaCareersPage(ep, ctx) {
  try {
    const body = await ctx.fetchText(ep.jobBase, {
      redirect: 'manual',
      headers: { 'user-agent': BROWSER_LIKE_USER_AGENT, 'accept-language': 'en-US,en;q=0.9' },
    });
    // Every confirmed case so far reaches the marker through the catch below
    // (a non-2xx status) — this only guards the shape where a tenant serves
    // it on a 200 instead. Safe to check unconditionally: a known-live tenant
    // (tempus, 2026-09) does NOT carry this string on its 200 response, unlike
    // the outage-page URL, which is boilerplate present on every Workday page
    // regardless of health and is deliberately never checked on a 200 body.
    return typeof body === 'string' && body.includes(WORKDAY_MAINTENANCE_MARKER);
  } catch (err) {
    if (err.status >= 300 && err.status < 400) return WORKDAY_OUTAGE_REDIRECT_RE.test(err.location || '');
    return typeof err.body === 'string' && err.body.includes(WORKDAY_MAINTENANCE_MARKER);
  }
}

// ── Facet split ───────────────────────────────────────────────────
//
// Workday's CXS backend refuses to paginate past offset 2000 on some tenants,
// and reports `total` as exactly 2000 while doing it (dickssportinggoods: says
// 2000, its own facet counts add up to ~8,400, the public site lists 7,120+).
// Offsets 2000 and 4000 then return the same postings as offset 0, so raising
// `max_pages` buys duplicates, not coverage.
//
// The facet counts in the same response are not clamped, which gives both the
// detector and the way out: re-issue the query once per facet value, so a slice
// that fits under the ceiling paginates honestly.
//
// This recovers coverage; it does not guarantee completeness. Real boards are
// skewed — dickssportinggoods puts 6,564 of its 8,423 postings in one jobFamily
// value, and *inside that slice* every other facet is skewed the same way
// (Brand 6562/6564, timeType 6483/6499), so the dominant mass never splits
// below the ceiling. The split is therefore strictly additive on top of the
// unfaceted crawl, and a board it could not finish keeps the workdayTruncated
// tag rather than being reported as complete.

/**
 * Sum one facet's value counts; null when none of its values carry a count.
 *
 * Reads a facet's own `values` only. Nested children are deliberately not
 * summed — see the trap documented on `chooseSplitFacet()` (#3875).
 */
function facetCoverage(facet) {
  const values = Array.isArray(facet?.values) ? facet.values : [];
  let sum = 0;
  let counted = 0;
  for (const v of values) {
    if (!Number.isInteger(v?.count) || v.count < 0) continue;
    sum += v.count;
    counted++;
  }
  return counted > 0 ? sum : null;
}

/**
 * Board size according to the facets, or null when no facet carries counts.
 *
 * Each facet partitions the same board, so any one of them should sum to the
 * true total; they disagree slightly in practice (a posting missing a facet
 * value is absent from that facet's counts), so take the largest — the reading
 * that under-reports least. Compared against the response's own `total` by the
 * caller: facets materially higher means `total` is clamped.
 *
 * Exported for the test suite, which pins the DSG numbers.
 */
export function trueTotalFromFacets(facets) {
  let best = null;
  for (const facet of Array.isArray(facets) ? facets : []) {
    const coverage = facetCoverage(facet);
    if (coverage === null) continue;
    if (best === null || coverage > best) best = coverage;
  }
  return best;
}

/**
 * Pick the facet to split a clamped board on, or null when none can.
 *
 * Chooses the facet with the smallest largest-slice, since that slice is the
 * one at risk of still being clamped and needing another split. Facets whose
 * values lack an `id` are unusable as a filter (live tenants ship id-less group
 * headers like `locationMainGroup`), and a facet with fewer than two usable
 * values is not a partition at all — applying it just re-fetches the same board
 * under a filter, which turns the split into a spin.
 *
 * `exclude` carries the facet parameters already applied further up the split,
 * without which re-splitting a slice would keep re-deriving the same partition.
 *
 * Descending into those id-less headers' nested children looks like a free
 * improvement — more values, a finer partition — and is a trap. On
 * dickssportinggoods|wd1|dsg (measured 2026-08-28) `locationMainGroup` carries
 * 2 group parents whose 938 nested children sum to 16,732 against a board of
 * ~8,366: almost exactly 2.00x, because a requisition open in several locations
 * is counted once per location. Every other counted facet on that board agrees
 * within 0.9% and errs downward. Since `trueTotalFromFacets()` takes the
 * maximum, recursing would double the true total, make every healthy board
 * compare its honest `total` against it and read as offset-clamped, and hand
 * `workdayTruncated` to boards that were complete — a silent failure that looks
 * like success. The `id` filter below is what keeps that shut; it is
 * load-bearing, not tidiness. See #3875; pinned by the nested-shape fixture in
 * tests/providers/workday-facet-split.test.mjs.
 *
 * Exported for the test suite.
 */
function normalizedHintValues(values) {
  return (Array.isArray(values) ? values : [])
    .filter((value) => typeof value === 'string' && value.trim())
    .map((value) => value.trim().toLowerCase());
}

function facetLooksLikeLocation(facet) {
  const identity = `${facet?.facetParameter || ''} ${facet?.descriptor || ''}`.toLowerCase();
  return /location|country|region|state|province|city|remote|geography|geo/.test(identity);
}

function locationValueScore(value, hints) {
  const text = String(value?.descriptor || '').trim().toLowerCase();
  if (!text) return -1;
  const alwaysAllow = normalizedHintValues(hints?.always_allow);
  const allow = normalizedHintValues([...(hints?.allow || []), ...(hints?.positive || [])]);
  const block = normalizedHintValues([...(hints?.block || []), ...(hints?.block_hard || [])]);
  if (block.some((term) => text.includes(term)) && !alwaysAllow.some((term) => text.includes(term))) return -1;
  if (alwaysAllow.some((term) => text.includes(term))) return 3;
  if (allow.some((term) => text.includes(term))) return 2;
  return 0;
}

/**
 * Pick a facet to split a clamped board on, preferring user-configured
 * locations when the caller supplies location_filter hints. A matching
 * location value may be the only useful slice (for example, Toronto among
 * dozens of US cities), so the location-aware path may return one value while
 * the generic fallback retains the historical two-value partition rule.
 */
export function chooseSplitFacet(facets, { exclude = [], locationHints } = {}) {
  const skip = new Set(exclude);
  const candidates = [];
  let best = null;
  for (const facet of Array.isArray(facets) ? facets : []) {
    const facetParameter = facet?.facetParameter;
    if (typeof facetParameter !== 'string' || !facetParameter || skip.has(facetParameter)) continue;
    const values = (Array.isArray(facet.values) ? facet.values : []).filter(
      (v) => typeof v?.id === 'string' && v.id && Number.isInteger(v?.count) && v.count >= 0,
    );
    if (values.length < 2) continue;
    candidates.push({ facet, values });
    const largest = Math.max(...values.map((v) => v.count));
    // Tie-break on value count: a finer partition leaves less to re-split.
    if (best === null || largest < best.largest || (largest === best.largest && values.length > best.values.length)) {
      best = { facetParameter, values, largest };
    }
  }

  if (locationHints && typeof locationHints === 'object') {
    const locationCandidates = candidates
      .filter(({ facet }) => facetLooksLikeLocation(facet))
      .map(({ facet, values }) => ({
        facetParameter: facet.facetParameter,
        values: values
          .map((value) => ({ value, score: locationValueScore(value, locationHints) }))
          .filter(({ score }) => score > 0)
          .sort((a, b) => b.score - a.score || b.value.count - a.value.count)
          .map(({ value }) => value),
      }))
      .filter(({ values }) => values.length > 0);
    if (locationCandidates.length > 0) {
      locationCandidates.sort((a, b) => b.values.length - a.values.length);
      return locationCandidates[0];
    }
  }

  return best ? { facetParameter: best.facetParameter, values: best.values } : null;
}

/**
 * True once a page's oldest unambiguously-dated posting is past the --since window.
 *
 * Undated postings are invisible here. A page of nothing but undated postings
 * never stops pagination (the `dated.length === 0` guard), but a page that
 * mixes stale dated postings with undated ones does — and the undated ones on
 * later pages are then never fetched, even though scan.mjs's date filters
 * would have accepted them. Exported for test-all.mjs, which pins that
 * behaviour so it can't drift without the docs drifting too.
 */
export function pageIsPastWindow(pageJobs, sinceMs) {
  if (typeof sinceMs !== 'number') return false;
  const dated = pageJobs.map((j) => j.postedAt).filter((v) => typeof v === 'number');
  if (dated.length === 0) return false;
  return Math.min(...dated) < sinceMs - EARLY_STOP_MARGIN_MS;
}

// A careers page: `https://{tenant}.{instance}.myworkdayjobs.com[/{locale}]/{site}`.
const CAREERS_RE = /^https:\/\/([\w-]+)\.(wd[\w-]*)\.myworkdayjobs\.com\/(?:[a-z]{2}-[A-Z]{2}\/)?([^/?#]+)/;
// The CXS endpoint itself: `https://{host}.{instance}.myworkdayjobs.com/wday/cxs/{tenant}/{site}[/jobs|/job/...]`.
// This is the *resolved* form, not a careers page — it already carries the
// tenant and site in its path. It also passes CAREERS_RE (same host shape),
// where `([^/?#]+)` captures the literal `wday` as the site and yields a
// nonexistent `/wday/cxs/{tenant}/wday/jobs` endpoint: a live board silently
// reports zero jobs and then reads as unreachable (#3498). Matched first so a
// hand-verified CXS `api:` is honored as written instead of corrupting the entry.
const CXS_RE = /^https:\/\/([\w-]+)\.(wd[\w-]*)\.myworkdayjobs\.com\/wday\/cxs\/([\w-]+)\/([^/?#]+)(?:\/jobs)?(?:[/?#]|$)/;
// A myworkdaysite tenant: `https://{instance}.myworkdaysite.com/recruiting/{tenant}/{site}`.
// Same Workday product, but the tenant lives in the PATH, not the hostname —
// so neither CAREERS_RE nor CXS_RE matches it and every such board silently
// threw "cannot derive CXS endpoint".
const SITE_RE = /^https:\/\/([\w-]+)\.myworkdaysite\.com\/recruiting\/([\w-]+)\/([^/?#]+)/;

function makeEndpoint(origin, tenant, site) {
  return {
    api: `${origin}/wday/cxs/${tenant}/${site}/jobs`,
    // externalPath is relative to the site, not the host root — without the
    // site segment the URL 404s.
    jobBase: `${origin}/${site}`,
    // Same externalPath against the CXS host instead of the careers host
    // returns the posting's DETAIL document (GET, no body). That is the only
    // place a multi-location posting's real places exist — see
    // MULTI_LOCATION_PLACEHOLDER_RE.
    cxsBase: `${origin}/wday/cxs/${tenant}/${site}`,
    origin,
  };
}

// myworkdaysite's public posting path is /recruiting/{tenant}/{site}{externalPath},
// unlike myworkdayjobs' /{site}{externalPath} — so jobBase differs even though
// the CXS shape is identical.
function makeSiteEndpoint(host, tenant, site) {
  const origin = `https://${host}`;
  return {
    api: `${origin}/wday/cxs/${tenant}/${site}/jobs`,
    jobBase: `${origin}/recruiting/${tenant}/${site}`,
    cxsBase: `${origin}/wday/cxs/${tenant}/${site}`,
    origin,
  };
}

function resolveEndpoint(entry) {
  // Try api: first, then careers_url (mirrors greenhouse/ashby), returning the
  // first that matches the Workday tenant pattern. This lets a branded page
  // (e.g. https://www.ptc.com/en/careers) stay as careers_url while the Workday
  // tenant URL is pinned via api: — and, because we fall through on a non-match,
  // a non-Workday api: value doesn't shadow a valid careers_url.
  //
  // Either candidate may be given in either form; whichever matches resolves to
  // the same endpoint, so adding a correct api: never changes what careers_url
  // alone would have produced.
  for (const url of [entry.api, entry.careers_url]) {
    if (typeof url !== 'string' || !url) continue;
    const cxs = url.match(CXS_RE);
    if (cxs) {
      const [, host, instance, tenant, site] = cxs;
      return makeEndpoint(`https://${host}.${instance}.myworkdayjobs.com`, tenant, site);
    }
    const siteMatch = url.match(SITE_RE);
    if (siteMatch) {
      const [, instance, tenant, siteName] = siteMatch;
      return makeSiteEndpoint(`${instance}.myworkdaysite.com`, tenant, siteName);
    }
    const m = url.match(CAREERS_RE);
    if (!m) continue;
    const [, tenant, instance, site] = m;
    return makeEndpoint(`https://${tenant}.${instance}.myworkdayjobs.com`, tenant, site);
  }
  return null;
}

// Workday externalPath is `/job/{Location}/{Title-slug}_{REQ}(-{n})?`. The req token
// is the ANCHORED trailing segment — that anchoring is the whole point.
//
// An earlier version corroborated bulletFields with `externalPath.includes(v)`, which
// is unanchored, and externalPath always embeds the location slug — so bulletFields
// ["Burbank"] against /job/Burbank/Sr-Analyst_10154966 was "corroborated" and returned
// "Burbank" as the requisition id. Two unrelated Burbank reqs then shared an id. The
// check certified exactly the value it was written to exclude.
//
// The token is everything after the FIRST underscore of that segment, the
// boundary workdayDedupKey() uses: Workday title slugs use hyphens, never
// underscores, so an id like "JR_2024_00123" stays whole (taking the LAST
// underscore read it as "00123" while the dedup key read "jr_2024_00123" —
// CodeRabbit, #4076). Hyphens stay in the token too: Walmart posts
// "R-2593225", which an earlier `(?:-\d+)?$` tail cut to "R". Workday's own
// cross-site "-N" repost suffix is stripped by the dedup key's rule. Both
// callers go through reqTokenFromSegment(), so the captured requisitionId and
// the key cannot disagree; the id keeps the ATS's casing, only the key lowercases.
const REQ_TOKEN_CHARS_RE = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

function reqTokenFromSegment(segment) {
  const underscoreIdx = segment.indexOf('_');
  if (underscoreIdx === -1) return '';
  return stripRepostSuffixKeepCase(segment.slice(underscoreIdx + 1));
}

// Position alone does not identify a req. A segment with no requisition after
// its underscore — `/job/Remote/Data_Scientist` — leaves the word "Scientist",
// and two unrelated postings ending in the same word would share an id and a
// dedup key: the same collision the location slug used to cause, one layer along.
//
// A Workday req id always carries at least one digit (R167982, 10154966, JR113711);
// a title word never does. Validating the token's SHAPE is what separates them, and
// it is why bulletFields corroboration is not needed: the format check is stronger
// than a free-text match against a field with no guaranteed slot. The captured id
// and workdayDedupKey() both go through this check, so neither keys on a word.
const REQ_SHAPE_RE = /\d/;

/** @param {string} segment @returns {string} the validated token, or '' */
function validReqToken(segment) {
  const token = reqTokenFromSegment(segment);
  if (token.length < 3 || !REQ_TOKEN_CHARS_RE.test(token)) return '';
  return REQ_SHAPE_RE.test(token) ? token : '';
}

function reqTokenFromPath(externalPath) {
  if (typeof externalPath !== 'string') return undefined;
  return validReqToken(externalPath.split('/').filter(Boolean).pop() || '') || undefined;
}

// bulletFields is deliberately NOT consulted. It is tenant-configurable free text
// (location, job family, req number, …) with no guaranteed slot, so it cannot
// identify a req on its own — and as corroboration it added nothing the anchored
// path match had not already established.
function reqFromWorkday(j) {
  return reqTokenFromPath(j.externalPath);
}

function parsePostedOn(label) {
  if (!label) return undefined;
  if (/posted\s+today/i.test(label)) return Date.now();
  if (/posted\s+yesterday/i.test(label)) return Date.now() - 86_400_000;
  const m = label.match(/posted\s+(\d+)(\+?)\s*day/i);
  if (!m || m[2] === '+') return undefined; // "30+ Days Ago" — unbounded, no usable date
  return Date.now() - Number(m[1]) * 86_400_000;
}

// Workday URL path encodes location as /job/{Location-Slug}/{title-slug}.
// Use it as fallback when locationsText is absent (common on some tenants).
function locationFromPath(externalPath) {
  const m = String(externalPath || '').match(/\/job\/([^/]+)\//);
  if (!m) return '';
  let segment;
  try { segment = decodeURIComponent(m[1]); } catch { segment = m[1]; }
  return segment.replace(/-/g, ' ');
}

// A Workday tenant can publish the same requisition under several sites
// (careers page, Indeed feed, Glassdoor feed, ...) — same tenant/instance
// host, different `site` path segment, so normalizeUrlForDedup's per-URL
// comparison never recognizes them as the same posting (#3439). The
// requisition ID is the authoritative identifier, and it's the last
// underscore-delimited segment of the URL's last path component: Workday's
// own title slug uses HYPHENS for spaces ("Staff-Engineer"), never
// underscores, so the FIRST underscore in that segment is always the
// title/requisition-ID boundary — everything after it is the requisition ID
// even when the ID itself contains further underscores (e.g. "JR_2024_00123").
//
// Scoped by hostname, not just the tenant subdomain: hostname already
// encodes both tenant AND instance (tenant.instance.myworkdayjobs.com), and
// two different tenants/instances coincidentally sharing a requisition ID
// string must never collapse to the same key.
//
// Workday appends its own `-2` / `-3` disambiguator to the requisition tail
// when the SAME requisition is the one being republished on a second or
// third site (credit: ronanime-arch, PR #3446 — measured live, one
// requisition filled 3 of 7 results in a sweep). Left un-stripped, that
// disambiguator defeats the entire point of this function: the three sites'
// URLs would each key to a different requisition ID and never collapse.
/**
 * Lowercase a raw requisition token and drop Workday's cross-site repost
 * disambiguator, a trailing `-N`. The suffix is a disambiguator only when two
 * things hold (credit: ronanime-arch, PR #3446):
 *   - N is one or two digits. This is what keeps Walmart's "R-2593225" whole:
 *     a seven-digit tail never splits, so the base check never runs.
 *   - What precedes it is requisition-ID-shaped on its own: a digit, then 2+
 *     trailing digits, underscores allowed. This is what keeps a short "R-25"
 *     whole — its base "r" has no digit.
 *
 * A hyphenated base ("req-271559-1", "jr-017459-2") is admitted too (#3882),
 * but only with a single-digit 1-9 counter, the only values Workday was seen
 * to emit. A tenant numbering its own IDs "req-2026-01".."-12" must not start
 * folding into one key: "-01".."-09" are zero-padded and "-10".."-12" are two
 * digits, so all twelve stay distinct. An unpadded "req-2026-1".."-9" sibling
 * set cannot be told apart from a republish by the ID string alone and does
 * fold — an accepted limitation, see #3882. Bases without a hyphen keep
 * exactly the rule they had, so no key they produced before moves (scan
 * history is re-keyed through workdayDedupKey).
 *
 * Shared with scan.mjs's `requisitionIdForDedup` so that a tracker note which
 * copied the URL tail (`req JR25919-1`) and the URL itself name the same
 * requisition: without one rule for both, the note read as `259191` while the
 * URL read as `25919`, and the already-applied posting was re-queued as a new
 * requisition (PR #4267 review).
 *
 * @param {unknown} raw - Token as found after the URL's `_` or a note's label.
 * @returns {string} Lowercased requisition ID ('' when `raw` is empty).
 */
export function stripWorkdayRepostSuffix(raw) {
  const token = raw == null ? '' : String(raw).toLowerCase();
  return stripRepostSuffixKeepCase(token);
}

// The same rule without the lowercasing, for the captured requisitionId,
// which keeps the ATS's own casing ("R-2593225"). Only the
// dedup key is lowercased.
function stripRepostSuffixKeepCase(token) {
  const m = token.match(/^(.*?)-(\d{1,2})$/);
  if (!m) return token;
  const base = m[1];
  // Case-insensitive: the captured requisitionId keeps the ATS's casing
  // ("R-2593225-1"), so a lowercase-only class would leave its suffix on and
  // the id would disagree with the base posting's (CodeRabbit, #4076). The
  // dedup key arrives lowercased already, so /i changes nothing for it.
  const isDisambiguator = base.includes('-')
    ? /^[a-z-]*\d[a-z0-9_-]*\d{2,}$/i.test(base) && /^[1-9]$/.test(m[2])
    : /^[a-z]*\d[a-z0-9_]*\d{2,}$/i.test(base);
  return isDisambiguator ? base : token;
}

/**
 * Whether a URL points at a Workday-hosted posting.
 *
 * @param {unknown} url
 * @returns {boolean|null} `true`/`false` for a parseable URL, `null` when
 *   `url` is absent or unparseable (no evidence either way).
 */
export function isWorkdayJobUrl(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  return /\.myworkday(jobs|site)\.com$/.test(parsed.hostname.toLowerCase());
}

export function workdayDedupKey(job) {
  // Non-Workday URLs must fall back to normalized-URL dedup, not produce a
  // bogus workday: key just because their last path segment happens to
  // contain an underscore (e.g. a Lever/Greenhouse job whose slug does) —
  // reported by CodeRabbit against this exact function.
  if (!isWorkdayJobUrl(job?.url)) return null;
  const parsed = new URL(job.url);
  const segments = parsed.pathname.split('/').filter(Boolean);
  const lastSegment = segments[segments.length - 1];
  if (!lastSegment) return null;
  // Same validated token as the captured requisitionId; only the key is
  // lowercased. No requisition-shaped token (no underscore, or only a title
  // word after it) means nothing to key on, and URL dedup takes over.
  const reqId = validReqToken(lastSegment).toLowerCase();
  if (!reqId) return null;
  let scope = parsed.hostname.toLowerCase();
  // One myworkdaysite.com host serves many tenants (/recruiting/{tenant}/{site}):
  // scope by the path tenant but not {site}, so one tenant's cross-site reposts
  // still collapse. Colon-free: scan.mjs reads the ID after the second colon.
  if (scope.endsWith('.myworkdaysite.com')) {
    const tenant = parsed.pathname.match(/^\/recruiting\/([\w-]+)\//)?.[1];
    if (!tenant) return null;
    scope += `/recruiting/${tenant.toLowerCase()}`;
  }
  return `workday:${scope}:${reqId}`;
}

// Workday's LIST endpoint answers a posting attached to more than one location
// with a COUNT where every other posting carries a place: `"53 Locations"`. It
// is not a location, and `buildLocationFilter` matches locations by
// case-insensitive substring, so the string contributes nothing to any tier —
// the posting is then judged on `locationHintFromUrl` alone, which carries only
// the posting's PRIMARY location (`/job/USA---Sunnyvale-CA/…`). A role open in
// Sunnyvale AND Austin is therefore invisible to an `allow: [austin]` config
// (#3860).
//
// Measured live on three tenants (60 page-0/1/2 postings each, 2026-09-07):
// placeholders are 53 of 291 postings — crowdstrike 23, nvidia 29, cvshealth 1
// — so this is an ordinary case, not an edge one. Against `allow:
// [united states, usa, remote]`, 23 of those 53 were rejected while a real
// location would have passed; against `allow: [austin, new york]`, 17.
//
// Anchored, and `Locations?` singular-tolerant: it must not fire on a real
// place that merely contains a digit and the word ("100 Locations Plaza").
const MULTI_LOCATION_PLACEHOLDER_RE = /^\s*\d+\s+locations?\s*$/i;

/**
 * True when a Workday list location is the count-placeholder rather than a place.
 * Exported for tests/providers/workday-multi-location.test.mjs, which pins the boundary cases.
 *
 * @param {unknown} location - `locationsText` as the list endpoint returned it.
 * @returns {boolean}
 */
export function isMultiLocationPlaceholder(location) {
  return typeof location === 'string' && MULTI_LOCATION_PLACEHOLDER_RE.test(location);
}

// How many detail GETs one entry may spend to resolve placeholders — every
// request the tenant sees, retries included, not one per posting. The
// enrichment is one extra GET per placeholder posting, and nvidia ran 29
// placeholders in 60 postings — a 2,000-posting tenant at that rate would add
// ~1,000 requests, which is a different kind of scan than the one the caller
// asked for. The cap bounds that; it is deliberately loud rather than silent
// (see the console.error below), because a silent cap reads as "all locations
// resolved" when it isn't.
const MAX_DETAIL_REQUESTS = 200;

/**
 * The real places behind a multi-location placeholder, from the detail document.
 *
 * Measured on cvshealth/crowdstrike/nvidia (7 of 7 probes, then 53 of 53):
 * `jobPostingInfo.location` holds the primary place and
 * `jobPostingInfo.additionalLocations` the rest, and
 * `1 + additionalLocations.length` equals the number the placeholder announced
 * every single time. `jobPostingInfo.locationsText` does not exist at this
 * level, so there is nothing else to read.
 *
 * Joined with `' · '` — the separator greenhouse/ashby/eightfold/gem/ibm/
 * echojobs already use for exactly this, and the one
 * `normalizeLocationForDedup` (scan.mjs) splits back into a sorted SET, so the
 * order Workday happens to return does not reach a dedupe key.
 *
 * @param {unknown} detail - Parsed detail document.
 * @returns {string} `' · '`-joined places, or '' when the document has none.
 */
export function locationsFromDetail(detail) {
  const info = detail?.jobPostingInfo;
  if (!info || typeof info !== 'object') return '';
  const extra = Array.isArray(info.additionalLocations) ? info.additionalLocations : [];
  const places = [info.location, ...extra]
    .filter((p) => typeof p === 'string' && p.trim() !== '')
    .map((p) => p.trim());
  // Deduped: a tenant that repeats the primary place inside additionalLocations
  // would otherwise ship it twice into a user-visible field.
  return [...new Set(places)].join(' · ');
}

/**
 * The posting's real publication date, from the detail document.
 *
 * The list endpoint offers only `postedOn`, relative prose that `parsePostedOn`
 * turns into a coarse timestamp and that tops out at an unbounded "30+ Days
 * Ago" (→ `undefined`). The detail document carries `jobPostingInfo.startDate`,
 * an absolute date — so a posting we already paid a GET for can be dated
 * exactly instead of approximately.
 *
 * Deliberately stricter than `Date.parse` alone: `Date.parse` falls back to an
 * implementation-defined parse for anything non-ISO, so a tenant emitting some
 * other date format could yield a plausible-looking timestamp on one Node build
 * and NaN on another. Measured on cvshealth/crowdstrike/nvidia, 11 of 11 detail
 * documents returned a bare `YYYY-MM-DD` and none carried a time — but 11 is a
 * small sample and three further tenants could not be measured (their list
 * endpoint answers HTTP 422), so anything that is not an ISO-8601 date is left
 * alone rather than guessed at. `postedAt` then keeps its `parsePostedOn`
 * value, which is the pre-existing behaviour.
 *
 * Note the granularity change this implies for a posting whose `postedOn` said
 * "Posted Today": `Date.now()` becomes that day's UTC midnight, i.e. slightly
 * EARLIER. That cannot cost a posting its place in a `--since` window —
 * `resolveEffectiveAfter` truncates the cutoff to a date and
 * `buildPostedDateFilter` parses it as UTC midnight too (scan.mjs), so both
 * sides of the comparison are day-aligned.
 *
 * A second direction applies to the "Posted 30+ Days Ago" bucket.
 * `parsePostedOn` returns `undefined` for that label, so without enrichment the
 * posting carries no `postedAt` and passes any age-based filter
 * ("don't penalize missing data"). Once `startDate` provides the real date, the
 * posting is accurately dated and a `max_posting_age_days: 30` window can now
 * legitimately exclude it. The "undated passes" rule is a fallback for
 * ignorance, not a policy of inclusion; once the real date is in hand the filter
 * decision is correct, not stricter.
 *
 * @param {unknown} detail - Parsed detail document.
 * @returns {number|undefined} Epoch ms, or undefined when there is no usable date.
 */
export function postedAtFromDetail(detail) {
  const raw = detail?.jobPostingInfo?.startDate;
  if (typeof raw !== 'string') return undefined;
  const trimmed = raw.trim();
  // `YYYY-MM-DD`, or a time form that states its offset (`Z` / `±HH:MM`).
  //
  // The offset is REQUIRED once a time is present, and that is the whole point
  // of this branch: Date.parse resolves a date-only string as UTC, and a
  // date-time carrying Z or an offset as that offset, but a date-time WITHOUT
  // one as the local time of whatever machine is scanning (ECMAScript
  // §21.4.3.2). Measured: `2026-09-04T08:30:00` is 08:30Z on a UTC box, 12:30Z
  // in America/New_York and 2026-09-**03**T23:30Z in Asia/Tokyo — the day
  // itself moves. Since `--since` is compared day-against-day, that would make
  // the same posting eligible on one machine and not on another. Such a string
  // does not say which day it means, so it is left unparsed and `postedAt`
  // keeps its `parsePostedOn` value.
  const shape = /^(\d{4})-(\d{2})-(\d{2})(T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2}))?$/.exec(trimmed);
  if (!shape) return undefined;
  // The shape above still admits a date that does not exist, and `Date.parse`
  // does NOT reject those — it rolls them over (`2026-02-30` parses as
  // 2026-03-02; measured on this Node, not assumed). A silently shifted date is
  // worse than no date, so the calendar is checked on the Y-M-D components
  // themselves. Doing it on the components rather than on the parsed timestamp
  // keeps a legitimate offset form like `...T23:00:00-05:00`, whose UTC day is
  // the NEXT one, from being thrown away as a rollover.
  const [, y, m, d] = shape;
  const asUtc = new Date(0);
  // setUTCFullYear, not Date.UTC: Date.UTC maps a year of 0..99 onto 19xx, so
  // Date.UTC(26, ...) is 1926 and the equality check below would reject the
  // perfectly real date `0026-05-05`. Irrelevant to any live job posting, but
  // this reads as a general ISO-8601 check and should not lie about one.
  asUtc.setUTCFullYear(Number(y), Number(m) - 1, Number(d));
  if (asUtc.getUTCFullYear() !== Number(y) || asUtc.getUTCMonth() !== Number(m) - 1 || asUtc.getUTCDate() !== Number(d)) {
    return undefined;
  }
  const ms = Date.parse(trimmed);
  return Number.isFinite(ms) ? ms : undefined;
}

export function parseWorkdayResponse(json, entry) {
  const ep = resolveEndpoint(entry);
  const jobBase = ep?.jobBase || '';
  const postings = Array.isArray(json?.jobPostings) ? json.jobPostings : [];
  const jobs = [];
  for (const j of postings) {
    if (j == null) continue;
    if (!j.externalPath || !String(j.title || '').trim()) continue;
    jobs.push({
      title: j.title || '',
      url: jobBase + j.externalPath,
      company: entry.name,
      // The req token, NOT the whole externalPath. externalPath embeds the title
      // slug, so it changes on exactly the title drift this capture exists to survive
      // (Adobe: "Associate--Corporate-Strategy_R167982" -> "Sr-Associate--…_R167982-1"
      // — the path moved, R167982 did not). Abstain when no token is recoverable
      // rather than emitting an unstable key.
      //
      // No externalId: the list API exposes no posting id, and this token is a
      // REQUISITION — every site a req is cross-posted to carries the same one
      // (the "-1"/"-2" suffix stripped above), so it cannot be the per-posting key
      // externalId promises (CodeRabbit, #4297).
      requisitionId: reqFromWorkday(j),
      location: j.locationsText || locationFromPath(j.externalPath),
      postedAt: parsePostedOn(j.postedOn),
    });
  }
  return jobs;
}

/** @type {Provider} */
