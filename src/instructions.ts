// The hosted server's own description and instructions (mcp.competlab.com), kept verbatim.

export const SERVER_DESCRIPTION =
  "Competitive intelligence for B2B SaaS — monitor competitors across tech stack, content, positioning, pricing, AI visibility (how ChatGPT, Claude, Gemini, Perplexity and Google AI Overviews name and recommend your brand against competitors), and AI sources (the pages Perplexity and Google AI Overviews read when they answer your buyers' questions, and whether your brand is on them)";

export const SERVER_INSTRUCTIONS = `CompetLab is a competitive intelligence platform for B2B SaaS companies.
It monitors 6 dimensions across your competitors: Tech & Trust Profile, Content Intelligence,
Positioning, Pricing Intelligence, AI Visibility, and AI Sources.

The unique dimension is AI Visibility — it tracks which brands AI models — ChatGPT, Claude, Gemini, Perplexity, and Google AI Overviews — name
and recommend in response to industry queries, and whether the customer is one of them — in the core, in the tail, or not named at all.
Brands are ordered by how often they are named, never by position. Google AI Overviews names companies in prose and ranks nothing; we read presence from it and
no sentiment, rationale or price signal, so it counts for presence and nothing else. No other CI platform does this.

AI Sources is its companion. For the engines that hand back the pages they retrieved while
answering — Perplexity and Google AI Overviews — it asks a project's 8 buying questions,
reads those pages, and reports PER ENGINE which companies the engine named, which pages it
retrieved, and which of those pages name the brand's competitors and not the brand. Three rules govern
every figure there: RETRIEVED, never cited — the engines do not say which pages they leaned on;
PER ENGINE, never pooled — the engines read different pages, and a combined page count describes a
list none of them produced; and COUNTS, never rates — report figures as n of N answers and never as
a percentage or a share, because the question set is small by design and a share computed from it is
false precision. A page we could not read is listed and never counted as a page the brand
is absent from.

READING THE DATA — this rule governs every tool below.

null means WE DID NOT MEASURE IT. It never means zero, empty, false, or "no".

Monitoring the open web fails in ordinary ways: a site times out, blocks our crawler, or has no
pricing page. When that happens the field is null. A measured value is always reported as itself —
a real 0 trust signals, a real false for "has a free plan", a real empty list — so those stay
reportable competitive findings. Only the unmeasured case is null.

Where a REASON exists it arrives in a sibling "…Available" object. But some nulls carry no such
object, because nothing failed: there was simply no comparison to make, or too little data to
compute one — gap figures with no competitor to compare against, market averages below the
minimum sample. A null with no marker beside it is still not a zero. Never infer "this must be a
real measurement" from the absence of a marker.

So: never write "they have no X" from a null. Say the check did not complete, and say what is
still known. "We could not measure it" and "we measured it and it is zero" are different facts and
must never be reported with the same sentence.

The same applies to counts and lists. A count is only meaningful with the set it was drawn from —
where a description names that set, quote it rather than inferring membership, and never assume a
category contains something it does not list. An empty list means we looked and found none; a null
list means we did not look.

Typical workflow:
1. Call list_projects to see available projects
2. Call get_project to see dimension freshness and status
3. Call dimension dashboard tools (e.g., get_pricing_dashboard) for the latest competitive data
4. Call list_alerts to see recent competitive changes

All tools require a projectId parameter (except list_projects).
Paginated tools accept page and limit parameters — check pagination.hasMore in the response to fetch more pages.`;
