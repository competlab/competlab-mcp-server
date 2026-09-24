import { z } from "zod";

const objectId = (desc: string) =>
  z
    .string()
    .regex(/^[a-f\d]{24}$/i, "Invalid ID format — must be a 24-character hex string")
    .describe(desc);

const pagination = {
  page: z.number().int().min(1).optional().describe("Page number (1-indexed, default: 1)"),
  limit: z
    .number()
    .int()
    .min(1)
    .max(100)
    .optional()
    .describe("Items per page (default: 20, max: 100)"),
};

// Clients routinely send JSON-schema booleans and integers as strings ("true", "0"). The hosted
// server accepts both forms instead of rejecting the call, and so does this one.
const booleanish = () =>
  z.union([
    z.boolean(),
    z.literal("true").transform(() => true),
    z.literal("false").transform(() => false),
  ]);

const zeroBasedIndex = () =>
  z.union([
    z.number().int().min(0),
    z
      .string()
      .regex(/^\d+$/, "promptIndex must be a non-negative integer")
      .transform(Number),
  ]);

export interface ToolAnnotations {
  readOnlyHint?: boolean;
  destructiveHint?: boolean;
  idempotentHint?: boolean;
  openWorldHint?: boolean;
}

export interface ToolDef {
  name: string;
  description: string;
  parameters: z.ZodObject<any>;
  path: (args: Record<string, any>) => string;
  method?: "GET" | "POST";
  queryParams?: string[];
  bodyParams?: string[];
  annotations?: ToolAnnotations;
}

