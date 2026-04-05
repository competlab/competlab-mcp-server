<p align="center">
  <img src="./assets/banner.png" alt="CompetLab MCP Server — Competitive Intelligence for AI Agents" width="100%" />
</p>

# CompetLab MCP Server

[![MCP](https://img.shields.io/badge/MCP-HTTP_%7C_stdio-7C3AED)](https://modelcontextprotocol.io)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![24 Tools](https://img.shields.io/badge/Tools-24-brightgreen)](#available-tools)

[![Glama](https://glama.ai/mcp/servers/competlab/competlab-mcp-server/badges/score.svg)](https://glama.ai/mcp/servers/competlab/competlab-mcp-server)

> Competitive intelligence for AI agents — see how LLMs rank your brand.

More B2B buyers are asking AI before they Google. CompetLab monitors competitors across 5 dimensions — including **AI Visibility**, which tracks how ChatGPT, Claude, and Gemini mention and rank brands. This MCP server gives your AI agent access to all of it: dashboards, historical data, alerts, and action plans. No other CI platform does this.

## Supported Clients

Works with any MCP-compatible client:

- [Claude Desktop](https://claude.ai/download) / [Claude Web](https://claude.ai)
- [Claude Code](https://docs.anthropic.com/en/docs/claude-code)
- [Cursor](https://cursor.com)
- [VS Code (Copilot)](https://code.visualstudio.com)
- [Windsurf](https://windsurf.com)
- [Cline](https://cline.bot)

## Quick Start

Two ways to connect — pick the one that fits your setup:

|               | Remote Server                                              | Local Server                          |
| ------------- | ---------------------------------------------------------- | ------------------------------------- |
| **Transport** | Streamable HTTP                                            | stdio                                 |
| **Setup**     | Zero install — just add URL                                | `npm install && npm run build`        |
| **Best for**  | Most users — Claude Code, Cursor, VS Code, Windsurf, Cline | Claude Desktop, Glama, or offline use |

Get your API key: [app.competlab.com](https://app.competlab.com/register) > Organization Settings > API Keys

### Option 1: Remote Server (recommended)

**Server URL:** `https://mcp.competlab.com/mcp`
**Auth:** API key via `CL-API-Key` header (or `api_key` query parameter)

#### Claude Code

```bash
claude mcp add --transport http \
  --header "CL-API-Key: YOUR_COMPETLAB_API_KEY" \
  competlab https://mcp.competlab.com/mcp
```

#### Cursor

Add to `.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "competlab": {
      "url": "https://mcp.competlab.com/mcp",
      "headers": {
        "CL-API-Key": "YOUR_COMPETLAB_API_KEY"
      }
    }
  }
}
```

#### VS Code

Add to `.vscode/mcp.json`:

```json
{
  "inputs": [
    {
      "type": "promptString",
      "id": "competlab-api-key",
      "description": "CompetLab API Key (starts with cl_live_)",
      "password": true
    }
  ],
  "servers": {
    "competlab": {
      "type": "http",
      "url": "https://mcp.competlab.com/mcp",
      "headers": {
        "CL-API-Key": "${input:competlab-api-key}"
      }
    }
  }
}
```

> Note: VS Code uses `"servers"` (not `"mcpServers"`) and supports secure input prompts via `${input:id}`.

#### Windsurf

Add to `~/.codeium/windsurf/mcp_config.json`:

```json
{
  "mcpServers": {
    "competlab": {
      "serverUrl": "https://mcp.competlab.com/mcp",
      "headers": {
        "CL-API-Key": "YOUR_COMPETLAB_API_KEY"
      }
    }
  }
}
```

> Note: Windsurf uses `"serverUrl"` (not `"url"`).

#### Cline

Add to `cline_mcp_settings.json` (or configure via Cline UI > Installed > Advanced MCP Settings):

```json
{
  "mcpServers": {
    "competlab": {
      "url": "https://mcp.competlab.com/mcp",
      "headers": {
        "CL-API-Key": "YOUR_COMPETLAB_API_KEY"
      },
      "disabled": false
    }
  }
}
```

#### Claude Desktop / Claude Web

Claude Desktop and Claude Web only support URL-based auth (no custom headers). Use the `api_key` query parameter:

Go to **Settings > MCP** and add the server with this URL:

```
https://mcp.competlab.com/mcp?api_key=YOUR_COMPETLAB_API_KEY
```

### Option 2: Local Server (stdio)

Run the server locally via stdin/stdout. Useful for Claude Desktop, Glama, or environments that prefer stdio transport.

```bash
git clone https://github.com/competlab/competlab-mcp-server.git
cd competlab-mcp-server
npm install
npm run build
```

#### Claude Code

```bash
claude mcp add --transport stdio \
  --env COMPETLAB_API_KEY=YOUR_COMPETLAB_API_KEY \
  competlab node dist/index.js
```

#### Claude Desktop

Add to your Claude Desktop config (`claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "competlab": {
      "command": "node",
      "args": ["dist/index.js"],
      "cwd": "/path/to/competlab-mcp-server",
      "env": {
        "COMPETLAB_API_KEY": "YOUR_COMPETLAB_API_KEY"
      }
    }
  }
}
```

#### Generic stdio

```bash
COMPETLAB_API_KEY=YOUR_COMPETLAB_API_KEY node dist/index.js
```

The server reads JSON-RPC from stdin and writes responses to stdout.

See [examples/](./examples/) for ready-to-paste config files for each client.

## What is CompetLab?

Competitive intelligence for the AI era. One platform, 5 dimensions, monitored automatically:

| Dimension         | What It Tracks                                                                                                    |
| ----------------- | ----------------------------------------------------------------------------------------------------------------- |
| **Tech & Trust**  | Tech stacks, security headers (grade A-F), trust signals (24 signals in 4 categories), robots.txt AI bot blocking |
| **Content**       | Sitemap analysis, content categorization (11 categories), URL changelog, content gaps                             |
| **Positioning**   | Homepage messaging, value props, CTAs, target audience, differentiators                                           |
| **Pricing**       | Plans, billing models, free tiers, enterprise pricing, gap analysis                                               |
| **AI Visibility** | How ChatGPT, Claude, and Gemini rank your brand vs competitors (AI Visibility Score 0-100)                        |

AI Visibility is what makes CompetLab unique — no other CI platform tracks how LLMs recommend brands in real time.

> [Start free trial](https://app.competlab.com/register) (14 days, no credit card) | [Learn more](https://competlab.com)

## Available Tools

**10 groups. 24 tools. All read-only.**

### Projects & Competitors

| Tool               | Description                                                                   |
| ------------------ | ----------------------------------------------------------------------------- |
| `list_projects`    | List all projects with status, competitor count, and last monitored timestamp |
| `get_project`      | Get project details with per-dimension monitoring freshness                   |
| `list_competitors` | List all monitored competitors (includes your own domain for comparison)      |
| `get_competitor`   | Get competitor details including monitored page URLs                          |

### Tech & Trust Profile

| Tool                        | Description                                                                   |
| --------------------------- | ----------------------------------------------------------------------------- |
| `get_tech_trust_dashboard`  | Latest security headers, trust signals, tech stacks, DNS, robots.txt analysis |
| `get_tech_trust_history`    | Paginated history of monitoring runs                                          |
| `get_tech_trust_run_detail` | Full competitor-by-competitor data for a specific run                         |

### Content Intelligence

| Tool                     | Description                                                                                  |
| ------------------------ | -------------------------------------------------------------------------------------------- |
| `get_content_dashboard`  | Latest sitemap analysis, content categorization, strategic URLs, gap analysis                |
| `get_content_history`    | Paginated history of monitoring runs                                                         |
| `get_content_run_detail` | Full data for a specific content run                                                         |
| `get_content_changelog`  | Detected URL changes over time (new, removed, moved) — filterable by competitor and category |

### Positioning

| Tool                         | Description                                                            |
| ---------------------------- | ---------------------------------------------------------------------- |
| `get_positioning_dashboard`  | Latest homepage messaging, value props, CTAs, target audience analysis |
| `get_positioning_history`    | Paginated history of monitoring runs                                   |
| `get_positioning_run_detail` | Full data for a specific positioning run                               |

### Pricing Intelligence

| Tool                     | Description                                                            |
| ------------------------ | ---------------------------------------------------------------------- |
| `get_pricing_dashboard`  | Latest pricing plans, billing options, market statistics, gap analysis |
| `get_pricing_history`    | Paginated history of monitoring runs                                   |
| `get_pricing_run_detail` | Full data for a specific pricing run                                   |

### AI Visibility

| Tool                             | Description                                                                                      |
| -------------------------------- | ------------------------------------------------------------------------------------------------ |
| `get_ai_visibility_dashboard`    | AI Visibility Scores, mention rates, per-provider breakdowns (OpenAI, Claude, Gemini)            |
| `get_ai_visibility_history`      | Paginated history of AI visibility checks                                                        |
| `get_ai_visibility_check_detail` | Full detail for a specific check with per-competitor rankings                                    |
| `get_ai_visibility_trend`        | Track how LLM brand perception changes over time (up to 200 data points, filterable by provider) |

### Analysis, Alerts & Schedules

| Tool              | Description                                                                                   |
| ----------------- | --------------------------------------------------------------------------------------------- |
| `get_action_plan` | AI-generated competitive action plan across all 5 dimensions with prioritized recommendations |
| `list_alerts`     | Competitive change alerts — filterable by dimension, severity, and competitor                 |
| `list_schedules`  | Monitoring schedules for all dimensions with enabled/disabled status and intervals            |

All paginated tools accept `page` and `limit` parameters. Check `pagination.hasMore` in the response to fetch more pages.

## Example Prompts

Once connected, try asking your AI agent:

- **"What changed on my competitors' pricing pages this week?"**
- **"How does ChatGPT rank my brand vs competitors for [industry query]?"**
- **"Show me the action plan — what should I fix first?"**
- **"Compare content strategies across all my tracked competitors"**
- **"What critical alerts fired in the last 7 days?"**
- **"Track how my AI visibility score changed over the last 3 months"**
- **"Which competitors have better security headers than us?"**

See [examples/prompts.md](./examples/prompts.md) for more prompts organized by use case.

## Authentication

### Getting an API key

1. Sign up at [app.competlab.com/register](https://app.competlab.com/register) (free 14-day trial, no credit card)
2. Go to **Organization Settings > API Keys**
3. Create a new key — it starts with `cl_live_`

### Two authentication methods

| Method                        | When to use                                                       | Example                   |
| ----------------------------- | ----------------------------------------------------------------- | ------------------------- |
| **`CL-API-Key` header**       | Claude Code, Cursor, VS Code, Windsurf, Cline                     | `CL-API-Key: cl_live_...` |
| **`api_key` query parameter** | Claude Desktop, Claude Web, clients without custom header support | `?api_key=cl_live_...`    |

One API key covers your entire organization. All tools are read-only.

### Pricing

MCP access is included with every CompetLab subscription ($99/mo). Free trial includes full MCP access.

## Troubleshooting

| Issue                        | Fix                                                                                                  |
| ---------------------------- | ---------------------------------------------------------------------------------------------------- |
| Connection refused / timeout | Verify the URL is exactly `https://mcp.competlab.com/mcp` with no trailing slash                     |
| `api_key_missing` error      | Ensure you're passing the key as `CL-API-Key` header (remote) or `COMPETLAB_API_KEY` env var (stdio) |
| `api_key_invalid` error      | Keys must start with `cl_live_` and be exactly 40 characters                                         |
| Transport not supported      | Use the remote HTTP server, or switch to the local stdio server                                      |

## Links

- [MCP Server Documentation](https://competlab.com/developers/mcp)
- [REST API Reference](https://competlab.com/developers/api)
- [TypeScript SDK](https://www.npmjs.com/package/@competlab/sdk) (`npm install @competlab/sdk`)
- [Privacy Policy](https://competlab.com/privacy-policy)
- [Start Free Trial](https://app.competlab.com/register)

## Support

- Bug reports: [GitHub Issues](https://github.com/competlab/competlab-mcp-server/issues)
- Email: [support@competlab.com](mailto:support@competlab.com)
- Documentation: [competlab.com/developers](https://competlab.com/developers/mcp)

## License

MIT (covers documentation and configs in this repo) — see [LICENSE](./LICENSE)

The CompetLab MCP server and platform are commercial software. See [competlab.com/terms-and-conditions](https://competlab.com/terms-and-conditions).

---

Built by the [CompetLab](https://competlab.com) team. Competitive intelligence for the AI era.

[![Share on X](https://img.shields.io/badge/Share_on_X-000000?logo=x&logoColor=white)](https://x.com/intent/tweet?text=MCP%20server%20for%20competitive%20intelligence%20%E2%80%94%20track%20what%20ChatGPT%20says%20about%20your%20brand&url=https://github.com/competlab/competlab-mcp-server)
[![Share on LinkedIn](https://img.shields.io/badge/Share_on_LinkedIn-0A66C2?logo=linkedin&logoColor=white)](https://www.linkedin.com/sharing/share-offsite/?url=https://github.com/competlab/competlab-mcp-server)
