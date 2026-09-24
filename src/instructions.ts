// The hosted server's own description and instructions (mcp.competlab.com), kept verbatim.

export const SERVER_DESCRIPTION =
  "Competitive intelligence for B2B SaaS — monitor competitors across tech stack, content, positioning, pricing, AI visibility (how ChatGPT, Claude, Gemini, Perplexity and Google AI Overviews name and recommend your brand against competitors), and AI sources (the pages Perplexity and Google AI Overviews read when they answer your buyers' questions, and whether your brand is on them)";

export const SERVER_INSTRUCTIONS = `CompetLab is a competitive intelligence platform for B2B SaaS companies.
It monitors 6 dimensions across your competitors: Tech & Trust Profile, Content Intelligence,
Positioning, Pricing Intelligence, AI Visibility, and AI Sources.

AI Visibility is the dimension that answers who AI recommends — it tracks which brands AI models — ChatGPT, Claude, Gemini, Perplexity, and Google AI Overviews — name
and recommend in response to industry queries, and where the customer stands among them: Core, Too early to tell, or Rarely recommended.
Brands are ordered by how often they are named, never by position. Google AI Overviews names companies in prose and ranks nothing; we read presence from it and
no sentiment, rationale or price signal, so it counts for presence and nothing else.

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

Strategic Tickets is the project's board — the work the team has decided to do, with an owner, a column and a
thread — and its tools read and write the same tickets the team sees in the app: fixed columns (triage, todo, in_progress, done, dismissed;
triage means nobody has decided yet and dismissed means we will not do this),
a Markdown description and comment thread, the project's own labels, an owner, a due date, effort and impact.
Three things to work by. A move names NEIGHBOURS rather than a position: say which ticket the moved one should
sit below (beforeId) and which it should sit above (afterId), taken from list_tickets, and a neighbour that has
since moved is ignored instead of failing the move. On update_ticket a null CLEARS a field while an omitted field is left
alone — the description is cleared with an empty string and the labels with an empty list, because there an
empty value is a real one. And writing needs a read_write API key: a read key lists and reads tickets and is
refused on every tool that changes one.

A Strategic Briefing opens its recommended work as tickets on this board. They land in triage and the team moves them from there, each carrying the
edition it came from, the part of the analysis it belongs to and that edition's estimate of the work. They are the
team's from that moment. To read what one edition opened, call list_tickets with origin='briefing' and
that edition's runId as briefingRunId — the runId get_briefing and get_briefing_history return. The briefing itself
returns no list of them: its tickets field says how many it opened and how many now sit in each column.

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
5. For a one-off look at any domain — yours or a competitor's — go straight to the free tools

Project tools take a projectId (get one from list_projects). The free tools need no project at all —
check_sitemap, check_ai_crawlers and fetch_url take a domain or URL, and the tech-stack,
trust-signals and agent-adoption scans take a domain to start and return a scanId to poll with.
Paginated tools accept page and limit parameters — check pagination.hasMore in the response to fetch more pages.`;