// Names, descriptions, parameters and annotations match the hosted server at mcp.competlab.com.
export const tools: ToolDef[] = [
  // ── Projects ──────────────────────────────────────────────
  {
    name: "list_projects",
    description:
      "List all accessible projects with status, competitor count, and last monitored timestamp. " +
      "This is the starting point — use it to discover available projectId values for other tools.",
    parameters: z.object({}),
    path: () => "/v1/projects",
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
  {
    name: "get_project",
    description:
      "Get project details including per-dimension monitoring freshness (techTrust, content, positioning, pricing, aiVisibility), AI monitoring prompts, and overall status. " +
      "Use this to check when each dimension last produced data. " +
      "For aiVisibility that timestamp is the last check that published a measurement — a cycle that came back short is abandoned and never moves it, so neither an unchanged timestamp nor null proves nothing ran; get_ai_visibility_dashboard reports that case in latestCheckDataAvailable, and get_ai_visibility_trend reports it under events.incompleteCycles when nothing has ever published.",
    parameters: z.object({
      projectId: objectId("Project ID (from list_projects)"),
    }),
    path: (a) => `/v1/projects/${a.projectId}`,
    annotations: { readOnlyHint: true, openWorldHint: false },
  },

  // ── Competitors ───────────────────────────────────────────
  {
    name: "list_competitors",
    description:
      "List all competitors being monitored for a project. Includes the user's own domain (marked isOwn: true) for self-analysis comparison. " +
      "Each row carries id, domain, isOwn, preparationStatus (whether the competitor's data has been prepared for monitoring) and createdAt. " +
      "There is no display name on this list — the domain is the identity, and the brand name the AI models use for it lives on the AI Visibility market map.",
    parameters: z.object({
      projectId: objectId("Project ID (from list_projects)"),
    }),
    path: (a) => `/v1/projects/${a.projectId}/competitors`,
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
  {
    name: "get_competitor",
    description:
      "Get competitor details including monitored pages (homepage URL, pricing page URL). Use competitorId values from list_competitors.",
    parameters: z.object({
      projectId: objectId("Project ID (from list_projects)"),
      competitorId: objectId("Competitor ID (from list_competitors)"),
    }),
    path: (a) => `/v1/projects/${a.projectId}/competitors/${a.competitorId}`,
    annotations: { readOnlyHint: true, openWorldHint: false },
  },

  // ── Tech & Trust ──────────────────────────────────────────
  {
    name: "get_tech_trust_dashboard",
    description:
      "Get the latest Tech & Trust Profile for all competitors. " +
      "Returns security headers (grade A-F, HSTS, CSP, X-Frame-Options), trust signals, technology stack, AI access, DNS infrastructure. " +
      "AI ACCESS answers two independent questions per competitor, on `aiAccess`. " +
      "ANSWER ACCESS: which AI assistants may obtain their content, one verdict per assistant, each naming the crawlers that decided it. " +
      "TRAINING ACCESS: which model operators may train on it. They are separate facts with opposite valence. " +
      "AS A RULE, blocking a training crawler costs NO assistant visibility and is a legitimate content decision — do not report it as a problem, a gap, or something to undo, and never total the two into one score. " +
      "THE RULE HAS ONE EXCEPTION AND YOU MUST CHECK FOR IT BEFORE SUPPRESSING ANYTHING: a few tokens govern training AND an assistant at once, `Google-Extended` being the documented case, so where a crawler under `modelTrainingAccess[].decidedByCrawlers` ALSO appears under `assistantAccess[].decidedByCrawlers` — match on `userAgentToken` — that block does carry a visibility consequence and must be reported. " +
      "Suppressing it is how a site that closed itself to Gemini answers while believing it had only opted out of training goes unnoticed. " +
      "There is no aggregate boolean and no stored count: derive any total from the length of the array you are quoting, so the number and the names cannot disagree. " +
      "Nothing here measures whether an assistant actually mentions or cites anyone — it measures permission to obtain the content, which is a different thing and must be worded as such. " +
      "EVERY VERDICT SHIPS ITS OWN SENTENCES on `explanations`, generated from our crawler catalog. Render them; do not paraphrase them into your own claim. " +
      "They already encode what blocking each crawler costs, and how firmly a compliance claim may be worded — an operator's own words are quoted, a measurement is cited with its limits, a dispute is reported as a dispute, and `undocumented` means nobody has published either way and NEVER means the crawler ignores robots.txt. " +
      "`aiAccess.measurement.explanations` CARRIES THE SAME KIND OF SENTENCES ABOUT THE MEASUREMENT ITSELF. " +
      "Read it whenever `measurement.status` is not `measured`, and quote it rather than writing your own. " +
      "On `could_not_measure` it is the ONLY prose there is, because the verdict arrays and their per-verdict `explanations` are absent together. " +
      "On `measured_no_policy_found` the verdicts are PRESENT and complete — a site with no robots.txt allows every crawler under the standard, which is a measured result — and these sentences say that the openness follows from the standard's default rather than from anything the site wrote. " +
      "It is absent, never empty, when the file was read and the verdicts are the whole answer. EACH DECIDING CRAWLER SAYS WHICH RULE DECIDED IT. " +
      "`decidedByRuleFor` is `names_this_crawler` when a group naming it decided the outcome — a policy somebody chose — or `wildcard_catch_all` when the site's `User-agent: *` rule swept it up, which is frequently a rule written before that crawler existed. " +
      "`decidedByDirective` and `decidedByLineNumber` give the exact line. " +
      "That distinction is the actionable part: the two states look identical in a verdict and require editing different lines. " +
      "`rulesThatMayNotWork` names rules whose effect is uncertain BECAUSE OF THE CRAWLER'S OPERATOR — a published carve-out, or a measured refusal to honour disallows — never because of anything the site did wrong. " +
      "It never suggests replacing a token, and you must not either: telling a site its user-agent is obsolete requires a registry of live tokens that nobody publishes. " +
      "`rulesWithUnintendedScope` is its COUNTERPART and reads the opposite way: those rules worked exactly as written and simply did not reach the crawler named beside them, because the standard makes a group naming a crawler REPLACE the `User-agent: *` group rather than add to it. " +
      "So writing `User-agent: GPTBot` / `Allow: /` under a `*` group that closes three sections leaves GPTBot permitted in all three. " +
      "Report the mechanism and stop: whether the exemption was intended is not something we measure, and privileging AI crawlers over other traffic is a legitimate strategy — so never call it an error. " +
      "It is still worth surfacing, because the author may not know the standard works this way, and for a TRAINING token the exemption does cost the content protection they thought they had. " +
      "`affectedRules` is a FLOOR — only content-area directives are reported, not hygiene paths — and it belongs to the ONE crawler in its own finding, since the lists differ between crawlers in the same file. " +
      "Never quote one finding's rules against another's name. " +
      "`additionalObservations` carries our own coverage of that file, stated once with the universe it is drawn from; it is a disclosure of OUR limits, not a finding about them. " +
      "Trust signals are 26 specific things we look for on a HOMEPAGE, in five categories — compliance (6: SOC 2, ISO 27001, HIPAA, GDPR, CCPA, LGPD), reviews (6: G2, Capterra, Trustpilot, Gartner, TrustRadius, GetApp), social proof (5: Customer Logos, Customer Count, Case Studies, Money Back Guarantee, Free Trial), certifications (8: PCI DSS, FedRAMP, ISO 9001, ISO 14001, SOC 1, SOC 3, NIST, HITRUST) and disclosures (1: Privacy Policy). " +
      "A category count of 0 means none of THOSE signals was found and nothing more — it is not a verdict on the vendor's privacy, security or compliance posture, and you must never name a signal the list does not contain. " +
      "Evidence strength differs inside the compliance category: SOC 2, ISO 27001 and HIPAA match a rendered trust badge, but GDPR, CCPA and LGPD are text matches, so a consent banner or footer link registers one — report those three as 'the page mentions it', never as a compliance posture. " +
      "PIPEDA, PDPA and other regimes are not detected at all. " +
      "MOST OF THE NAMED PROGRAMMES ARE US OR EU, and that bounds every count you draw from this list: the six review platforms are the anglophone B2B SaaS review ecosystem, and the local platforms other markets use are not in the list at all. " +
      "Not the whole list, though — ISO 27001, ISO 9001, ISO 14001 and PCI DSS are held worldwide, and the social-proof and disclosure signals describe a practice rather than a programme, so they are market-neutral. " +
      "A vendor selling outside those markets typically scores on the market-neutral signals and near-zero on the named programmes, which is a fact about the vocabulary and not about them. " +
      "So when a total is low, say WHICH part is low; compare counts within a market rather than across markets; and read a 0 as 'this homepage does not show these particular credentials', never as 'not credentialed'. " +
      "All five trust-signal category counts are always present, and the denominators above applied to every check you can retrieve — there is no older shape for these counts. " +
      "This is a different taxonomy from the standalone trust-signals scan tool, which has its own wider list and its own categories — never quote one count against the other's categories. " +
      "ONE CATEGORY NAME COLLIDES, and it is the trap on this response: `socialProof` is a field on both, spelled identically, and both have exactly five members, so neither the name nor the count tells you they differ. " +
      "Here the five are customer logos, customer count claim, case studies, money-back guarantee and free trial. " +
      "In the scan they are customer logos, hero-only logos, customer count, case studies and testimonials. " +
      "So a `socialProof` of 3 from this tool and 4 from a scan is not a change, not an improvement and not a discrepancy — the two were never measuring the same set. " +
      "If you hold both numbers, report them separately or not at all. " +
      "`summary.trustComparisonState` tells you how to read `summary.trustSignalGap` so you do not have to infer it from the numbers. " +
      "`sole_among_tracked` means every tracked competitor has a usable check in this run's data, all of them displaying zero, and the customer does not — the customer is the only one, a measured finding and NOT missing data. " +
      "Say it, and bound it: 'the only one of your N tracked competitors'. " +
      "That set is a list this customer chose, not a sample of a market, so it licenses nothing about their category, their industry, or any vendor not on the list — never write 'no competitor offers this', 'the only vendor', 'unique in the market', 'first to market', or 'market leader'. " +
      "`no_competitors_tracked` means this project tracks no competitors at all, so nothing was attempted — never word that as a failed check. " +
      "`customer_unmeasured` means the customer's own domain could not be read, so there is no comparison regardless of how the competitors did. " +
      "`some_competitors_unmeasured` means the comparison is INCOMPLETE — at least one tracked competitor produced no usable check — and that is ALL it means: a measured competitor may still be leading, so read `trustSignalGap` and `topTrustCompetitor` before describing what the measured ones showed, and treat whatever you read as a floor rather than a finding about the ones we missed. " +
      "`no_competitor_measured` means there is no comparison at all this check. `compared` is the ordinary case and needs no comment. " +
      "An ABSENT state means it was not computed — a run recorded before the field shipped — and must never be read as `compared`. " +
      "Quote `summary.comparableCompetitors` alongside the state so the reader knows how large 'all of them' was; it is absent on those same older runs, and when it is absent quote no number and never substitute zero. " +
      "And keep the verb honest: this dimension measures what a vendor DISPLAYS on its homepage, so the claim is always 'none of them displays it' — a vendor can hold SOC 2 and never badge it, so a zero here is not a statement about what they hold. " +
      "Values are null when we could not measure them: an unanalyzed domain nulls every metric on `summary.customer` (only `domain` stays populated, and where no domain was on file it holds the literal placeholder `unknown` — treat that exact string as 'no domain', never as a site name), shielded response headers null the grade and score while the HTML-derived counts stay real, and a DNS query that never resolved nulls the provider it was for. " +
      "AI access degrades differently and more strictly: when the policy could not be read, `aiAccess.assistantAccess` and `aiAccess.modelTrainingAccess` are ABSENT — the keys are not present at all — and `aiAccess.measurement.status` is `could_not_measure` with the reason beside it. " +
      "An absent verdict list is not an empty one and carries no verdict in either direction; check `measurement.status` before reading anything else under `aiAccess`. " +
      "Never read a null as zero, false, or 'they don't have it'; a measured 0 or false is reported as itself and is a real finding. " +
      "`dnsInfrastructure` carries the two provider readings and one marker each, because MX and NS are separate queries: `emailProvider` is null with `emailProviderAvailable` present when that lookup didn't resolve, likewise `dnsProvider` with `dnsProviderAvailable`, and one can fail while the other succeeds — so check the marker belonging to the field you are about to quote. " +
      "A provider of 'Unknown' with NO marker beside it is a MEASURED result: the domain publishes no such records, or publishes records we don't attribute to a provider we track. " +
      "That is a real finding about them and may be reported as 'no recognised provider'; a null may not. " +
      "The technology stack has a third state that is neither: PARTIAL. " +
      "When a competitor's `technologyStack.partialDetection` is present, their site's behavioral protection blocked us from reading its response headers, so hosting and CDN could not be detected at all — these thirteen technologies (Vercel, Netlify, AWS, Heroku, GitHub Pages, DigitalOcean, Render, Cloudflare, Fastly, Akamai, CloudFront, Bunny CDN, KeyCDN) were not looked for, while Railway and Fly.io remain detectable from page markup. " +
      "Everything listed in that competitor's `tech`, `growth` and `engagement` arrays is a real detection and you should report it normally. " +
      "But `totalCount` is a FLOOR, not a total: do not compare it against another domain's count, do not say 'N technologies against your M', and never write that they run no CDN, no managed hosting, or that they lack any technology missing from the list. " +
      "The same protection sets `securityHeaders.signalsAvailable` on that competitor, and — when it is the customer's own domain — makes `summary.customer.techStackCount` a floor too.",
    parameters: z.object({
      projectId: objectId("Project ID (from list_projects)"),
    }),
    path: (a) => `/v1/projects/${a.projectId}/tech-trust`,
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
  {
    name: "get_tech_trust_history",
    description:
      "Get paginated history of Tech & Trust monitoring runs. Returns run summaries with completion timestamps. " +
      "Check pagination.hasMore to fetch additional pages. " +
      "Each row carries the same summary shape as get_tech_trust_dashboard, so the same reading rule applies: a null is a run we could not measure, never a zero. " +
      "The two gap figures are null when there was no comparison to make — either side unmeasured, or no competitor to compare against — so a null gap is not a tie. " +
      "A row whose `customer.securitySignalsAvailable` is present is a run where the customer's own response headers were blocked, which also leaves `customer.techStackCount` a floor rather than a total — do not read a rise or fall across such a row as a real change in their stack.",
    parameters: z.object({
      projectId: objectId("Project ID (from list_projects)"),
      ...pagination,
    }),
    path: (a) => `/v1/projects/${a.projectId}/tech-trust/history`,
    queryParams: ["page", "limit"],
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
  {
    name: "get_tech_trust_run_detail",
    description:
      "Get full competitor-by-competitor data for a specific historical Tech & Trust run. Use runId values from get_tech_trust_history. " +
      "Same summary shape and same reading rule as get_tech_trust_dashboard. " +
      "Per competitor, a null security grade means their headers could not be inspected (their bot protection blocked it — a fact about their protection, not their security), and null robots.txt fields mean the file could not be retrieved. " +
      "On `aiAccess`, read `measurement.status` first: `could_not_measure` means the verdict arrays are absent entirely and nothing may be said about that competitor's AI access in either direction, while `measured_no_policy_found` is a real 404 — they publish no robots.txt, which under the standard allows every crawler, and that IS reportable. " +
      "In BOTH of those states `measurement.explanations` carries the sentences to render, so quote those rather than writing your own — on `could_not_measure` they are the only prose there is, because the verdicts are absent with them; on `measured_no_policy_found` the verdicts are present and these sentences say the openness is the standard's default rather than the site's decision. " +
      "`measurement.sourcesRead` names which of the three control surfaces were actually read; a `not_attempted` there is a limit of the check, never a property of their site. " +
      "The same blocked headers also make that competitor's technology stack partial, marked by `technologyStack.partialDetection`: hosting and CDN went undetected, so the technologies listed are real but the list is short and `totalCount` is a floor. " +
      "Report what is there; never report an absence from it, and never rank or compare that competitor's count against another's. " +
      "One narrow exception, about `robotsTxt.exists` only: `false` there with no availability marker is a MEASURED result — they genuinely publish no robots.txt, which allows all crawlers — and that is worth reporting. " +
      "Do not generalise it; a missing marker elsewhere does not make a value measured.A run that finished but produced no summary answers 404 run_not_summarized. " +
      "That is different from run_not_found: the run exists, it simply has nothing to report. " +
      "Say the run produced no data; do not describe it as missing, and do not fill it in with zeros.",
    parameters: z.object({
      projectId: objectId("Project ID (from list_projects)"),
      runId: objectId("Run ID (from get_tech_trust_history)"),
    }),
    path: (a) => `/v1/projects/${a.projectId}/tech-trust/history/${a.runId}`,
    annotations: { readOnlyHint: true, openWorldHint: false },
  },

  // ── Content ───────────────────────────────────────────────
  {
    name: "get_content_dashboard",
    description:
      "Get the latest Content Intelligence for all competitors. " +
      "Returns sitemap URL counts, strategic URL identification, content categorization, sitemap structure data, content gap analysis. " +
      "When the customer’s own sitemap could not be analyzed, the URL counts, the category map, the strategic-URL gap and ALL FOUR gap lists are null, and contentAnalysisAvailable says why. " +
      "The list distinction matters here: a null advantages list means no comparison ran, while an EMPTY advantages list means we compared and you lead in no category — a real finding. " +
      "Reading a null list as the empty one reports a verdict about a comparison that never happened. " +
      "The gap lists are also null when no competitor produced usable data, because a gap needs two measured sides. " +
      "THOSE TWO CAUSES NEED DIFFERENT SENTENCES and the payload tells them apart: contentAnalysisAvailable present means THEIR site is what we could not read, while comparableCompetitors of 0 with that flag absent means their own sitemap read fine and it was the competitors we could not reach. " +
      "Saying 'your sitemap check failed' in the second case blames the customer for our reach into someone else's site. " +
      "The gap analysis covers 9 strategic categories — Blog Posts, Documentation, Free Tools, Landing Pages, Case Studies, Comparison Pages, Integrations, Changelog, Webinars — and nothing else. " +
      "categorizedCounts is wider, publishing all 12: Legal, Programmatic Pages, Other are counted there but never assessed. " +
      "Every evaluated category lands in exactly one of FOUR lists: criticalGaps (the customer has no content there at all), significantGaps (the customer has some, but under half the competitor average — the list that carries gapPercentage), advantages, or onTrack. " +
      "So a category with a count and no entry in any of the four was very likely never a candidate, not a category the customer is losing. " +
      "Never answer 'which categories do I lead in' with a verdict about one outside the evaluated 9. " +
      "TWO GAP FIELDS HERE POINT OPPOSITE WAYS, so read each one's rule and never carry a direction between them. " +
      "gapPercentage on a gap entry is a MAGNITUDE, always positive: 80 means the customer publishes 80% fewer URLs in that category than the average competitor, and bigger is worse. " +
      "It cannot be negative or below 50, because an entry exists only where the customer sits under half the competitor average — being ahead produces an advantages entry instead, never a negative gapPercentage. " +
      "strategicUrlGap is the opposite shape: a signed difference where NEGATIVE means the customer is behind. " +
      "The AI-visibility tools use that signed convention too, so gapPercentage is the exception across the whole tool set. " +
      "summary.topCompetitor is the rival leading on strategic URLs, and it is null ONLY when no competitor returned usable data — never because the competitors have none. " +
      "Its strategicUrls can legitimately be 0: that means every competitor was read successfully and not one publishes a strategic page, which is a measured result and normally the customer's largest lead. " +
      "Report it as 'leads with 0' and report strategicUrlGap as the lead it is; do not describe either as missing data, and do not treat a gap equal to the customer's own count as a glitch. " +
      "A row's contentDataAvailable.reason of 'no_sitemap_published' means no working sitemap was FOUND at the locations we know of — report it as 'no sitemap we can find', never as 'they publish no sitemap'. " +
      "We re-discover sitemap locations periodically, so a competitor who moved theirs reads this way until we re-check. " +
      "'sitemap_fetch_failed' means our fetch failed and nothing was measured — derive no content verdict at all from that row. " +
      "An empty programmaticExampleUrls is not a finding of its own — it restates that row's categorizedCounts.programmatic being 0, and never means 'they publish no templated pages'.",
    parameters: z.object({
      projectId: objectId("Project ID (from list_projects)"),
    }),
    path: (a) => `/v1/projects/${a.projectId}/content`,
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
  {
    name: "get_content_history",
    description:
      "Get paginated history of Content Intelligence monitoring runs. Check pagination.hasMore to fetch additional pages. " +
      "Same reading rule as get_content_dashboard: a null is a run whose sitemap we could not read, never a measured zero pages.",
    parameters: z.object({
      projectId: objectId("Project ID (from list_projects)"),
      ...pagination,
    }),
    path: (a) => `/v1/projects/${a.projectId}/content/history`,
    queryParams: ["page", "limit"],
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
  {
    name: "get_content_run_detail",
    description:
      "Get full competitor-by-competitor data for a specific historical Content Intelligence run. Use runId values from get_content_history. " +
      "Same reading rule as get_content_dashboard. " +
      "Every tracked competitor appears — rows we could not measure carry a contentDataAvailable reason with null counts rather than being omitted, so never report one as having no content. " +
      "A row's contentDataAvailable.reason of 'no_sitemap_published' means no working sitemap was FOUND at the locations we know of — report it as 'no sitemap we can find', never as 'they publish no sitemap'. " +
      "We re-discover sitemap locations periodically, so a competitor who moved theirs reads this way until we re-check. " +
      "'sitemap_fetch_failed' means our fetch failed and nothing was measured — derive no content verdict at all from that row. " +
      "An empty programmaticExampleUrls is not a finding of its own — it restates that row's categorizedCounts.programmatic being 0, and never means 'they publish no templated pages'. " +
      "A run that finished but produced no summary answers 404 run_not_summarized. " +
      "That is different from run_not_found: the run exists, it simply has nothing to report. " +
      "Say the run produced no data; do not describe it as missing, and do not fill it in with zeros.",
    parameters: z.object({
      projectId: objectId("Project ID (from list_projects)"),
      runId: objectId("Run ID (from get_content_history)"),
    }),
    path: (a) => `/v1/projects/${a.projectId}/content/history/${a.runId}`,
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
  {
    name: "get_content_changelog",
    description:
      "Get detected content changes over time per competitor sitemap (URLs added/removed). " +
      "Each item shows numeric counts per category plus up to 3 sample URLs per category by default — safe for any token budget. Paginated. " +
      "Filter by competitor and/or category to scope. " +
      "Pass `allUrlsPerCategory: true` for full URL lists per category (warning: high-activity competitors can produce very large responses; combine with `category` and `competitorId` filters and watch the `truncated` flag — when true, the byte cap fired and items/URLs were trimmed; refine your query). " +
      "BEFORE REPORTING A LARGE REMOVAL, CHECK IT. " +
      "A row compares ONE sitemap file against its own previous contents, so when a site reorganises which file lists a page, the same live page is recorded as removed from one sitemap and added to another in the same run — the pages did not go anywhere. " +
      "Look at the same competitor's other rows for the same run: URLs appearing on the opposite side there were re-filed, not removed or published. " +
      "Templated catalogues re-file in bulk, so the largest add/remove pairs are the most likely to be filing changes rather than activity. " +
      "Saying 'they deleted 16,000 pages' about a site that deleted nothing is the loudest way to be wrong.",
    parameters: z.object({
      projectId: objectId("Project ID (from list_projects)"),
      ...pagination,
      competitorId: z
        .string()
        .optional()
        .describe("Filter by competitor ID (from list_competitors)"),
      category: z
        .enum([
          "blog",
          "docs",
          "tools",
          "landing",
          "caseStudies",
          "comparison",
          "integrations",
          "changelog",
          "webinars",
          "legal",
          "programmatic",
          "other",
        ])
        .optional()
        .describe("Filter by content category"),
      allUrlsPerCategory: booleanish()
        .optional()
        .describe(
          "Default false — return up to 3 sample URLs per category per item. " +
            "Set true for the full URL list per category (subject to an internal byte cap; check the `truncated` flag in the response).",
        ),
    }),
    path: (a) => `/v1/projects/${a.projectId}/content/changelog`,
    queryParams: ["page", "limit", "competitorId", "category", "allUrlsPerCategory"],
    annotations: { readOnlyHint: true, openWorldHint: false },
  },

  // ── Positioning ───────────────────────────────────────────
  {
    name: "get_positioning_dashboard",
    description:
      "Get the latest Positioning analysis for all competitors. " +
      "Returns homepage messaging: page title, main headline, tagline, value proposition, primary/secondary CTAs, key offerings, target audience, main differentiator, pricing mentions, free trial info. " +
      "When the customer’s own homepage could not be analyzed, every metric on summary.customer is null and messagingAnalysisAvailable says why — including the headline and CTA strings. " +
      "Note the distinction those nulls preserve: a measured EMPTY STRING means we read the page and there is genuinely no call to action, which is a real finding; a null means we never read it. " +
      "The messaging score and its gap are null on the same condition — a null gap is not a tie.",
    parameters: z.object({
      projectId: objectId("Project ID (from list_projects)"),
    }),
    path: (a) => `/v1/projects/${a.projectId}/positioning`,
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
  {
    name: "get_positioning_history",
    description:
      "Get paginated history of Positioning monitoring runs. Check pagination.hasMore to fetch additional pages. " +
      "Same summary shape and same reading rule as get_positioning_dashboard: a null is a run whose homepage we could not analyze, never a zero or an empty headline.",
    parameters: z.object({
      projectId: objectId("Project ID (from list_projects)"),
      ...pagination,
    }),
    path: (a) => `/v1/projects/${a.projectId}/positioning/history`,
    queryParams: ["page", "limit"],
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
  {
    name: "get_positioning_run_detail",
    description:
      "Get full competitor-by-competitor data for a specific historical Positioning run. Use runId values from get_positioning_history. " +
      "Same reading rule as get_positioning_dashboard.A run that finished but produced no summary answers 404 run_not_summarized. " +
      "That is different from run_not_found: the run exists, it simply has nothing to report. " +
      "Say the run produced no data; do not describe it as missing, and do not fill it in with zeros.",
    parameters: z.object({
      projectId: objectId("Project ID (from list_projects)"),
      runId: objectId("Run ID (from get_positioning_history)"),
    }),
    path: (a) => `/v1/projects/${a.projectId}/positioning/history/${a.runId}`,
    annotations: { readOnlyHint: true, openWorldHint: false },
  },

  // ── Pricing ───────────────────────────────────────────────
  {
    name: "get_pricing_dashboard",
    description:
      "Get the latest Pricing Intelligence for all competitors. " +
      "Returns structured pricing plans (name, price, billing interval, summary — up to 5 plans per competitor), market pricing statistics, pricing gap analysis. " +
      "IMPORTANT — a pricing page is the single most likely thing to be missing: plenty of vendors publish none at all, and plenty gate them. " +
      "When the customer's own pricing could not be analyzed, every metric on `summary.customer` is null and `pricingAnalysisAvailable` says why. " +
      "`hasFreePlan: null` means WE DID NOT CHECK, not that they have no free plan — reporting the second from the first is the specific error this contract exists to prevent. " +
      "A measured `false` is reported as `false` and is a real finding worth stating. " +
      "The same applies per competitor: a row with `pricingDataAvailable` carries a null `content` and a reason (no pricing page found, their page did not respond, or a problem on our side) — never turn any of those into 'they offer no pricing'. " +
      "All three gap flags are null when there is nothing to compare: your side unmeasured, or no competitor measured. A null gap is not 'no gap'. " +
      "`hasPriceGap` nulls on two further conditions its siblings do not carry — fewer than three comparable competitor prices, or your own price not being comparable to the market — so a null `hasPriceGap` sitting beside a `false` free-tier gap is consistent, not a contradiction. " +
      "Market figures (`marketAvgPrice`, `pricePositionPercent`) are null below three comparable prices — that is 'not enough market to average', never zero. " +
      "COMPARABLE has two halves and both matter when you quote a market figure: fixed monthly amounts sharing ONE currency and ONE licensed unit. " +
      "`marketPricingUnit` says which unit the figures are in — 'flat' for a plain monthly amount, or 'per-seat' / 'per-license' — and a per-seat price is never averaged against a flat one, because '$15 per seat per month' and '$475 per month' are not the same kind of number. " +
      "Always state the unit alongside the average, and compare `summary.customer.popularPlanUnit` against it before describing the customer's position: when they differ, `pricePositionPercent` is null for that reason rather than because anything failed. " +
      "Historical runs recorded before unit grouping carry no `marketPricingUnit` and their averages may mix units — say so rather than quoting them as a like-for-like market price.",
    parameters: z.object({
      projectId: objectId("Project ID (from list_projects)"),
    }),
    path: (a) => `/v1/projects/${a.projectId}/pricing`,
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
  {
    name: "get_pricing_history",
    description:
      "Get paginated history of Pricing Intelligence monitoring runs. Check pagination.hasMore to fetch additional pages. " +
      "Same summary shape and same reading rule as get_pricing_dashboard: a null is a run whose pricing we could not analyze, never a zero or a no. " +
      "Do not read a run-to-run change in a null field as a competitive event.",
    parameters: z.object({
      projectId: objectId("Project ID (from list_projects)"),
      ...pagination,
    }),
    path: (a) => `/v1/projects/${a.projectId}/pricing/history`,
    queryParams: ["page", "limit"],
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
  {
    name: "get_pricing_run_detail",
    description:
      "Get full competitor-by-competitor data for a specific historical Pricing Intelligence run. Use runId values from get_pricing_history. " +
      "Same reading rule as get_pricing_dashboard. " +
      "Every tracked competitor appears — rows we could not measure carry a pricingDataAvailable reason and a null content rather than being omitted, so branch on it before quoting any pricing fact about that row.A run that finished but produced no summary answers 404 run_not_summarized. " +
      "That is different from run_not_found: the run exists, it simply has nothing to report. " +
      "Say the run produced no data; do not describe it as missing, and do not fill it in with zeros.",
    parameters: z.object({
      projectId: objectId("Project ID (from list_projects)"),
      runId: objectId("Run ID (from get_pricing_history)"),
    }),
    path: (a) => `/v1/projects/${a.projectId}/pricing/history/${a.runId}`,
    annotations: { readOnlyHint: true, openWorldHint: false },
  },

  // ── AI Visibility ─────────────────────────────────────────
  {
    name: "get_ai_visibility_dashboard",
    description:
      "Get the latest AI Visibility data for all competitors. " +
      "Returns the MARKET MAP under summary.marketMap — which companies the AI models recommend in this project's category, how often each is named over the last few checks, where the customer sits among them — plus AI Visibility Score (0-100), Mention Rate (share of the check's counted answers that mention the brand), per-model breakdowns (ChatGPT, Claude, Gemini, Perplexity, and Google AI Overviews), and this check's competitor rows. " +
      "LEAD WITH THE MARKET — after reading summary.promptMarket: unless its state is rivals_named_in_most_answers, say the prompts may not describe this project's market and do not lead with the map. " +
      "Otherwise: 'Nine companies make up this market as the AI models draw it (marketMap.coreSize); the customer is one of them, 7th of 9 by how often it is named (the customer's row has isOwn=true and rankByPresence).' Presence is a share of the answers analysed (marketMap.answersReceived) — never of queries sent, never a probability — and every presence ships with presenceLow/presenceHigh: two brands whose ranges overlap are NOT ordered, and rankByPresence is shared across ties, so never break a tie or call one of them ahead. " +
      "Nothing here is positional — there is no average position on any surface, by design — so never sort, rank or compare brands by how high they appeared. " +
      "A zone token names a measured condition about a third party: say 'named in under a tenth of answers', never 'irrelevant' or 'tail', and while marketMap.tailIsProvable is false say 'no brand can be ruled out of this market yet'. " +
      "A pooled row is a vote across models; read perEngine before calling a brand core to the market, because a brand core to one model and a brand core to all of them look identical on the pooled figure. " +
      "Each map row also carries two readings of how the models DESCRIBE the brand, pooled over the same window: endorsement (how warmly it is recommended, on a scale with a FLOOR of 21, not 0 — read a low figure against the floor, and never set it against presence or report a gap between the two; they are different units) and pricePerception (shown in the app as \"Price read\": the price tier the models stated most often, with the mean's position beside it — report the tier word and its share of answersRead, and say the models disagree when tierAnswers is under half). " +
      "Both are null where no answer described the brand, never a low reading; both carry answersRead and a 95% interval (low/high, null on one answer), and the rule that binds presence binds them: two brands whose intervals overlap are NOT ordered on that reading, whatever the values say; under 6 answers the figure is a label rather than a measurement, so quote the count and never compare two brands on it. " +
      "marketMap.profileEngines names the models the readings were read from — Google AI Overviews describes nobody and is never among them. " +
      "customerStanding is the one comparison to make for the customer's own row: its endorsement and price readings set against the companies at the core of the market, INTERVAL against interval, each as a state token and a sentence that says only what the intervals separate (coreAboveYou / coreBelowYou / coreNotSeparable of coreCompared) — report explanation.text VERBATIM, never paraphrase it, never derive a distance or a rank from it, and never order the customer against a core company the sentence calls not separable; it is a reading of the map and is read under summary.promptMarket exactly as the map is, and a reading missing from it did not clear its evidence floor, which never means level. " +
      "untrackedCoreBrands, when present, lists the core companies the project does not track — the highest-value line here; report it as a recommendation to add them, never as a fact about them; it is ABSENT (not empty) unless summary.promptMarket is rivals_named_in_most_answers, because a recommendation drawn from a map that may describe the wrong market is withheld, and absence never means none. " +
      "Each check asks every prompt in the project against every AI model it was dispatched to — 5 today, but a check keeps the model set it ran with — and every rate divides by totalQueries — the answers that came back, a count this tool returns; the number of queries sent is not returned at all. " +
      "The score counts only the top 5 positions in an answer, evenly spaced — first place the most, the last scoring position the least — and nothing below them. " +
      "It is a reading of WHERE a brand lands when it is named, never of who is ahead: a standing claim — \"you lead\", \"you trail\", \"the leader is X\" — rests on how often each brand is named (presence on the market map, or mentionRate within one check) and never on this score, which can favour a brand named half as often. " +
      "A score of 0 for a brand the answers did name means it was named only below the top 5, or too seldom inside them for the average to register. " +
      "Read mentionRate beside a 0 score: a non-zero rate means the brand was named, and a 0 rate means no counted answer named it. " +
      "The competitor rows matter most here: they name other companies, so reporting a 0 score as 'never named' is a false claim about a third party published under CompetLab's name. " +
      "Checks published under the full-coverage gate were read for every query they asked — a usable answer came back, or the model was read and had none to show (noAnswerShown, the third query state beside answers and unansweredQueries: read, nothing shown, excluded from every count, not a failure); checks published before that gate stay published and can have been scored over fewer answers, and nothing here says which kind a given check is. " +
      "So report a rate as a share of the answers counted, never as a share of every query asked. " +
      "If the most recent check was abandoned as incomplete, latestCheckDataAvailable is present and the data returned is from an earlier check. " +
      "That object carries measuredAnswers and expectedAnswers: expectedAnswers minus measuredAnswers is the uncounted total, and absentAnswers is the part of it the model was read for and had no answer to show; the remainder is the number of queries that could not be read. " +
      "Report the two apart — never the total as answers that failed, and never any pair of these figures as a fraction, which reads as a visibility rate. " +
      "mentionRateGap is the CUSTOMER MINUS THE LEADER, so a NEGATIVE value means the customer is BEHIND by that many points and a positive one means ahead — state the direction from this rule and never infer it from the sign looking 'wrong', because reporting a trailing brand as leading is the single most damaging error on this dimension. " +
      "It equals summary.customer.mentionRate minus summary.topCompetitor.mentionRate, both returned here, so check it against those two before describing it. " +
      "Other dimensions do not share this convention — the content dimension's gapPercentage is an always-positive magnitude of shortfall — so never carry a gap direction between tools. " +
      "mentionRateGap is null when this check found no competitor to compare against — topCompetitor is null on the same response — and a 0 there means genuinely level; never read the null as level. " +
      "Each competitor row carries isTracked: true means the project monitors that domain, false means an AI model raised it unprompted. " +
      "summary.customer.perPrompt breaks the customer's result down per prompt — a display label, which models named them, and a 0-100 position score — and answers 'which of my prompts am I losing on' with no extra call; a model absent from mentionedBy did not name the customer in the answers this check counted, which is a measured absence on a fully-covered check, and never report an empty mentionedBy or a 0 score as 'we could not measure'. " +
      "A model absent from summary.customer.perProvider altogether was NOT ASKED by that check — checks keep the model set they were run with — so its absence is not a measurement and must never be reported as 'not mentioned'. " +
      "A model PRESENT there with mentioned false is read together with its answersCounted: beside a non-zero count it answered and did not name the customer, beside answersCounted 0 it was read and had no answer to show on every prompt, which measures nothing about the customer. " +
      "summary.promptMarket is a reading about the QUESTIONS this project is monitored on rather than about its visibility: it says whether the prompts are reaching the market the account's tracked competitor list describes, and every other number here is arithmetic over those prompts. " +
      "rivals_named_in_most_answers means most answers named at least one tracked competitor, so these numbers are measuring the intended competition. " +
      "rival_match_too_close_to_call means some answers named a tracked competitor and some named none, in a proportion this much evidence cannot separate — undecided, not a milder failure, and usually thin evidence rather than weak prompts; checksAnalysed says how thin — checks, never days; the interval is a schedule setting. " +
      "answers_and_rival_list_disagree means almost no answer named a tracked competitor, and it does NOT assert that the prompts are wrong: it compares two things the customer supplied, the prompts and the tracked competitor list, and reports that they describe different markets without being able to say which of them is off. " +
      "A narrow B2B market that genuinely does not come up in AI answers yet produces exactly that reading and is a real finding, not a defect — so report the disjunction and offer the stored answers (includeAnswers=true) as the evidence that settles it. " +
      "Report promptMarket.explanation.text VERBATIM: never paraphrase or summarise it, and never build a claim of your own out of the state token, because the wording says only what this comparison supports and a rewrite reliably says more. " +
      "TWO ANSWER COUNTS ARE DRAWN FROM THE SAME WINDOW HERE AND THEY ARE NOT INTERCHANGEABLE. " +
      "Divide a brand's answersNaming by marketMap.answersReceived, which pools every usable answer whatever prompt wording produced it. " +
      "Divide answersNamingAnyRival by promptMarket.answersMatchingCurrentPromptText, which counts only answers produced by the prompts as worded today. " +
      "The second is never larger than the first and is EQUAL to it whenever no prompt has been reworded in the window, so finding them equal is the normal case and never means they are one field. " +
      "answersNamingAnyRival over its own denominator describes tracked competitors as a group and says nothing about the customer's own visibility, so never present it as a mention rate and never pair it with totalQueries. " +
      "An ABSENT promptMarket means the reading could not be produced — the account tracks no competitors to test the prompts against, or no answer came back to test them with — and never that the prompts are fine, so do not report a missing promptMarket as a pass. " +
      "It suppresses nothing: everything else in this response is complete either way. " +
      "promptMarket.perPrompt, where present, carries one reading per prompt — every prompt answers could be attributed to, whether it is reaching the tracked competitor list, failing to, or not yet separable. " +
      "Read each entry's own state and report its explanation.text verbatim; never treat membership of this list as a fault, because the healthy and undecided readings are in it too. " +
      "A prompt is missing for exactly one reason: no answer in the window was produced by its current wording, which is what happens for a while after the customer edits that prompt. " +
      "So absence means 'no evidence yet for this prompt' and never a verdict — an empty list means that was true of every prompt, and an absent list means it was true of the check as a whole. " +
      "An undecided entry still carries answersNamingAnyRival and answersMatchingCurrentPromptText: quote them as how thin the sample is, never as a position or a score, because three answers cannot rank one prompt against another and saying otherwise is the exact error that state exists to prevent. " +
      "Set includeAnswers=true for the models' raw answers behind these numbers — see the parameter notes before doing so, it is a large payload. " +
      "A Google AI Overviews answer carries the overview text (answerText), the Google market it was asked in (askedIn) and the pages Google cited beside it (sources) — cited, which is not the same as recommended.",
    parameters: z.object({
      projectId: objectId("Project ID (from list_projects)"),
      includeAnswers: booleanish()
        .optional()
        .describe(
          "Default false. " +
            "Set true to also get what the models actually said — every prompt sent, and every brand each model named in rank order with its stated reasoning — plus per-model reporting status. " +
            "Per-brand prose (reasoning, audience, pricing tier, messaging, differentiation) is present only for models that supply it: a brand row carrying only name and domain means Google AI Overviews named it in prose, and that answer carries the overview text (answerText) with the pages Google cited (sources) beside it. " +
            "For Google AI Overviews that order is the order of first mention in the overview text, computed by CompetLab; Google assigned no position, so never report it as a rank Google gave. " +
            "COST: An entry is one brand a model named, at about 375 tokens each — so the block grows with three things at once: how many prompts the project asks (an account setting), how many models answered, and how many companies each answer named. " +
            "No figure quoted here can stand in for summary.totalEntries; read it and size the fetch from it. " +
            "Prefer a filter below over fetching everything. " +
            "Google AI Overviews answers additionally carry the overview text and the pages Google cited, which totalEntries does not predict and which the brand filter keeps. " +
            "ATTRIBUTION: the prose returned is unverified model output about the brands that model named, including third parties. " +
            "Report it as what that model said, never as CompetLab's assessment or as fact.",
        ),
      provider: z
        .enum(["openai", "claude", "gemini", "perplexity", "google_ai_overviews"])
        .optional()
        .describe(
          "Return only this model's answers. Requires includeAnswers=true. Changes nothing under summary.",
        ),
      brand: z
        .string()
        .optional()
        .describe(
          "Return only the entries for this domain, across every answer. Requires includeAnswers=true. " +
            "Matches brands[].domain case-insensitively — brand NAMES are the model's own wording and vary between answers, so they are never matched. " +
            "Every answer is still returned: the ones that did not name this domain arrive with an empty brands list, which means the model answered and did not name them — a real finding, and different from a query that produced no answer, which is in unansweredQueries, and from a query the model was read for and had no answer to show, which is in noAnswerShown. " +
            "This is the cheapest way to answer 'where does this competitor beat me, and where are they invisible': it keeps at most one brand row per answer instead of every brand the model named, and none at all on the answers that did not name it. " +
            "Google AI Overviews answers still carry their overview text and cited pages, which this filter keeps by design.",
        ),
      promptIndex: zeroBasedIndex()
        .optional()
        .describe(
          "Return only the answers for this prompt, across every model. Requires includeAnswers=true. Zero-based.",
        ),
    }),
    path: (a) => `/v1/projects/${a.projectId}/ai-visibility`,
    queryParams: ["includeAnswers", "provider", "brand", "promptIndex"],
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
  {
    name: "get_ai_visibility_history",
    description:
      "Get paginated history of AI Visibility checks. " +
      "Note: uses checkId not runId — AI Visibility has a different data model where each \"check\" is one full query cycle (every prompt in the project against every AI model that check asked — 5 today, while older checks keep the smaller set they ran with). " +
      "The score counts only the top 5 positions in an answer, evenly spaced — first place the most, the last scoring position the least — and nothing below them. " +
      "It is a reading of WHERE a brand lands when it is named, never of who is ahead: a standing claim — \"you lead\", \"you trail\", \"the leader is X\" — rests on how often each brand is named (presence on the market map, or mentionRate within one check) and never on this score, which can favour a brand named half as often. " +
      "A score of 0 for a brand the answers did name means it was named only below the top 5, or too seldom inside them for the average to register. " +
      "Read mentionRate beside a 0 score: a non-zero rate means the brand was named, and a 0 rate means no counted answer named it. " +
      "Only scored checks are listed: under the full-coverage gate a cycle that came back short is never scored and does not appear here. " +
      "Checks published before that gate remain listed and can have been scored over fewer answers than they asked queries; the queries-sent figure is not returned, so a listed check cannot be shown to be fully covered. " +
      "Each entry carries summary.totalEntries — the number of brand entries that check recorded — which is the figure to check before requesting that check's raw answers via get_ai_visibility_check_detail, since it predicts how large that payload will be. " +
      "Rows also carry summary.customer.perPrompt: a per-prompt breakdown (label, which models named the customer, 0-100 score) that answers \"which prompt am I losing on\" without any further call. " +
      "Check pagination.hasMore to fetch additional pages, and watch the truncated flag: when true the page hit a size cap and whole entries were dropped from the end, so lower limit to see the rest. " +
      "Each row's summary.promptMarket, where present, carries the prompt-market reading — whether the questions this project is monitored on are reaching the market its tracked competitor list describes. " +
      "Read it exactly as get_ai_visibility_dashboard describes: report explanation.text verbatim, treat an absent promptMarket as a reading that could not be produced rather than as a pass, and never state that the prompts are wrong — the reading compares two things the customer supplied and cannot say which of them is off.",
    parameters: z.object({
      projectId: objectId("Project ID (from list_projects)"),
      ...pagination,
    }),
    path: (a) => `/v1/projects/${a.projectId}/ai-visibility/history`,
    queryParams: ["page", "limit"],
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
  {
    name: "get_ai_visibility_check_detail",
    description:
      "Get full detail for one AI Visibility check. " +
      "The score counts only the top 5 positions in an answer, evenly spaced — first place the most, the last scoring position the least — and nothing below them. " +
      "It is a reading of WHERE a brand lands when it is named, never of who is ahead: a standing claim — \"you lead\", \"you trail\", \"the leader is X\" — rests on how often each brand is named (presence on the market map, or mentionRate within one check) and never on this score, which can favour a brand named half as often. " +
      "A score of 0 for a brand the answers did name means it was named only below the top 5, or too seldom inside them for the average to register. " +
      "These rows name other companies, so reporting a 0 as 'never named' is a false claim about a third party published under CompetLab's name. " +
      "Read mentionRate beside a 0 score: a non-zero rate means the brand was named, and a 0 rate means no counted answer named it. " +
      "Uses checkId (not runId) — AI Visibility has a different data model. " +
      "By default returns summary only: this check's competitor rows under summary.competitorRankings (mention rate and AI Visibility Score, in the order to render — nothing positional), and the market map as it stood at this check under summary.marketMap — read it exactly as get_ai_visibility_dashboard describes: lead with the market, a share is a share of answers analysed with its range beside it, ties are ties, and a zone names a condition rather than a verdict. " +
      "Each map row also carries endorsement and pricePerception, read exactly as that tool describes: a floor rather than a zero, null where no answer described the brand, an interval that refuses an order wherever two brands overlap, and a count under which the figure is a label rather than a measurement. " +
      "Every rate divides by the answers that came back, not the queries sent, and the queries-sent figure is not on summary — report a rate as a share of the answers counted, never as a share of every query asked. " +
      "Set includeAnswers=true to also get what the models actually said: every prompt sent, and every brand each model named in rank order with its stated reasoning, target audience, pricing tier, messaging keywords, and differentiation claims. " +
      "That per-brand prose is present only for models that supply it: a brand row carrying only name and domain means Google AI Overviews named it in prose, and that answer carries the overview text (answerText), the Google market it was asked in (askedIn) and the pages Google cited (sources). " +
      "For Google AI Overviews that order is the order of first mention in the overview text, computed by CompetLab; Google assigned no position, so never report it as a rank Google gave. " +
      "That text is the MODEL'S wording about the brands it named, not CompetLab's assessment — attribute it to the model. " +
      "BEFORE REACHING FOR IT: summary.customer.perPrompt already breaks the customer's result down per prompt — a display label, which models named them, and a 0-100 position score. " +
      "It is on the plain response and costs nothing, and it answers 'which of my prompts am I losing on' outright. " +
      "COST of the answers block: An entry is one brand a model named, at about 375 tokens each — so the block grows with three things at once: how many prompts the project asks (an account setting), how many models answered, and how many companies each answer named. " +
      "No figure quoted here can stand in for summary.totalEntries; read it and size the fetch from it. " +
      "Google AI Overviews answers also carry overview text and cited pages, which the entry count does not predict. " +
      "Then narrow: brand=<domain> returns one competitor across every answer and is the right call for 'why does this competitor beat me'; provider= returns one model; promptIndex= returns one prompt. " +
      "provider and promptIndex narrow the answers array (and the matching unansweredQueries); brand does NOT — it empties the brands list on answers that did not name that domain, so you also see where they are invisible. " +
      "No filter changes a number under summary. Ranks stay stable under any filter. " +
      "If answersTruncated is true the cap fired and whole PROMPTS were dropped from the end of answers — never part of one, so every prompt still present carries every model that answered it, of the models your filters left. " +
      "Grouping by promptIndex is safe; narrow and retry for the rest. " +
      "Queries that produced no usable answer appear in unansweredQueries, never as answers naming nobody: those are different facts and must not be reported as 'not mentioned'. " +
      "noAnswerShown is the third query state — the model was read and had nothing to show (today: Google's results page carried no AI Overview for the prompt); it is excluded from every count and is not a failure, so report it as 'Google showed no AI Overview for this question — not counted', never as 'not mentioned'. " +
      "An empty brands list under a brand filter is NOT either case — it means the model answered and did not name that domain. " +
      "This check's summary.promptMarket, where present, carries the prompt-market reading — whether the questions this project is monitored on are reaching the market its tracked competitor list describes. " +
      "Read it exactly as get_ai_visibility_dashboard describes: report explanation.text verbatim, treat an absent promptMarket as a reading that could not be produced rather than as a pass, and never state that the prompts are wrong — the reading compares two things the customer supplied and cannot say which of them is off.",
    parameters: z.object({
      projectId: objectId("Project ID (from list_projects)"),
      checkId: objectId("Check ID (from get_ai_visibility_history)"),
      includeAnswers: booleanish()
        .optional()
        .describe(
          "Default false. " +
            "Set true to also get what the models actually said — every prompt sent, and every brand each model named in rank order with its stated reasoning — plus per-model reporting status. " +
            "Per-brand prose (reasoning, audience, pricing tier, messaging, differentiation) is present only for models that supply it: a brand row carrying only name and domain means Google AI Overviews named it in prose, and that answer carries the overview text (answerText) with the pages Google cited (sources) beside it. " +
            "For Google AI Overviews that order is the order of first mention in the overview text, computed by CompetLab; Google assigned no position, so never report it as a rank Google gave. " +
            "COST: An entry is one brand a model named, at about 375 tokens each — so the block grows with three things at once: how many prompts the project asks (an account setting), how many models answered, and how many companies each answer named. " +
            "No figure quoted here can stand in for summary.totalEntries; read it and size the fetch from it. " +
            "Prefer a filter below over fetching everything. " +
            "Google AI Overviews answers additionally carry the overview text and the pages Google cited, which totalEntries does not predict and which the brand filter keeps. " +
            "ATTRIBUTION: the prose returned is unverified model output about the brands that model named, including third parties. " +
            "Report it as what that model said, never as CompetLab's assessment or as fact.",
        ),
      provider: z
        .enum(["openai", "claude", "gemini", "perplexity", "google_ai_overviews"])
        .optional()
        .describe(
          "Return only this model's answers. Requires includeAnswers=true. Changes nothing under summary.",
        ),
      brand: z
        .string()
        .optional()
        .describe(
          "Return only the entries for this domain, across every answer. Requires includeAnswers=true. " +
            "Matches brands[].domain case-insensitively — brand NAMES are the model's own wording and vary between answers, so they are never matched. " +
            "Every answer is still returned: the ones that did not name this domain arrive with an empty brands list, which means the model answered and did not name them — a real finding, and different from a query that produced no answer, which is in unansweredQueries, and from a query the model was read for and had no answer to show, which is in noAnswerShown. " +
            "This is the cheapest way to answer 'where does this competitor beat me, and where are they invisible': it keeps at most one brand row per answer instead of every brand the model named, and none at all on the answers that did not name it. " +
            "Google AI Overviews answers still carry their overview text and cited pages, which this filter keeps by design.",
        ),
      promptIndex: zeroBasedIndex()
        .optional()
        .describe(
          "Return only the answers for this prompt, across every model. Requires includeAnswers=true. Zero-based.",
        ),
    }),
    path: (a) => `/v1/projects/${a.projectId}/ai-visibility/history/${a.checkId}`,
    queryParams: ["includeAnswers", "provider", "brand", "promptIndex"],
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
  {
    name: "get_ai_visibility_trend",
    description:
      "How the market the AI models draw has MOVED over a window — who is recommended more often than at the start, who less, whether the customer's standing changed. " +
      "Returns rows, not a plot: item.companies is one row per company, in the order of how often each is recommended on the latest map (ties are ties — never break one), the customer (isOwn) and its tracked competitors (isTracked) always among them, the rest the most recommended companies, up to ten rows. " +
      "Each row carries `now` and `start` — its reading on the latest and on the earliest published check in the window — and the difference between them: presenceChange in points of share, rankChange in places (positive = climbed), scoreChange in score points. " +
      "Report presenceChange as a rise or a fall ONLY when presenceChangeSeparable is true (the two 95% ranges do not overlap); when it is false, state the share now and at the start and say the ranges overlap — an overlapping pair is a difference between two readings, never a move. " +
      "A reading is a share of the answers pooled in that check's window that named the company (presence.answersNaming of presence.answersReceived, never queries sent) — every prompt asks for a recommendation, so a company named in an answer is one the model recommended — with a 95% range (presenceLow/presenceHigh) and a zone: two companies whose ranges overlap are NOT in a settled order whatever the shares say, and a zone names a measured condition — say 'named in under a tenth of answers', never 'irrelevant' or 'tail'. " +
      "`start` is null when the window holds one measured reading, and every *Change is null with it — report 'one reading, no movement to compare', never zero change. " +
      "enginesBacking names the models that recommended the company in the latest window: read it before saying a company is named across the market rather than by one model, because the two look the same on the pooled share. " +
      "The score counts only the top 5 positions in an answer, evenly spaced — first place the most, the last scoring position the least — and nothing below them. " +
      "It is a reading of WHERE a brand lands when it is named, never of who is ahead: a standing claim — \"you lead\", \"you trail\", \"the leader is X\" — rests on how often each brand is named (presence on the market map, or mentionRate within one check) and never on this score, which can favour a brand named half as often. " +
      "A score of 0 for a brand the answers did name means it was named only below the top 5, or too seldom inside them for the average to register. " +
      "Read presence beside a 0 score: a non-zero share means the company was named. " +
      "item.events is what happened on the axis, as facts: standingChanges are the customer's own zone moving and holding — the alerts the customer received, announced only once a standing has held for two checks — report them as 'your standing moved from X to Y on <date>'; incompleteCycles are checks that produced no reading (expectedAnswers minus measuredAnswers is the uncounted total, absentAnswers the part the model was read for and had none to show; report the two apart, never as a fraction); promptsLastChangedAt says when the prompts were last edited — readings before it answer different questions, so never read a move across that date as the market moving. " +
      "item.window names the checks read (from, to, checks), the answers pooled on the latest map, the checks each reading pools (checksAnalysed — quote answers and checks, never days), and the models the latest check asked. " +
      "With provider (openai, claude, gemini, perplexity, google_ai_overviews): every reading is that model's own slice; rank and score are null on every reading and enginesBacking is left off the row entirely, because one model's slice cannot answer them — never read that as 'no model named them' (under all, an EMPTY enginesBacking is the one that means no model named the company on the latest map). " +
      "A company with no measured reading for that model in the window is left out. " +
      "`null` anywhere on this response means the scope was not measured, never a zero: rank and score are null for a company off that check's map and for every reading under a provider, window.answersReceived is null when the model asked for had no usable answer in the latest window, and a null presence on a series point means that model returned no usable answer in that check's window. " +
      "A measured zero always ships as 0 — a company a map does not carry is a measured zero of that map's answers. " +
      "detail=series adds each company's share check by check, at most 12 points spread evenly over the window: ask for it only when the shape between the ends matters, because the rows already carry both ends and the difference. " +
      "The window reads at most the newest 200 published checks — readings and events.incompleteCycles alike — so on a long history use dateFrom/dateTo (ISO-8601) to keep the two on one span. " +
      "Every figure here is a stored map's own reading; nothing is estimated. " +
      "Never report a change as a fact about a third party's business — it is a change in how the AI models answered.",
    parameters: z.object({
      projectId: objectId("Project ID (from list_projects)"),
      dateFrom: z
        .string()
        .optional()
        .describe(
          "Start of the window, ISO-8601 (e.g., 2026-01-01). Omit for the whole history (the newest 200 published checks).",
        ),
      dateTo: z
        .string()
        .optional()
        .describe("End of the window, ISO-8601 (e.g., 2026-03-15)."),
      provider: z
        .enum(["openai", "claude", "gemini", "perplexity", "google_ai_overviews"])
        .optional()
        .describe(
          "Read one AI model's own slice of every map. Omit for every model at once. " +
            "Under one model, rank and score are null on every reading and enginesBacking is left off the rows — they exist only across every model; never read that as 'no model named them'.",
        ),
      detail: z
        .literal("series")
        .optional()
        .describe(
          "`series` adds each company's share check by check (at most 12 evenly spaced points). " +
            "Omit unless the shape between the ends matters — the rows already carry the reading now, the reading at the start, and the difference.",
        ),
    }),
    path: (a) => `/v1/projects/${a.projectId}/ai-visibility/trend`,
    queryParams: ["dateFrom", "dateTo", "provider", "detail"],
    annotations: { readOnlyHint: true, openWorldHint: false },
  },

  // ── AI Sources ────────────────────────────────────────────
  {
    name: "get_ai_sources_dashboard",
    description:
      "Get the latest AI Sources data for a project — which pages Perplexity and Google AI Overviews read when they answer this project's buyers' questions, and whether the customer is on them. " +
      "Each engine is asked the project's 8 buying questions, and for each engine the response reports which companies it named, which pages it RETRIEVED to answer, and which of those pages name the customer's competitors and not the customer. " +
      "Everything is read off the stored summary of the latest published check — the same document the app shows — under summary. " +
      "summary.verdict is a CONDITION CODE decided when the summary was built — never a rating, and never re-derived from the numbers: recommended_nowhere means no answer in the window named the customer; named_on_most_core_hosts means the customer is named on at least half of the core hosts, so a short work list is the finding rather than an empty result; missing_from_most_core_hosts means named somewhere and absent from most of the hosts more than one engine read. " +
      "State the condition beside the counts it rests on (the customer's row on summary.brands, summary.funnel). READING THE NUMBERS. " +
      "Every count names its universe on the same object — quote the pair, never the count alone: answersNamingCustomer of answersReceived; independentPagesNamingCustomer over pagesRead. " +
      "A shortfall is two facts, never a ratio: say '8 asked, 6 answered'. " +
      "A page count given as floor and ceiling belongs to a brand whose name is ordinary language: quote both, never one. " +
      "An engine ABSENT from a per-engine record was not asked on that check; an engine present with engineDataAvailable produced nothing usable — both mean not measured, never zero, and neither is a fact about the customer. " +
      "summary.matrix has three cell states, never two: answered, no_answer_shown (the engine was read and showed nothing — measured, not an answer, not a failure, in no denominator) and not_measured (we could not read it — not a zero). " +
      "An answered cell with pagesRetrieved 0 is an answer that reported no page — an answer received that contributed no page; say 'no pages reported', never 'from memory', because the engine has not said how it answered. " +
      "TWO SENTENCES THIS DATA CANNOT SUPPORT — never write either. " +
      "A citation count: an engine hands back the pages it retrieved while answering and does not say which it leaned on, so say 'retrieved', never 'cited'. " +
      "A pooled page number: the engines read different pages, so every page count is one engine's and is never added to the other's — summary.limits.pagesRetrieved is a fetch-stage inventory, not 'the pages the engines read'. " +
      "The one cross-engine object is the core: hosts at least 2 engines retrieved, on summary.overlap and summary.coreHosts. " +
      "Answers may pool as a vote on summary.brands (rankByPresence orders by how often a brand is named, ties share a rank, and two brands whose presenceLow/presenceHigh ranges overlap are NOT ordered); each row's perEngine says which engines back it, and its page counts stay per engine. " +
      "Counts are counts, never rates: report figures as `n of N answers` and never as a percentage or a share — the question set is small by design, and a share computed from it is false precision. " +
      "LEAD WITH THE FUNNEL, summary.funnel: hosts more than one engine read → already naming the customer → could not be read → genuinely missing, split into third-party publishers and competitor-owned sites. " +
      "On a market leader the end is small because most of the core already names them: say 'already on 19 of the 25 hosts more than one engine read', never 'nothing found'. " +
      "THE WORK LIST is every summary.coreHosts row whose status is missing — at least one page there was READ and none names the customer. " +
      "A row whose status is unreadable was not read and is never a page the customer is absent from; a row whose status is already_named is won; a competitor_owned row is not won by outreach. " +
      "Never tell the customer to get onto a host whose status is not missing. SENTENCES ARE PAYLOAD. " +
      "summary.limits.sentences carries the standing caveats for this check and each core host's actionHint carries { code, text }: render text VERBATIM, never paraphrase it, and never compose a sentence of your own from a code. " +
      "\"Seen in N of M\" is per engine: N is the row's seenInChecks[engine].checkIds length, M is summary.window.perEngine[engine].checkIds length, and the window holds up to 5 published checks; on a first check everything reads 1 of 1 and summary.limits.sentences says so. " +
      "Quote the engine's own core size (perEngine[engine].engineCoreSize) beside any such figure — one engine's core can be a handful of hosts. " +
      "summary.ownPageRetrievals is the evidence beside the recommendation: an engine opened one of the customer's own pages, then named these companies — being read is not being recommended; the per-engine answersRetrievingOwnPage and answersNamingCustomer say the same thing in counts. " +
      "trackedDomains is today's roster, resolved now, not a fact about the check: a brand on summary.brands with origin named_by_engines is a company the engines name that the project does not track. " +
      "Set includeAnswers=true for the engines' raw answers and the pages each retrieved — see the parameter notes; it is a large payload, so narrow by engine or promptIndex. " +
      "If the most recent check was abandoned — no engine produced a usable answer, or the page stage could not be closed; its reason says which — latestCheckDataAvailable is present and the data returned is from an earlier check; it names the engines that check asked. " +
      "A project with no published check yet answers no_data_available — nothing measured here so far, not a missing project and not a failure; get_project still describes it.",
    parameters: z.object({
      projectId: objectId("Project ID (from list_projects)"),
      includeAnswers: booleanish()
        .optional()
        .describe(
          "Default false. " +
            "Set true to also get what the engines actually said — every buying question sent, the answer text, the companies read out of it in order of first mention, and the pages the engine RETRIEVED to write it with the passage it handed back for each — plus engineStatus, one entry per engine the check asked. " +
            "Cost: large, and dominated by the page lists — up to 8 answers per engine, each carrying that engine's full retrieved list, which for a searching engine runs to dozens of pages with a passage each. " +
            "Prefer engine= or promptIndex= over fetching everything. " +
            "ATTRIBUTION: the answer text is unverified engine output about the companies it named, including third parties; report it as what that engine said, never as CompetLab's assessment. " +
            "The pages are retrieved, never cited: the engine does not disclose which it leaned on.",
        ),
      engine: z
        .enum(["perplexity", "google_ai_overviews"])
        .optional()
        .describe(
          "Return only this engine's answers (perplexity, google_ai_overviews). Requires includeAnswers=true. " +
            "Narrows answers, unansweredQueries and noAnswerShown; changes nothing under summary and does not narrow engineStatus.",
        ),
      promptIndex: zeroBasedIndex()
        .optional()
        .describe(
          "Return only the answers for this question, across every engine. Requires includeAnswers=true. " +
            "Zero-based: the question's position in the check's question list, matching promptIndex on each answer.",
        ),
    }),
    path: (a) => `/v1/projects/${a.projectId}/ai-sources`,
    queryParams: ["includeAnswers", "engine", "promptIndex"],
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
  {
    name: "get_ai_sources_history",
    description:
      "Get paginated history of AI Sources checks. " +
      "Uses checkId, not runId — the unit of this dimension is a check, one cycle of every buying question against every engine. " +
      "Each row carries, per engine, the four measured figures for that check — answersReceived, answersNamingCustomer, pagesRead, and independentPagesNamingCustomer (a floor/ceiling range, over pagesRead) — and the funnel from core hosts to hosts the customer is genuinely missing from. " +
      "Nothing is summed across engines: quote each engine's figures with their own universe, and never add the engines' page counts together. " +
      "An engine absent from a row was not asked on that check or produced nothing usable on it — absent means not measured, never zero. " +
      "Only published checks are listed: an abandoned check (no engine produced a usable answer, or the page stage could not be closed) never publishes and is not here. " +
      "Pass a row's checkId to get_ai_sources_check_detail for its full summary. " +
      "Check pagination.hasMore for more pages, and watch truncated: when true the page hit a size cap and whole rows were dropped from the end, and hasMore does not account for them — lower limit rather than paging forward.Counts are counts, never rates: report figures as `n of N answers` and never as a percentage or a share — the question set is small by design, and a share computed from it is false precision. ",
    parameters: z.object({
      projectId: objectId("Project ID (from list_projects)"),
      ...pagination,
    }),
    path: (a) => `/v1/projects/${a.projectId}/ai-sources/history`,
    queryParams: ["page", "limit"],
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
  {
    name: "get_ai_sources_check_detail",
    description:
      "Get full detail for one AI Sources check. Uses checkId (not runId). " +
      "By default returns the summary stored on that check under summary — the same shape as get_ai_sources_dashboard, as of that check, and read the same way: READING THE NUMBERS. " +
      "Every count names its universe on the same object — quote the pair, never the count alone: answersNamingCustomer of answersReceived; independentPagesNamingCustomer over pagesRead. " +
      "A shortfall is two facts, never a ratio: say '8 asked, 6 answered'. " +
      "A page count given as floor and ceiling belongs to a brand whose name is ordinary language: quote both, never one. " +
      "An engine ABSENT from a per-engine record was not asked on that check; an engine present with engineDataAvailable produced nothing usable — both mean not measured, never zero, and neither is a fact about the customer. " +
      "summary.matrix has three cell states, never two: answered, no_answer_shown (the engine was read and showed nothing — measured, not an answer, not a failure, in no denominator) and not_measured (we could not read it — not a zero). " +
      "An answered cell with pagesRetrieved 0 is an answer that reported no page — an answer received that contributed no page; say 'no pages reported', never 'from memory', because the engine has not said how it answered. " +
      "TWO SENTENCES THIS DATA CANNOT SUPPORT — never write either. " +
      "A citation count: an engine hands back the pages it retrieved while answering and does not say which it leaned on, so say 'retrieved', never 'cited'. " +
      "A pooled page number: the engines read different pages, so every page count is one engine's and is never added to the other's — summary.limits.pagesRetrieved is a fetch-stage inventory, not 'the pages the engines read'. " +
      "The one cross-engine object is the core: hosts at least 2 engines retrieved, on summary.overlap and summary.coreHosts. " +
      "Answers may pool as a vote on summary.brands (rankByPresence orders by how often a brand is named, ties share a rank, and two brands whose presenceLow/presenceHigh ranges overlap are NOT ordered); each row's perEngine says which engines back it, and its page counts stay per engine. " +
      "Counts are counts, never rates: report figures as `n of N answers` and never as a percentage or a share — the question set is small by design, and a share computed from it is false precision. " +
      "summary.verdict is a CONDITION CODE decided when the summary was built — never a rating, and never re-derived from the numbers: recommended_nowhere means no answer in the window named the customer; named_on_most_core_hosts means the customer is named on at least half of the core hosts, so a short work list is the finding rather than an empty result; missing_from_most_core_hosts means named somewhere and absent from most of the hosts more than one engine read. " +
      "State the condition beside the counts it rests on (the customer's row on summary.brands, summary.funnel). SENTENCES ARE PAYLOAD. " +
      "summary.limits.sentences carries the standing caveats for this check and each core host's actionHint carries { code, text }: render text VERBATIM, never paraphrase it, and never compose a sentence of your own from a code. " +
      "Set includeAnswers=true to also get what the engines actually said: every buying question sent, the answer text, the companies read out of it in order of first mention (rank is the order of first mention computed from the text — the engine assigned no position, so never report it as a rank the engine gave), and the pages the engine RETRIEVED with the passage it handed back for each — plus engineStatus, one entry per engine the check asked, with questionsAsked, answersReceived, answersAbsent and answersUnmeasured as separate counts. " +
      "That text is the ENGINE'S wording, attributed to it, never CompetLab's. " +
      "Cost: large, dominated by the page lists; narrow with engine= (one engine) or promptIndex= (one question). " +
      "No filter changes a number under summary; ranks stay stable under any filter. " +
      "If answersTruncated is true the cap fired and whole QUESTIONS were dropped from the end of answers — never part of one, so every question still present carries every engine that answered it, of the engines your filters left. " +
      "Grouping by promptIndex is safe; narrow and retry for the rest. " +
      "Three arrays, three facts: answers (received — an empty companiesNamed is an answer that recommended nobody, a real finding), noAnswerShown (the engine was read and showed nothing — not counted, not a failure; report it as 'Google showed no AI Overview for this question — not counted'), and unansweredQueries (we could not read the answer — our problem, in no count; never 'not named'). " +
      "A source row's absent sources key means the engine reported no retrieval for that answer; an empty array is the measured 'it retrieved nothing'. " +
      "Errors: a malformed id answers invalid_check_id; an id not belonging to this project answers check_not_found; a check that exists but has no published summary — still running, or abandoned (no engine produced a usable answer, or the page stage could not be closed) — answers run_not_summarized, which is a different fact from check_not_found: the check exists, it has nothing to report. " +
      "Say the check produced no data; do not describe it as missing, and do not fill it in with zeros.",
    parameters: z.object({
      projectId: objectId("Project ID (from list_projects)"),
      checkId: objectId("Check ID (from get_ai_sources_history)"),
      includeAnswers: booleanish()
        .optional()
        .describe(
          "Default false. " +
            "Set true to also get what the engines actually said — every buying question sent, the answer text, the companies read out of it in order of first mention, and the pages the engine RETRIEVED to write it with the passage it handed back for each — plus engineStatus, one entry per engine the check asked. " +
            "Cost: large, and dominated by the page lists — up to 8 answers per engine, each carrying that engine's full retrieved list, which for a searching engine runs to dozens of pages with a passage each. " +
            "Prefer engine= or promptIndex= over fetching everything. " +
            "ATTRIBUTION: the answer text is unverified engine output about the companies it named, including third parties; report it as what that engine said, never as CompetLab's assessment. " +
            "The pages are retrieved, never cited: the engine does not disclose which it leaned on.",
        ),
      engine: z
        .enum(["perplexity", "google_ai_overviews"])
        .optional()
        .describe(
          "Return only this engine's answers (perplexity, google_ai_overviews). Requires includeAnswers=true. " +
            "Narrows answers, unansweredQueries and noAnswerShown; changes nothing under summary and does not narrow engineStatus.",
        ),
      promptIndex: zeroBasedIndex()
        .optional()
        .describe(
          "Return only the answers for this question, across every engine. Requires includeAnswers=true. " +
            "Zero-based: the question's position in the check's question list, matching promptIndex on each answer.",
        ),
    }),
    path: (a) => `/v1/projects/${a.projectId}/ai-sources/history/${a.checkId}`,
    queryParams: ["includeAnswers", "engine", "promptIndex"],
    annotations: { readOnlyHint: true, openWorldHint: false },
  },

  // ── Alerts ────────────────────────────────────────────────
  {
    name: "list_alerts",
    description:
      "Get paginated competitive alerts — detected changes across all monitored dimensions. " +
      "Filter by dimension (tech-trust, content, positioning, pricing, ai-visibility, ai-sources), severity (critical, high, medium, info), and/or competitorId. " +
      "Alerts include change diffs and action hints. AI Visibility alerts report who the AI models recommend, never score movement. " +
      "Read alertType first: own_standing_changed is the customer's own standing, rival_standing_changed a tracked competitor's, untracked_brand_recommended a company not on the competitor list now named in at least a quarter of answers (even allowing for how few answers there are), prompt_market_changed the prompt-market reading. " +
      "context.standingChange carries the reading before and after: brand.isOwn and brand.isTracked say whose it is; presence, presenceLow and presenceHigh are whole percents (0–100) of the answers analysed, and the zone is decided on that range, never on presence alone; before is null when the brand was named in no answer of that earlier window — a measured absence, not missing data; the zone token names a condition, not a verdict. " +
      "Never subtract two presences, and never order two brands whose ranges overlap. context.promptMarketChange.explanation.text is the sentence to quote. " +
      "An alert is written once and never revised: quote its numbers as of its createdAt, not as the current state.",
    parameters: z.object({
      projectId: objectId("Project ID (from list_projects)"),
      ...pagination,
      dimension: z
        .enum([
          "tech-trust",
          "content",
          "positioning",
          "pricing",
          "ai-visibility",
          "ai-sources",
        ])
        .optional()
        .describe("Filter by dimension"),
      severity: z
        .enum(["critical", "high", "medium", "info"])
        .optional()
        .describe("Filter by severity level"),
      competitorId: z
        .string()
        .optional()
        .describe("Filter by competitor ID (from list_competitors)"),
    }),
    path: (a) => `/v1/projects/${a.projectId}/alerts`,
    queryParams: ["page", "limit", "dimension", "severity", "competitorId"],
    annotations: { readOnlyHint: true, openWorldHint: false },
  },

  // ── Schedules ─────────────────────────────────────────────
  {
    name: "list_schedules",
    description:
      "Get monitoring schedules for all 6 dimensions. " +
      "Returns enabled/disabled status, interval in days, next run timestamp, and last run timestamp per dimension. " +
      "Dimension names use marketing names (tech-trust, content, positioning, pricing, ai-visibility, ai-sources).",
    parameters: z.object({
      projectId: objectId("Project ID (from list_projects)"),
    }),
    path: (a) => `/v1/projects/${a.projectId}/schedules`,
    annotations: { readOnlyHint: true, openWorldHint: false },
  },

  // ── Strategic Briefing ────────────────────────────────────
  {
    name: "get_briefing",
    description:
      "Get the current state of the project's Strategic Briefing — the synthesized, prioritized analysis across 14 analysis areas: the 6 monitored dimensions it reads from your stored checks, plus 8 it researches for the briefing alone (landscape, funding, hiring/GTM, product launches and more): what changed and what it means. " +
      "This is the ANALYZED, as-of read, NOT raw monitoring — for live per-dimension data use the get_<dimension>_dashboard tools (e.g. " +
      "get_pricing_dashboard); for the monitored-competitor roster use list_competitors. " +
      "Defaults to the executive 'hub' — a cheap digest (headline, top moves, and per-dimension verdicts that name the deeper section to open next) that answers most questions in one call. " +
      "WHAT THE EDITION RECOMMENDS DOING IS NOT IN `item`. " +
      "Those recommendations are opened as tickets on the project's Strategic Tickets board — they land in the triage column and the team moves them from there — each carrying the dimension it came from and the edition's own estimate of the work. " +
      "`tickets` on the response says how many this edition opened and how many now sit in each column, counted as you read — so it moves as the team works, and a recommendation the team edited or dismissed reads from the board rather than from the edition. " +
      "IMPORTANT — this returns the LATEST run in whatever state it is in. " +
      "Check meta.status: on 'done' the briefing is in `item`; on 'running' it is being generated now (meta.progress gives the step; a run typically takes about two hours — treat it as running until meta.status changes, and never report it as late or failed because of how long it has taken); on 'failed' the last attempt ended without producing an edition; on null the project has never had a briefing at all. " +
      "On 'running' or 'failed', `item` is null but an earlier edition is usually still readable — call get_briefing_history and then get_briefing_edition. " +
      "NEVER tell the user no briefing is available on the strength of a null `item` without checking get_briefing_history first. " +
      "Only meta.status === null means the project genuinely has nothing. " +
      "Briefings are generated automatically, roughly 30 days after the last successful one; a failed run does not resume that cycle on its own, so surface it rather than telling the user to wait.",
    parameters: z.object({
      projectId: objectId("Project ID (from list_projects)"),
      sections: z
        .array(
          z.enum([
            "hub",
            "competitors",
            "deep-ai-visibility",
            "deep-ai-sources",
            "deep-positioning",
            "deep-pricing",
            "deep-content",
            "deep-tech-trust",
            "deep-agent-readiness",
            "deep-ai-ecosystem",
            "deep-customer-voice",
            "deep-funding-capital",
            "deep-hiring-gtm",
            "deep-landscape",
            "deep-product-launches",
            "deep-reliability-status",
            "all",
          ]),
        )
        .optional()
        .describe(
          "Which briefing sections to return. " +
            "Default ['hub'] — the executive digest that orients you and points to the deeper sections by name; this alone answers most questions in one cheap call. " +
            "Add sections only when the question needs them: 'competitors' (the rival-by-rival read), any 'deep-<dimension>' for a full dimension dive (e.g. " +
            "'deep-ai-visibility', 'deep-pricing' — 14 available; the hub's verdicts tell you which one to open), or 'all' for the entire briefing (large — export/full-read only). " +
            "The response's `contains` array lists exactly which sections that edition actually holds, in this same vocabulary — read it instead of guessing. " +
            "What the edition recommends doing is in none of them: those recommendations are tickets on the project's board, and `tickets` on the response says how they stand.",
        ),
      includeCharts: z
        .boolean()
        .optional()
        .describe(
          "Default false — each chart returns its title and note only, with NO underlying numbers, so do not answer a question about figures or a trend from a chart unless you set this. " +
            "Set true to include the full series (time-series points, bar values); larger payload — use it only when you need the actual numbers.",
        ),
    }),
    path: (a) => `/v1/projects/${a.projectId}/strategic-briefing`,
    queryParams: ["sections", "includeCharts"],
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
  {
    name: "get_briefing_history",
    description:
      "List this project's past Strategic Briefing editions, newest first. " +
      "Returns one cheap metadata row each — runId, publication date, edition number, status, and that edition's one-line headline verdict — and NEVER briefing content. " +
      "Use it to find WHICH edition to open ('what did we say in April', 'how has the read changed'), then call get_briefing_edition with that runId. " +
      "For the project's current state use get_briefing, not this. " +
      "Runs that failed or are still generating are included too, with a null date and headline — so a gap between two editions is explained rather than left unexplained. " +
      "This is also the correct fallback when get_briefing reports status 'running' or 'failed': the newest readable edition is the most recent row here with status 'done'. " +
      "Check pagination.hasMore to fetch additional pages.",
    parameters: z.object({
      projectId: objectId("Project ID (from list_projects)"),
      ...pagination,
    }),
    path: (a) => `/v1/projects/${a.projectId}/strategic-briefing/history`,
    queryParams: ["page", "limit"],
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
  {
    name: "get_briefing_edition",
    description:
      "Get one past Strategic Briefing edition in full, by runId (from get_briefing_history). " +
      "Returns exactly the same shape as get_briefing, with the same 'sections' and 'includeCharts' options and the same 'hub' default. " +
      "Use this to read or quote a specific past edition — including the last readable one when get_briefing reports a 'running' or 'failed' status. " +
      "For the current state use get_briefing. " +
      "What this edition recommended doing is not in `item`: those recommendations are tickets on the project's Strategic Tickets board, and `tickets` on the response says how many it opened and how many now sit in each column, counted as you read. " +
      "Quote that rather than the edition when the question is what the team did about it. " +
      "A runId naming a run that failed or is still generating returns successfully with meta.status set and `item` null: that run genuinely produced no edition, which is an answer, not an error.",
    parameters: z.object({
      projectId: objectId("Project ID (from list_projects)"),
      runId: objectId("Briefing run ID (from get_briefing_history)"),
      sections: z
        .array(
          z.enum([
            "hub",
            "competitors",
            "deep-ai-visibility",
            "deep-ai-sources",
            "deep-positioning",
            "deep-pricing",
            "deep-content",
            "deep-tech-trust",
            "deep-agent-readiness",
            "deep-ai-ecosystem",
            "deep-customer-voice",
            "deep-funding-capital",
            "deep-hiring-gtm",
            "deep-landscape",
            "deep-product-launches",
            "deep-reliability-status",
            "all",
          ]),
        )
        .optional()
        .describe(
          "Which briefing sections to return. " +
            "Default ['hub'] — the executive digest that orients you and points to the deeper sections by name; this alone answers most questions in one cheap call. " +
            "Add sections only when the question needs them: 'competitors' (the rival-by-rival read), any 'deep-<dimension>' for a full dimension dive (e.g. " +
            "'deep-ai-visibility', 'deep-pricing' — 14 available; the hub's verdicts tell you which one to open), or 'all' for the entire briefing (large — export/full-read only). " +
            "The response's `contains` array lists exactly which sections that edition actually holds, in this same vocabulary — read it instead of guessing. " +
            "What the edition recommends doing is in none of them: those recommendations are tickets on the project's board, and `tickets` on the response says how they stand.",
        ),
      includeCharts: z
        .boolean()
        .optional()
        .describe(
          "Default false — each chart returns its title and note only, with NO underlying numbers, so do not answer a question about figures or a trend from a chart unless you set this. " +
            "Set true to include the full series (time-series points, bar values); larger payload — use it only when you need the actual numbers.",
        ),
    }),
    path: (a) => `/v1/projects/${a.projectId}/strategic-briefing/history/${a.runId}`,
    queryParams: ["sections", "includeCharts"],
    annotations: { readOnlyHint: true, openWorldHint: false },
  },

  // ── Free Tools (no project context required) ──────────────
  {
    name: "check_sitemap",
    description:
      "Live sitemap analysis for any domain — discovers URLs, categorizes them by section, and reports depth, freshness, and per-category counts. " +
      "Reads both the conventional /sitemap.xml and every sitemap robots.txt declares, deduplicated, so a site publishing several returns all of them. " +
      "`status: 'partial'` means the scan did not cover the whole corpus — NOT that the site is broken. " +
      "It has two distinct causes and they are not interchangeable: the scan hit its own limits, or a sitemap the site declares could not be read. " +
      "Only the second populates `unreadSitemaps`, and those entries ARE the site's own defect (a relative URL in robots.txt, a redirect off its domain, a server that refused). " +
      "Never report a count from a partial scan as the site's total. " +
      "Categories include `programmatic`: templated pages generated from a database or pattern, assigned only to groups of 25+ sibling URLs with machine-generated slugs. " +
      "It describes how pages are generated, not their purpose — example URLs ship in `insights.sampleUrlsByCategory`.",
    parameters: z.object({
      domain: z
        .string()
        .describe("Domain to scan, e.g. example.com"),
      sitemapUrl: z
        .string()
        .url()
        .optional()
        .describe(
          "Optional full URL to a specific sitemap (with http:// or https:// prefix). Short-circuits discovery.",
        ),
    }),
    method: "POST",
    path: () => "/v1/tools/sitemap-visualizer",
    bodyParams: ["domain", "sitemapUrl"],
    annotations: { readOnlyHint: true, openWorldHint: true },
  },
  {
    name: "check_ai_crawlers",
    description:
      "Live check of which AI ASSISTANTS can fetch a site's pages, read from its robots.txt. " +
      "`assistantAccess` is the answer — one verdict per assistant (ChatGPT, Claude, Perplexity, Microsoft Copilot, Google AI Overviews, Gemini Apps) with the crawlers that decided each named beside it. " +
      "Count that array for totals; no count is stored, and there is deliberately no overall score. " +
      "TWO THINGS IT DOES NOT TELL YOU, both of which get misreported: it says an assistant is PERMITTED to fetch the site, never that it cites it; and `modelTrainingAccess` is a separate, NEUTRAL fact — blocking training crawlers costs no visibility and is a legitimate content decision, so never report it as a gap or advise undoing it. " +
      "The one exception is mechanical: where a token under `modelTrainingAccess[].decidedByCrawlers` also appears under `assistantAccess[].decidedByCrawlers` (Google-Extended is the documented case), that block DOES cost visibility — match on `userAgentToken` before applying the general rule. " +
      "`crawlers[].ruleAudience` tells you whether a rule NAMED the crawler or a `User-agent: *` catch-all swept it up; the second is usually accidental and is the more actionable finding. " +
      "When robots.txt cannot be read, it returns the read outcome and NO verdict — no assistant access, no crawler list, no advice — so check `robotsTxt.read` first. " +
      "A failed read is not an open site.",
    parameters: z.object({
      domain: z
        .string()
        .describe("Domain to scan, e.g. example.com"),
      industry: z
        .enum([
          "news-media",
          "arts-entertainment",
          "law-government",
          "finance-healthcare",
          "saas-tech",
          "ecommerce",
          "other",
        ])
        .optional()
        .describe("Industry context for benchmark comparison."),
    }),
    method: "POST",
    path: () => "/v1/tools/ai-crawler-checker",
    bodyParams: ["domain", "industry"],
    annotations: { readOnlyHint: true, openWorldHint: true },
  },
  {
    name: "fetch_url",
    description:
      "Fetch any URL with automatic JS-rendering and common bot-protection handling — advanced behavioral fingerprinting may still block header retrieval (surfaced via `headersAvailable: false`). " +
      "Returns body, headers, cleanStats. Optional `cleanHtml` strips HTML noise while preserving text content — token-cost win for LLM consumption.",
    parameters: z.object({
      url: z
        .string()
        .url()
        .describe("Target URL to fetch. Must use http:// or https:// and resolve to a public host."),
      bodyNeeded: z
        .boolean()
        .optional()
        .describe(
          "Include `body` and `contentType` in the response. Defaults to service-controlled value when omitted.",
        ),
      headersNeeded: z
        .boolean()
        .optional()
        .describe(
          "Include `headers` and `headersAvailable` in the response. Defaults to service-controlled value when omitted. " +
            "When the target site uses advanced behavioral fingerprinting, `headersAvailable` is `false` and `headers` is an empty object — present, not missing. " +
            "Branch on `headersAvailable`, never on whether `headers` exists.",
        ),
      cleanHtml: z
        .boolean()
        .optional()
        .describe(
          "When `true` and the response content-type is `text/html`, strip HTML noise (scripts, styles, comments) while preserving text content. " +
            "Significant token-cost reduction for LLM consumption — per-request reduction reported in `cleanStats`. Requires `bodyNeeded`.",
        ),
      maxTimeoutMs: z
        .number()
        .int()
        .min(1000)
        .max(120000)
        .optional()
        .describe(
          "Caller-side timeout budget in milliseconds. Accepted range 1000–120000. Defaults to service-controlled value when omitted.",
        ),
      bodyMaxBytes: z
        .number()
        .int()
        .min(1024)
        .max(104857600)
        .optional()
        .describe(
          "Per-request response body cap in bytes. Accepted range 1024–104857600 (1 KiB – 100 MiB). Oversize responses are rejected pre-buffer. " +
            "Defaults to service-controlled value when omitted.",
        ),
    }),
    method: "POST",
    path: () => "/v1/tools/fetch-url",
    bodyParams: ["url", "bodyNeeded", "headersNeeded", "cleanHtml", "maxTimeoutMs", "bodyMaxBytes"],
    annotations: { readOnlyHint: true, openWorldHint: true },
  },
  {
    name: "start_tech_stack_scan",
    description:
      "Start an async tech-stack detection on any domain — 117 detection rules across tech stack (hosting / frameworks / CMS / payments), growth stack (analytics / marketing / CRM / advertising), and engagement stack (support / forms / video / monitoring). " +
      "Returns scanId immediately; poll with `get_tech_stack_scan`. Typical completion: 30-90 seconds.",
    parameters: z.object({
      domain: z
        .string()
        .describe("Domain to scan, e.g. example.com"),
    }),
    method: "POST",
    path: () => "/v1/tools/tech-stack/scans",
    bodyParams: ["domain"],
    annotations: { readOnlyHint: false, openWorldHint: true },
  },
  {
    name: "get_tech_stack_scan",
    description:
      "Retrieve status or full results of a tech-stack scan by scanId. " +
      "Returns current status while running, detected technologies with confidence scores when complete. " +
      "A completed scan can be PARTIAL, and the payload says so with `partialDetection`. " +
      "When it is present, the site's behavioral protection blocked us from reading its response headers, so the hosting and CDN rules could not run at all — everything listed IS a real detection and should be reported normally, but `totalTechnologies` is a FLOOR, not a total. " +
      "Do not compare it against another domain's count, do not say 'N technologies against your M', and never write that the site runs no CDN or no managed hosting: a technology's absence from a partial scan is not evidence they lack it. " +
      "Recommended poll interval: 5-10 seconds.",
    parameters: z.object({
      scanId: objectId("Scan ID (from start_tech_stack_scan)"),
    }),
    path: (a) => `/v1/tools/tech-stack/scans/${a.scanId}`,
    annotations: { readOnlyHint: true, openWorldHint: true },
  },
  {
    name: "start_trust_signals_scan",
    description:
      "Start an async trust-signals analysis on any domain — 34 signals across enterprise readiness, third-party validation, social proof, brand authority, and risk reversal. " +
      "That set is the trust-signals SCAN taxonomy and is a different thing from the homepage trust signals the monitored Tech & Trust dimension tracks (see get_tech_trust_dashboard), which are 26 signals in five different categories. " +
      "Never quote a count from one as if it described the other. " +
      "AND ONE CATEGORY NAME COLLIDES: `socialProof` is a field on both, spelled identically, and both have exactly five members — so neither the name nor the count reveals that they differ. " +
      "Here the five are customer logos, hero-only logos, customer count, case studies and testimonials. " +
      "In the monitored dimension they are customer logos, customer count claim, case studies, money-back guarantee and free trial. " +
      "A `socialProof` of 4 from this scan and 3 from the dashboard is not a change and not a discrepancy; the two were never measuring the same set. " +
      "If you hold both numbers, report them separately or not at all. Returns scanId immediately; poll with `get_trust_signals_scan`. " +
      "Typical completion: 30-90 seconds.",
    parameters: z.object({
      domain: z
        .string()
        .describe("Domain to scan, e.g. example.com"),
    }),
    method: "POST",
    path: () => "/v1/tools/trust-signals/scans",
    bodyParams: ["domain"],
    annotations: { readOnlyHint: false, openWorldHint: true },
  },
  {
    name: "get_trust_signals_scan",
    description:
      "Retrieve status or full results of a trust-signals scan by scanId. " +
      "Returns current status while running, per-signal verdicts and tier verdict when complete. " +
      "Roughly 1% of sites run behavioral protection that hides their response headers from us. Those results carry headerInspection: { available: false }. " +
      "Read that as a note about the fetch, NOT as a caveat on the numbers: the page body was read in full, all 34 rules read the body and none reads headers, so the scan is complete and its tier, score, category scores and meta.signalsEvaluated are exact. " +
      "Report them exactly as you would any other scan, and do not describe them as partial, provisional, or a minimum. " +
      "The only thing the marker rules out is an evidence entry with kind: 'header'. " +
      "Separately, a null in verdict, categoryScores, signalsDetected, suspiciousPatterns, gapsVsBenchmark or meta.signalsEvaluated means the page was never inspected at all — that only occurs on scans stored before this behavior shipped (results persist 24h). " +
      "Report a null as no result; never as a low score, a minimal tier, or 'no trust signals found'. " +
      "An empty ARRAY is the opposite and IS a finding: we read the page and found none in that category. Recommended poll interval: 5-10 seconds.",
    parameters: z.object({
      scanId: objectId("Scan ID (from start_trust_signals_scan)"),
    }),
    path: (a) => `/v1/tools/trust-signals/scans/${a.scanId}`,
    annotations: { readOnlyHint: true, openWorldHint: true },
  },
  {
    name: "start_agent_adoption_scan",
    description:
      "Start an async Agent Adoption Check on any domain — 25 checks across discoverability, access control, content readability, and agent endpoints, per the open Agent-Adoption Specification. " +
      "Returns scanId immediately; poll with `get_agent_adoption_scan`. Typical completion: 30-90 seconds.",
    parameters: z.object({
      domain: z
        .string()
        .describe("Domain to scan, e.g. example.com"),
    }),
    method: "POST",
    path: () => "/v1/tools/agent-adoption/scans",
    bodyParams: ["domain"],
    annotations: { readOnlyHint: false, openWorldHint: true },
  },
  {
    name: "get_agent_adoption_scan",
    description:
      "Retrieve status or full results of an Agent Adoption Check by scanId. Returns current status while running, complete results when finished. " +
      "Recommended poll interval: 5-10 seconds.",
    parameters: z.object({
      scanId: objectId("Scan ID (from start_agent_adoption_scan)"),
    }),
    path: (a) => `/v1/tools/agent-adoption/scans/${a.scanId}`,
    annotations: { readOnlyHint: true, openWorldHint: true },
  },
];
