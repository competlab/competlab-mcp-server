# CompetLab MCP Server — Launch Guide

Structured metadata for MCP directories and marketplace submissions.

---

## Listing Metadata

| Field | Value |
|-------|-------|
| **Display Name** | CompetLab MCP Server |
| **Server URL** | `https://mcp.competlab.com/mcp` |
| **Transport** | Streamable HTTP |
| **Auth** | API key via `CL-API-Key` header or `api_key` query parameter |
| **Tools Count** | 24 |
| **Language** | TypeScript |
| **License** | Commercial (docs repo is MIT) |
| **Category** | Competitive Intelligence, Marketing, AI & ML, Business Intelligence |
| **GitHub** | https://github.com/competlab/competlab-mcp-server |
| **npm SDK** | https://www.npmjs.com/package/@competlab/sdk |
| **API Docs** | https://competlab.com/developers/api |
| **MCP Landing** | https://competlab.com/developers/mcp |
| **Privacy Policy** | https://competlab.com/privacy-policy |
| **Support Email** | support@competlab.com |

---

## Descriptions

### Tagline (80 chars)

> Competitive intelligence for the AI era — see how LLMs rank your brand

### Short Description (190 chars)

> CompetLab monitors competitors across 5 dimensions including AI Visibility — tracking how ChatGPT, Claude, and Gemini mention and rank brands. 24 MCP tools for dashboards, alerts, and action plans.

### Medium Description (500 chars)

> CompetLab MCP Server gives AI agents access to competitive intelligence data across 5 dimensions: Tech & Trust, Content, Positioning, Pricing, and AI Visibility. The unique AI Visibility dimension tracks how ChatGPT, Claude, and Gemini mention and rank brands in response to industry queries — no other CI platform does this. 24 tools covering project management, competitor analysis, dimension dashboards, historical data, alerts, action plans, and scheduling. Built for B2B SaaS teams who need CI integrated into their AI workflows.

### Long Description (for G2, Capterra, full directory profiles)

CompetLab is a competitive intelligence platform for B2B SaaS companies. It monitors 5 dimensions across your competitors: Tech & Trust Profile, Content Intelligence, Positioning, Pricing Intelligence, and AI Visibility.

The MCP server exposes 24 tools that let AI agents access the full CompetLab platform: manage projects and competitors, pull dashboard data across all 5 dimensions, review historical trends, check alerts, get AI-generated action plans, and manage monitoring schedules.

What makes CompetLab unique is the AI Visibility dimension — it tracks how large language models (OpenAI, Claude, Gemini) mention and rank brands in response to industry queries. As buyers increasingly use AI assistants for vendor research, knowing how you appear in AI responses is becoming critical. No other CI platform monitors this.

**Key capabilities via MCP:**
- List and manage competitive intelligence projects
- Add, view, and compare competitors
- Pull real-time dashboards for pricing, content, positioning, tech trust, and AI visibility
- Access historical monitoring data and trends
- Review alerts with severity scoring and actionable recommendations
- Get AI-generated action plans based on competitive gaps
- Manage monitoring schedules

Built for product marketers, competitive intelligence analysts, and growth teams at B2B SaaS companies who want CI data flowing into their AI-powered workflows.

---

## Target Audience & Use Cases

**Primary audience:** Product marketers, competitive intelligence analysts, founders, and growth teams at B2B SaaS companies.

**Use case recipes:**

1. **"What changed on competitor pricing pages this week?"** — Pull pricing alerts and dashboard to catch pricing changes instantly, not weeks later from a churned customer.

2. **"How does ChatGPT rank my brand vs competitors for [industry query]?"** — Use AI Visibility tools to see exactly how LLMs perceive and recommend your brand.

3. **"Show me the action plan — what should I fix first?"** — Get AI-generated prioritized recommendations across all 5 dimensions.

4. **"Compare content strategies across all tracked competitors"** — Pull content dashboards and changelogs to see who's publishing what.

5. **"Build me a weekly competitive briefing for the team"** — Combine alerts, dashboards, and action plans into a structured report.

---

## Setup Requirements

- **Account:** Active CompetLab account ([free 14-day trial](https://app.competlab.com/register), no credit card required)
- **API Key:** Generated in Organization Settings > API Keys (starts with `cl_live_`)
- **Install:** None — remote HTTP endpoint, no local install or Docker needed
- **Transport:** Streamable HTTP
- **Firewall:** No special configuration needed — standard HTTPS on port 443

---

## Security & Scopes

- **All 24 tools are read-only** — no write, delete, or mutation operations
- **Data access:** Scoped to the authenticated organization's projects and competitors only
- **External systems:** The MCP server communicates only with the CompetLab API (`api.competlab.com`). No third-party services are contacted during tool execution.
- **API key format:** `cl_live_` prefix + 32 hex characters (40 chars total)
- **Rate limits:** Standard API rate limits apply (documented at competlab.com/developers/api)

---

## Supported Clients

- Claude Desktop / Claude Web (custom connector)
- Claude Code (CLI: `claude mcp add`)
- Cursor (`.cursor/mcp.json`)
- VS Code Copilot (`.vscode/mcp.json`)
- Windsurf (`~/.codeium/windsurf/mcp_config.json`)
- Cline (`cline_mcp_settings.json`)
- Any MCP-compatible client supporting Streamable HTTP transport

---

## Pricing

MCP access is **included with every CompetLab subscription** ($99/mo). Free 14-day trial includes full MCP access with all 24 tools.

No additional fees for MCP usage. No per-call pricing.
