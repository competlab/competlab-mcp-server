import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod/v4";
import { tools } from "./tools.js";
import { routes } from "./routes.js";
import { apiGet, apiSend } from "./api-client.js";
import { moveTicket, resolveTicketId } from "./tickets.js";
import { SERVER_DESCRIPTION, SERVER_INSTRUCTIONS } from "./instructions.js";

const server = new McpServer(
  {
    name: "competlab",
    version: "4.0.1",
    description: SERVER_DESCRIPTION,
  },
  { instructions: SERVER_INSTRUCTIONS },
);

// ── Tools ───────────────────────────────────────────────────

for (const tool of tools) {
  const route = routes[tool.name];
  if (!route) throw new Error(`No route for ${tool.name} in src/routes.ts`);
  const pathKeys = [...route.path.matchAll(/\{(\w+)\}/g)].map((m) => m[1]);

  server.registerTool(
    tool.name,
    {
      description: tool.description,
      inputSchema: tool.parameters.shape,
      ...(tool.annotations ? { annotations: tool.annotations } : {}),
    },
    async (args: Record<string, any>) => {
      // Only the arguments the agent passed are sent: an omitted one is the API's own default.
      const rest: Record<string, any> = {};
      for (const [key, value] of Object.entries(args)) {
        if (value !== undefined && !pathKeys.includes(key)) rest[key] = value;
      }
      const values: Record<string, string> = { ...args };
      if (tool.name === "move_ticket") return moveTicket(args.projectId, args.ticketId, rest);
      if (pathKeys.includes("ticketId")) {
        const ticket = await resolveTicketId(args.projectId, args.ticketId);
        if ("error" in ticket) return ticket.error;
        values.ticketId = ticket.id;
      }
      const path = route.path.replace(/\{(\w+)\}/g, (_, key: string) => encodeURIComponent(values[key]));

      if (route.method === "DELETE") return apiSend("DELETE", path);
      if (route.method === "POST" || route.method === "PATCH") return apiSend(route.method, path, rest);
      return apiGet(path, Object.keys(rest).length ? rest : undefined);
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
            "3. Call get_ai_sources_dashboard to see which pages Perplexity and Google AI Overviews retrieve when they answer this project's buying questions, and which of them name other companies and not the brand.",
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
