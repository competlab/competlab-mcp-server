# Claude Code Setup

Run this command in your terminal:

```bash
claude mcp add --transport http \
  --header "CL-API-Key: YOUR_COMPETLAB_API_KEY" \
  competlab https://mcp.competlab.com/mcp
```

All flags (`--transport`, `--header`) must come **before** the server name.

Replace `YOUR_COMPETLAB_API_KEY` with your actual API key (starts with `cl_live_`).

## Verify

```bash
claude mcp list
```

You should see `competlab` listed with 24 tools.

## Get your API key

1. Sign up at [app.competlab.com/register](https://app.competlab.com/register) (free trial, no credit card)
2. Go to **Organization Settings > API Keys**
3. Create a new key
