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
│  24 read-only tools │
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

## Data Model

- **Projects** contain competitors and monitoring data across 5 dimensions
- **Competitors** are identified by domain and include monitored page URLs
- **Dimensions** (Tech & Trust, Content, Positioning, Pricing, AI Visibility) each have their own dashboard, history, and run/check detail endpoints
- **Alerts** are generated automatically when competitive changes are detected
- **Action Plans** are AI-generated insights aggregated across all dimensions
- **Schedules** control the monitoring frequency for each dimension

All IDs are 24-character hex strings (MongoDB ObjectIds).

Paginated endpoints return a `pagination` object with `page`, `limit`, `total`, and `hasMore` fields.
