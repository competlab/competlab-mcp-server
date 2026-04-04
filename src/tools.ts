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

export interface ToolDef {
  name: string;
  description: string;
  parameters: z.ZodObject<any>;
  path: (args: Record<string, any>) => string;
  queryParams?: string[];
}

export const tools: ToolDef[] = [
  // ── Projects ──────────────────────────────────────────────
  {
    name: "list_projects",
    description:
      "List all projects in your organization with status, competitor count, and last monitored timestamp. Start here — call this first to discover available projectId values required by all other tools. Read-only. Returns JSON array of projects.",
    parameters: z.object({}),
    path: () => "/v1/projects",
  },
  {
    name: "get_project",
    description:
      "Get project details including per-dimension monitoring freshness (techTrust, content, positioning, pricing, aiVisibility), AI monitoring prompts, and overall status. Use this after list_projects to check when each dimension was last updated before fetching dimension data. Read-only. Returns JSON object.",
    parameters: z.object({
      projectId: objectId("Project ID (from list_projects)"),
    }),
    path: (a) => `/v1/projects/${a.projectId}`,
  },

  // ── Competitors ───────────────────────────────────────────
  {
    name: "list_competitors",
    description:
      "List all competitors being monitored for a project. Includes the user's own domain (marked isOwn: true) for self-analysis comparison. Returns domain, name, and status for each competitor. Use this to get competitorId values needed by list_alerts, get_competitor, and get_content_changelog. Read-only. Returns JSON array.",
    parameters: z.object({
      projectId: objectId("Project ID (from list_projects)"),
    }),
    path: (a) => `/v1/projects/${a.projectId}/competitors`,
  },
  {
    name: "get_competitor",
    description:
      "Get competitor details including monitored pages (homepage URL, pricing page URL) and configuration. Use this when you need specific competitor metadata beyond what list_competitors provides — for example, to find which URLs are being tracked. Requires competitorId from list_competitors. Read-only. Returns JSON object.",
    parameters: z.object({
      projectId: objectId("Project ID (from list_projects)"),
      competitorId: objectId("Competitor ID (from list_competitors)"),
    }),
    path: (a) => `/v1/projects/${a.projectId}/competitors/${a.competitorId}`,
  },

  // ── Alerts ────────────────────────────────────────────────
  {
    name: "list_alerts",
    description:
      "Get paginated competitive alerts — detected changes across all monitored dimensions. Filter by dimension (tech-trust, content, positioning, pricing, ai-visibility), severity (critical, high, medium, info), and/or competitorId. Alerts include change diffs and action hints. Use this to find recent competitive changes before diving into specific dimension dashboards. Read-only. Returns paginated JSON array with pagination.hasMore flag.",
    parameters: z.object({
      projectId: objectId("Project ID (from list_projects)"),
      ...pagination,
      dimension: z
        .enum(["tech-trust", "content", "positioning", "pricing", "ai-visibility"])
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
  },

  // ── Tech & Trust ──────────────────────────────────────────
  {
    name: "get_tech_trust_dashboard",
    description:
      "Get the latest Tech & Trust Profile for all competitors. Returns security headers (grade A-F, HSTS, CSP, X-Frame-Options), trust signals (compliance, reviews, social proof, certifications — 24 signals in 4 categories), technology stack (47 tech, 43 growth, 27 engagement tools), robots.txt AI bot blocking status, DNS infrastructure, and AI analysis with insights and actions. Use this for the current snapshot; use get_tech_trust_history for past runs. Read-only. Returns JSON object.",
    parameters: z.object({
      projectId: objectId("Project ID (from list_projects)"),
    }),
    path: (a) => `/v1/projects/${a.projectId}/tech-trust`,
  },
  {
    name: "get_tech_trust_history",
    description:
      "Get paginated history of Tech & Trust monitoring runs with completion timestamps. Use this to compare changes over time — each run captures a full snapshot of all competitors. Retrieve specific run data with get_tech_trust_run_detail using the runId from this response. Read-only. Returns paginated JSON array with pagination.hasMore flag.",
    parameters: z.object({
      projectId: objectId("Project ID (from list_projects)"),
      ...pagination,
    }),
    path: (a) => `/v1/projects/${a.projectId}/tech-trust/history`,
    queryParams: ["page", "limit"],
  },
  {
    name: "get_tech_trust_run_detail",
    description:
      "Get full competitor-by-competitor Tech & Trust data for a specific historical run. Returns the same data structure as get_tech_trust_dashboard but for a past point in time. Use this to investigate what changed between runs or to audit a specific monitoring cycle. Requires runId from get_tech_trust_history. Read-only. Returns JSON object.",
    parameters: z.object({
      projectId: objectId("Project ID (from list_projects)"),
      runId: objectId("Run ID (from get_tech_trust_history)"),
    }),
    path: (a) => `/v1/projects/${a.projectId}/tech-trust/history/${a.runId}`,
  },

  // ── Content ───────────────────────────────────────────────
  {
    name: "get_content_dashboard",
    description:
      "Get the latest Content Intelligence for all competitors. Returns sitemap URL counts, strategic URL identification, content categorization (11 categories), sitemap structure data, content gap analysis, and AI analysis with insights and actions. Use this for the current snapshot; use get_content_history for past runs or get_content_changelog for URL-level changes. Read-only. Returns JSON object.",
    parameters: z.object({
      projectId: objectId("Project ID (from list_projects)"),
    }),
    path: (a) => `/v1/projects/${a.projectId}/content`,
  },
  {
    name: "get_content_history",
    description:
      "Get paginated history of Content Intelligence monitoring runs with completion timestamps. Use this to compare content snapshots over time — each run captures sitemap analysis for all competitors. Retrieve specific run data with get_content_run_detail using the runId from this response. Read-only. Returns paginated JSON array with pagination.hasMore flag.",
    parameters: z.object({
      projectId: objectId("Project ID (from list_projects)"),
      ...pagination,
    }),
    path: (a) => `/v1/projects/${a.projectId}/content/history`,
    queryParams: ["page", "limit"],
  },
  {
    name: "get_content_run_detail",
    description:
      "Get full competitor-by-competitor Content Intelligence data for a specific historical run. Returns the same data structure as get_content_dashboard but for a past point in time. Use this to investigate content strategy changes between runs. Requires runId from get_content_history. Read-only. Returns JSON object.",
    parameters: z.object({
      projectId: objectId("Project ID (from list_projects)"),
      runId: objectId("Run ID (from get_content_history)"),
    }),
    path: (a) => `/v1/projects/${a.projectId}/content/history/${a.runId}`,
  },
  {
    name: "get_content_changelog",
    description:
      "Get detected content changes over time — new URLs, removed URLs, moved URLs. Filter by competitor and/or content category (e.g., blog, docs, tools, landing, caseStudies). Use this instead of comparing full runs when you only need to know what changed. Complements get_content_dashboard which shows the current state. Read-only. Returns paginated JSON array with pagination.hasMore flag.",
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
          "legal",
          "caseStudies",
          "comparison",
          "integrations",
          "changelog",
          "webinars",
          "other",
        ])
        .optional()
        .describe("Filter by content category"),
    }),
    path: (a) => `/v1/projects/${a.projectId}/content/changelog`,
    queryParams: ["page", "limit", "competitorId", "category"],
  },

  // ── Positioning ───────────────────────────────────────────
  {
    name: "get_positioning_dashboard",
    description:
      "Get the latest Positioning analysis for all competitors. Returns homepage messaging: page title, main headline, tagline, value proposition, primary/secondary CTAs, key offerings, target audience, main differentiator, pricing mentions, free trial info, and AI analysis with insights and actions. Use this for the current snapshot; use get_positioning_history for past runs. Read-only. Returns JSON object.",
    parameters: z.object({
      projectId: objectId("Project ID (from list_projects)"),
    }),
    path: (a) => `/v1/projects/${a.projectId}/positioning`,
  },
  {
    name: "get_positioning_history",
    description:
      "Get paginated history of Positioning monitoring runs with completion timestamps. Use this to track how competitors change their homepage messaging over time. Retrieve specific run data with get_positioning_run_detail using the runId from this response. Read-only. Returns paginated JSON array with pagination.hasMore flag.",
    parameters: z.object({
      projectId: objectId("Project ID (from list_projects)"),
      ...pagination,
    }),
    path: (a) => `/v1/projects/${a.projectId}/positioning/history`,
    queryParams: ["page", "limit"],
  },
  {
    name: "get_positioning_run_detail",
    description:
      "Get full competitor-by-competitor Positioning data for a specific historical run. Returns the same data structure as get_positioning_dashboard but for a past point in time. Use this to investigate how competitor messaging evolved between runs. Requires runId from get_positioning_history. Read-only. Returns JSON object.",
    parameters: z.object({
      projectId: objectId("Project ID (from list_projects)"),
      runId: objectId("Run ID (from get_positioning_history)"),
    }),
    path: (a) => `/v1/projects/${a.projectId}/positioning/history/${a.runId}`,
  },

  // ── Pricing ───────────────────────────────────────────────
  {
    name: "get_pricing_dashboard",
    description:
      "Get the latest Pricing Intelligence for all competitors. Returns structured pricing plans (name, price, billing interval, summary — up to 5 plans per competitor), market pricing statistics, pricing gap analysis, and AI analysis with insights and actions. Use this for the current snapshot; use get_pricing_history for past runs. Read-only. Returns JSON object.",
    parameters: z.object({
      projectId: objectId("Project ID (from list_projects)"),
    }),
    path: (a) => `/v1/projects/${a.projectId}/pricing`,
  },
  {
    name: "get_pricing_history",
    description:
      "Get paginated history of Pricing Intelligence monitoring runs with completion timestamps. Use this to track how competitor pricing changes over time. Retrieve specific run data with get_pricing_run_detail using the runId from this response. Read-only. Returns paginated JSON array with pagination.hasMore flag.",
    parameters: z.object({
      projectId: objectId("Project ID (from list_projects)"),
      ...pagination,
    }),
    path: (a) => `/v1/projects/${a.projectId}/pricing/history`,
    queryParams: ["page", "limit"],
  },
  {
    name: "get_pricing_run_detail",
    description:
      "Get full competitor-by-competitor Pricing Intelligence data for a specific historical run. Returns the same data structure as get_pricing_dashboard but for a past point in time. Use this to investigate pricing changes between runs or audit a specific monitoring cycle. Requires runId from get_pricing_history. Read-only. Returns JSON object.",
    parameters: z.object({
      projectId: objectId("Project ID (from list_projects)"),
      runId: objectId("Run ID (from get_pricing_history)"),
    }),
    path: (a) => `/v1/projects/${a.projectId}/pricing/history/${a.runId}`,
  },

  // ── AI Visibility ─────────────────────────────────────────
  {
    name: "get_ai_visibility_dashboard",
    description:
      "Get the latest AI Visibility scores for all competitors. This is CompetLab's unique dimension — no other CI platform tracks how LLMs rank brands. Returns AI Visibility Score (weighted 0-100 composite), Mention Rate (fraction of queries where brand is mentioned), per-provider breakdowns (OpenAI, Claude, Gemini), competitor rankings, and aggregated AI analysis. Each check queries 3 prompts across 3 LLMs = 9 total AI queries. Use this for the current snapshot; use get_ai_visibility_history for past checks or get_ai_visibility_trend for time-series data. Read-only. Returns JSON object.",
    parameters: z.object({
      projectId: objectId("Project ID (from list_projects)"),
    }),
    path: (a) => `/v1/projects/${a.projectId}/ai-visibility`,
  },
  {
    name: "get_ai_visibility_history",
    description:
      "Get paginated history of AI Visibility checks with completion timestamps. Note: uses checkId (not runId) — AI Visibility has a different data model where each check is one 3-prompt x 3-LLM query cycle. Use this to browse past checks; retrieve full detail with get_ai_visibility_check_detail, or use get_ai_visibility_trend for aggregate time-series. Read-only. Returns paginated JSON array with pagination.hasMore flag.",
    parameters: z.object({
      projectId: objectId("Project ID (from list_projects)"),
      ...pagination,
    }),
    path: (a) => `/v1/projects/${a.projectId}/ai-visibility/history`,
    queryParams: ["page", "limit"],
  },
  {
    name: "get_ai_visibility_check_detail",
    description:
      "Get full detail for a specific AI Visibility check including per-competitor rankings, mention rates, AI Visibility Scores, and per-provider results (OpenAI, Claude, Gemini). Returns the same data structure as get_ai_visibility_dashboard but for a past point in time. Uses checkId (not runId) — get checkId values from get_ai_visibility_history. Read-only. Returns JSON object.",
    parameters: z.object({
      projectId: objectId("Project ID (from list_projects)"),
      checkId: objectId("Check ID (from get_ai_visibility_history)"),
    }),
    path: (a) => `/v1/projects/${a.projectId}/ai-visibility/history/${a.checkId}`,
  },
  {
    name: "get_ai_visibility_trend",
    description:
      "Get AI Visibility trend data over time — track how LLM brand perception changes. Returns up to 200 data points. Without provider filter: returns pre-computed aggregate summaries across all LLMs. With provider filter (openai, claude, gemini): computes from raw per-provider results. Use this for time-series analysis; use get_ai_visibility_dashboard for the latest snapshot or get_ai_visibility_check_detail for a specific check. Read-only. Returns JSON array. Dates are ISO-8601 format.",
    parameters: z.object({
      projectId: objectId("Project ID (from list_projects)"),
      dateFrom: z
        .string()
        .optional()
        .describe("Start date in ISO-8601 format (e.g., 2026-01-01)"),
      dateTo: z
        .string()
        .optional()
        .describe("End date in ISO-8601 format (e.g., 2026-03-15)"),
      provider: z
        .enum(["openai", "claude", "gemini"])
        .optional()
        .describe("Filter by LLM provider. Omit for aggregate view across all providers"),
    }),
    path: (a) => `/v1/projects/${a.projectId}/ai-visibility/trend`,
    queryParams: ["dateFrom", "dateTo", "provider"],
  },

  // ── Schedules ─────────────────────────────────────────────
  {
    name: "list_schedules",
    description:
      "Get monitoring schedules for all 5 dimensions. Returns enabled/disabled status, interval in days, next run timestamp, and last run timestamp per dimension. Dimension names use marketing names (tech-trust, content, positioning, pricing, ai-visibility). Use this to check when the next monitoring run is due or verify scheduling configuration. Read-only. Returns JSON array.",
    parameters: z.object({
      projectId: objectId("Project ID (from list_projects)"),
    }),
    path: (a) => `/v1/projects/${a.projectId}/schedules`,
  },

  // ── Analysis ──────────────────────────────────────────────
  {
    name: "get_action_plan",
    description:
      "Get the AI-generated competitive action plan aggregated across all 5 monitoring dimensions. Returns insights (with evidence and related competitors) and recommended actions (with rationale), plus per-dimension analysis freshness timestamps. This is the highest-level intelligence output — start here for a strategic overview before drilling into specific dimensions. Read-only. Returns JSON object.",
    parameters: z.object({
      projectId: objectId("Project ID (from list_projects)"),
    }),
    path: (a) => `/v1/projects/${a.projectId}/analysis/action-plan`,
  },
];
