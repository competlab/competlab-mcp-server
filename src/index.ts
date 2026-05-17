import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { tools } from "./tools.js";
import { apiGet, apiPost } from "./api-client.js";

const server = new McpServer({
  name: "competlab",
  version: "1.1.1",
  description:
    "Competitive intelligence for B2B SaaS — monitor competitors across 5 dimensions including AI Visibility.",
});

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

server.prompt(
  "competitive_overview",
  "Get a full competitive briefing for a project — action plan, alerts, and all 5 dimension dashboards in one go.",
  { projectId: z.string().describe("Project ID (from list_projects)") },
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
            "1. Call get_action_plan to get the strategic overview with insights and recommended actions.",
            "2. Call list_alerts (limit 10, severity critical or high) to surface the most important recent changes.",
            "3. Call each dashboard tool for the full picture:",
            "   - get_tech_trust_dashboard (security, trust signals, tech stack)",
            "   - get_content_dashboard (sitemap, content gaps)",
            "   - get_positioning_dashboard (homepage messaging, CTAs)",
            "   - get_pricing_dashboard (plans, market stats)",
            "   - get_ai_visibility_dashboard (LLM brand rankings)",
            "",
            "Synthesize everything into a concise executive briefing with:",
            "- Top 3 competitive threats",
            "- Top 3 opportunities",
            "- Recommended immediate actions",
          ].join("\n"),
        },
      },
    ],
  }),
);

server.prompt(
  "ai_visibility_report",
  "Analyze how AI models (ChatGPT, Claude, Gemini) perceive and rank your brand vs competitors.",
  { projectId: z.string().describe("Project ID (from list_projects)") },
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
            "1. Call get_ai_visibility_dashboard to get current scores, mention rates, and per-provider breakdowns (OpenAI, Claude, Gemini).",
            "2. Call get_ai_visibility_trend to see how brand perception has changed over time.",
            "3. Call list_competitors to identify who you're being compared against.",
            "",
            "Provide a report covering:",
            "- Current AI Visibility Score and what it means",
            "- How each LLM provider ranks the brand vs competitors",
            "- Trend direction — is visibility improving or declining?",
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
