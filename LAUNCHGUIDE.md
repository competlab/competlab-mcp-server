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
| **Tools Count** | 48 |
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

> See where AI sends your buyers — and what to do about it

### Short Description (250 chars)

> CompetLab tracks where you stand as buyers ask ChatGPT, Claude, Gemini, Perplexity and Google AI Overviews who to use — then hands you a monthly Strategic Briefing on what to do. MCP tools for dashboards, alerts, and the briefing.

### Medium Description (500 chars)

> CompetLab MCP Server gives AI agents competitive intelligence across 6 monitored dimensions — AI Visibility, AI Sources, Positioning, Pricing, Content, Tech & Trust — plus a monthly Strategic Briefing that covers 14. AI Visibility shows which brands ChatGPT, Claude, Gemini, Perplexity and Google AI Overviews recommend; AI Sources, the pages Perplexity and Google AI Overviews read, and whether you are on them. 48 tools: dashboards, alerts, briefings, tickets, schedules, and 9 free tools.

### Long Description (for G2, Capterra, full directory profiles)

CompetLab is a competitive intelligence platform for B2B SaaS companies. It covers 14 dimensions — 6 monitored continuously across your competitors (AI Visibility, AI Sources, Positioning, Pricing Intelligence, Content Intelligence, and Tech & Trust Profile), plus 8 leading-edge dimensions researched for the monthly Strategic Briefing.

The MCP server exposes 48 tools that let AI agents work with the full CompetLab platform: list projects and competitors, pull dashboard data for all 6 monitored dimensions, review historical trends, check alerts, read the Strategic Briefing and its past editions, read and work the project's Strategic Tickets board, see monitoring schedules, and run 9 free no-setup tools against any public domain (sitemap analysis, AI-crawler access checks, tech-stack detection, trust-signals analysis, Agent Adoption Checks, URL fetch with JS rendering).

The AI Visibility dimension answers who AI recommends — it tracks which brands ChatGPT, Claude, Gemini, Perplexity and Google AI Overviews name and recommend in response to industry queries, ordered by how often each is named, never by position. AI Sources is its companion: for Perplexity and Google AI Overviews, it reads the pages the engine retrieved while answering a project's buying questions, and reports which of those pages name other companies and not you. As buyers increasingly ask AI assistants who to use, knowing where you stand in those answers is becoming critical.

**Key capabilities via MCP:**
- List competitive intelligence projects and the competitors each one monitors
- Pull the latest dashboards for AI visibility, AI sources, positioning, pricing, content, and tech & trust
- Access historical monitoring data and trends
- Review alerts with severity scoring and actionable recommendations
- Read the AI-generated Strategic Briefing — a synthesized read across 14 dimensions, with its recommendations opened as tickets on your Strategic Tickets board — and its past editions
- Read and work the Strategic Tickets board — list, open, move and comment on the same tickets the team sees in the app (writing needs a `read_write` API key)
- See monitoring schedules
- Run free scans against any public domain

Built for product marketers, competitive intelligence analysts, and growth teams at B2B SaaS companies who want CI data flowing into their AI-powered workflows.

---

## Target Audience & Use Cases

**Primary audience:** Product marketers, competitive intelligence analysts, founders, and growth teams at B2B SaaS companies.

**Use case recipes:**

1. **"What changed on competitor pricing pages this week?"** — Pull pricing alerts and dashboard to see each change at the next scheduled check, not weeks later from a churned customer.

2. **"Which companies do the AI models recommend in my category — and am I one of them?"** — Use the AI Visibility market map to see who ChatGPT, Claude, Gemini, Perplexity and Google AI Overviews recommend, and how often.

3. **"Which pages do the AI engines read that name my competitors and not me?"** — Use AI Sources to get the work list: the pages worth getting onto, per engine, with the evidence.

4. **"Show me the strategic briefing — what should I fix first?"** — Get the Strategic Briefing's read across 14 dimensions, and how the tickets it opened now stand.

5. **"Compare content strategies across all tracked competitors"** — Pull content dashboards and changelogs to see who's publishing what.

6. **"Build me a weekly competitive briefing for the team"** — Combine alerts, dashboards, and the strategic briefing into a structured report.

---

## Setup Requirements

- **Account:** Active CompetLab account ([free 14-day trial](https://app.competlab.com/register), no credit card required)
- **API Key:** Generated in Organization Settings > API Keys (starts with `cl_live_`)
- **Install:** None — remote HTTP endpoint, no local install or Docker needed
- **Transport:** Streamable HTTP
- **Firewall:** No special configuration needed — standard HTTPS on port 443

---

## Security & Scopes

- **40 of 48 tools are read-only** — the 3 `start_*_scan` tools create scan records under your account but never edit or delete existing data; the 5 Strategic Tickets write tools (`create_ticket`, `update_ticket`, `move_ticket`, `delete_ticket`, `add_ticket_comment`) change the project's board and need a `read_write` API key — a `read` key is refused on them
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

MCP access is **included with every CompetLab subscription** ($99/mo). Free 14-day trial includes full MCP access with all 48 tools.

No additional fees for MCP usage. No per-call pricing.
