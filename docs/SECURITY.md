# Security

## Scope & Permissions

**All 24 MCP tools are read-only.** There are no tools that create, update, or delete data. The MCP server provides access to competitive intelligence data but cannot modify your CompetLab account, projects, or settings.

## Authentication

### API Key Format

CompetLab API keys follow a strict format:

```
cl_live_ + 32 hexadecimal characters = 40 characters total
```

Example: `cl_live_a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4`

### Two Authentication Methods

| Method | Usage | Example |
|--------|-------|---------|
| `CL-API-Key` header | Recommended for all clients | `CL-API-Key: cl_live_...` |
| `api_key` query parameter | Fallback when headers aren't configurable | `?api_key=cl_live_...` |

### Key Management

- API keys are generated in [app.competlab.com](https://app.competlab.com) under **Organization Settings > API Keys**
- Keys are organization-scoped — one key grants access to all projects in the organization
- Keys can be revoked at any time from the settings page
- We recommend rotating keys periodically

## Data Flow

```
Your MCP Client
    ↓ HTTPS (TLS 1.2+)
CompetLab MCP Server (mcp.competlab.com)
    ↓ HTTPS (TLS 1.2+)
CompetLab API (api.competlab.com)
```

- All communication uses HTTPS with TLS 1.2 or higher
- No third-party services are contacted during tool execution
- The MCP server acts as a proxy — it validates your API key and forwards requests to the CompetLab API
- Response data is passed through without modification

## Workspace Isolation

- Each API key is bound to a single organization
- The CompetLab API enforces workspace-level isolation — you cannot access other organizations' data
- Project IDs and competitor IDs are validated against your workspace before returning data

## What Gets Logged

- API key usage (for rate limiting and abuse detection)
- Tool calls with timestamps (for debugging and monitoring)
- Error events (for reliability)

Logs are retained according to our [Privacy Policy](https://competlab.com/privacy-policy).

## Reporting Security Issues

If you discover a security vulnerability, please report it to:

**[support@competlab.com](mailto:support@competlab.com)**

We take security reports seriously and will respond promptly.
