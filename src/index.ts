import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { tools } from "./tools.js";
import { apiGet } from "./api-client.js";

const server = new McpServer({
  name: "competlab",
  version: "1.0.0",
  description:
    "Competitive intelligence for B2B SaaS — monitor competitors across 5 dimensions including AI Visibility.",
});

for (const tool of tools) {
  server.tool(tool.name, tool.description, tool.parameters.shape, async (args: Record<string, any>) => {
    const path = tool.path(args);
    const query: Record<string, any> = {};
    for (const key of tool.queryParams ?? []) {
      if (args[key] !== undefined) query[key] = args[key];
    }
    return apiGet(path, Object.keys(query).length ? query : undefined);
  });
}

const transport = new StdioServerTransport();
await server.connect(transport);
