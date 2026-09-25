# Architecture

High-level overview of the CompetLab MCP Server architecture.

## System Diagram

```
┌─────────────────────┐
│    MCP Client        │
│  (Claude, Cursor,    │
│   VS Code, etc.)     │
└──────────┬──────────┘
           │ Streamable HTTP
           │ POST /mcp
           │ Header: CL-API-Key
           ▼
┌─────────────────────┐
│  CompetLab MCP      │
│  Server             │
│  mcp.competlab.com  │
│                     │
│  48 tools           │
│  (40 read-only +    │
│   3 async-start +   │
│   5 ticket writes)  │
│  API key validation │
│  Error handling     │
└──────────┬──────────┘
           │ HTTPS
           │ Header: CL-API-Key
           ▼
┌─────────────────────┐
│  CompetLab API      │
│  api.competlab.com  │
│                     │
│  REST API           │
│  Workspace scoping  │
│  Rate limiting      │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  CompetLab Platform │
│                     │
│  MongoDB            │
│  Monitoring workers │
│  AI analysis engine │
└─────────────────────┘
```

## Request Flow

1. MCP client sends a `POST` request to `https://mcp.competlab.com/mcp`
2. The API key is validated (format: `cl_live_` + 32 hex chars, via `CL-API-Key` header or `api_key` query parameter)
3. The MCP server routes the request to the appropriate tool handler
4. The tool handler calls the CompetLab REST API, forwarding the API key
5. The API enforces workspace-level permissions — you can only access your own projects and competitors
6. Results are returned as structured MCP tool responses

## Authentication

Two methods are supported:

| Method | Header/Parameter | Example |
|--------|-----------------|---------|
| **Header** (recommended) | `CL-API-Key` | `CL-API-Key: cl_live_abc123...` |
| **Query parameter** (fallback) | `api_key` | `?api_key=cl_live_abc123...` |

If both are provided, the header takes precedence.

## Error Model

All errors follow a consistent structure:

```json
{
  "error": {
    "code": "error_code",
    "message": "Human-readable description",
    "status": 401
  }
}
```

Common error codes:

| Code | Status | Meaning |
|------|--------|---------|
| `api_key_missing` | 401 | No API key provided |
| `api_key_invalid` | 401 | Key doesn't match `cl_live_` format or is not recognized |
| `project_not_found` | 404 | Project ID doesn't exist in your workspace |
| `competitor_not_found` | 404 | Competitor ID doesn't exist in the specified project |
| `rate_limit_exceeded` | 429 | Too many requests — retry after the indicated period |
| `run_not_summarized` | 404 | The run exists but produced no summary — it has nothing to report, which is different from not existing |
| `api_unreachable` | 503 | The MCP server could not reach the CompetLab API |

## Data Model

- **Projects** contain competitors and monitoring data across 6 monitored dimensions
- **Competitors** are identified by domain and include monitored page URLs
- **Dimensions** (AI Visibility, AI Sources, Positioning, Pricing, Content, Tech & Trust) each have their own dashboard, history, and run/check detail endpoints
- **Alerts** are generated automatically when competitive changes are detected
- **Strategic Briefings** are AI-generated, synthesized competitive reads across 14 dimensions — the 6 monitored ones plus 8 researched for the briefing alone: what changed and what it means. Its recommendations open as tickets on the project's Strategic Tickets board, and the briefing reports how they stand. Past editions stay readable
- **Strategic Tickets** are the project's board — the work the team has decided to do, in five fixed columns (`triage`, `todo`, `in_progress`, `done`, `dismissed`), each ticket with an owner, labels, a due date, effort, impact and a comment thread. The ticket tools read and write the same board the team sees in the app; writing needs a `read_write` API key
- **Schedules** control the monitoring frequency for each dimension

All IDs are 24-character hex strings (MongoDB ObjectIds). A tool that takes a ticket ID also takes the ticket's number as a person writes it, `#14`.

Paginated endpoints return a `pagination` object with `page`, `limit`, `total`, and `hasMore` fields. The AI Visibility and AI Sources dashboards and check details, the AI Visibility history, and the Tech & Trust dashboard answer in a compact view by default, each paged list with its own `*Page` object (`offset`, `limit`, `total`, `hasMore`); `view=full` returns every row.

## This Repository — the Local (stdio) Server

The local server offers the hosted server's tools over stdio and calls the same REST API with the key in `COMPETLAB_API_KEY`.

| File | What it holds |
|------|---------------|
| `src/tools.ts`, `src/instructions.ts` | Generated from the hosted server by `scripts/sync-tools.mjs`: every tool name, description, parameter and annotation, and the server's instructions, word for word, with the same JSON schemas |
| `src/routes.ts` | Where each tool goes on the REST API. Path segments come from the tool's arguments; every other argument is the query string on a GET and the JSON body otherwise. Only the arguments the agent passed are sent, so an omitted one gets the API's own default |
| `src/tickets.ts` | Turns a ticket's number into its ID through the ticket list's `number` filter, as the hosted server does — the REST API takes the ID alone |
| `src/api-client.ts` | The HTTP calls to `https://api.competlab.com` |

To bring it in step with the hosted server:

```bash
COMPETLAB_API_KEY=YOUR_COMPETLAB_API_KEY npm run sync   # rewrites src/tools.ts and src/instructions.ts
npm test                                                # builds, and checks what each tool sends
```

A tool the hosted server adds needs its line in `src/routes.ts` first; `npm run sync` names any tool without one.
