import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { tools } from "./tools.js";
import { apiGet, apiPost } from "./api-client.js";
import { SERVER_DESCRIPTION, SERVER_INSTRUCTIONS } from "./instructions.js";

const server = new McpServer(
  {
    name: "competlab",
    version: "3.0.1",
    description: SERVER_DESCRIPTION,
  },
  { instructions: SERVER_INSTRUCTIONS },
);

// ── Tools ───────────────────────────────────────────────────

for (const tool of tools) {
  server.registerTool(
    tool.name,
    {
      description: tool.description,
      inputSchema: tool.parameters.shape,
      ...(tool.annotations ? { annotations: tool.annotations } : {}),
    },
    async (args: Record<string, any>) => {
      const path = tool.path(args);
      const query: Record<string, any> = {};
      for (const key of tool.queryParams ?? []) {
        if (args[key] !== undefined) query[key] = args[key];
      }

      if (tool.method === "POST") {
        const body: Record<string, unknown> = {};
        for (const key of tool.bodyParams ?? []) {
          if (args[key] !== undefined) body[key] = args[key];
        }
        return apiPost(path, body);
      }
      return apiGet(path, Object.keys(query).length ? query : undefined);
    },
  );
}

// ── Prompts ─────────────────────────────────────────────────

server.registerPrompt(
  "competitive_overview",
  {
    description:
      "Get a full competitive briefing for a project — strategic briefing, alerts, and all 6 monitored dimension dashboards in one go.",
    argsSchema: { projectId: z.string().describe("Project ID (from list_projects)") },
  },
  async ({ projectId }) => ({
    messages: [
      {
        role: "user" as const,
        content: {
          type: "text" as const,
          text: [
            `Give me a comprehensive competitive briefing for project ${projectId}.`,
            "",
            "Follow this workflow:",
            "1. Call get_briefing (sections defaults to the 'hub' digest) for the strategic read — what changed and what it means. Check meta.status first: on 'running' or 'failed', call get_briefing_history and open the newest 'done' edition with get_briefing_edition instead of reporting that no briefing exists.",
            "2. Call list_alerts (limit 10, severity critical or high) to surface the most important recent changes.",
            "3. Call each dashboard tool for the full picture:",
            "   - get_ai_visibility_dashboard (which companies the AI models recommend, and where you stand among them)",
            "   - get_ai_sources_dashboard (the pages Perplexity and Google AI Overviews read, and whether you are on them)",
            "   - get_positioning_dashboard (homepage messaging, CTAs)",
            "   - get_pricing_dashboard (plans, market stats)",
            "   - get_content_dashboard (sitemap URL counts, content categories, content gap analysis)",
            "   - get_tech_trust_dashboard (security, trust signals, tech stack, AI access)",
            "",
            "Synthesize everything into a concise executive briefing with:",
            "- Top 3 competitive threats",
            "- Top 3 opportunities",
            "- Recommended immediate actions",
            "",
            "A null anywhere means that check could not measure it — say so, and never report it as zero or \"none\".",
          ].join("\n"),
        },
      },
    ],
  }),
);

server.registerPrompt(
  "ai_visibility_report",
  {
    description:
      "Analyze which brands ChatGPT, Claude, Gemini, Perplexity and Google AI Overviews recommend in your category, where you stand among them, and the pages the engines read.",
    argsSchema: { projectId: z.string().describe("Project ID (from list_projects)") },
  },
  async ({ projectId }) => ({
    messages: [
      {
        role: "user" as const,
        content: {
          type: "text" as const,
          text: [
            `Analyze AI Visibility for project ${projectId}.`,
            "",
            "Follow this workflow:",
            "1. Call get_ai_visibility_dashboard. Read summary.promptMarket first, then lead with the market map (summary.marketMap): which companies ChatGPT, Claude, Gemini, Perplexity and Google AI Overviews recommend in this category, how often each is named, and where the brand sits among them.",
            "2. Call get_ai_visibility_trend to see how that market has moved over the window. Report a rise or a fall only where presenceChangeSeparable is true.",
            "3. Call get_ai_sources_dashboard to see which pages Perplexity and Google AI Overviews retrieve when they answer this project's buying questions, and which of them name competitors and not the brand.",
            "",
            "Provide a report covering:",
            "- Where the brand stands on the market map, and which companies make up its core",
            "- Where the AI models differ (perEngine), without ordering brands whose ranges overlap",
            "- What moved over the window, and what did not separate from noise",
            "- The pages worth getting onto (core hosts with status missing), quoted as counts, never percentages",
            "- Specific recommendations to improve AI visibility",
          ].join("\n"),
        },
      },
    ],
  }),
);

// ── Start ───────────────────────────────────────────────────

const transport = new StdioServerTransport();
await server.connect(transport);
