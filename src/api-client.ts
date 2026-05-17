const API_BASE = "https://api.competlab.com";

type McpResponse = {
  content: Array<{ type: "text"; text: string }>;
  isError?: true;
};

function missingKey(): McpResponse {
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify({
          error: "api_key_missing",
          message: "COMPETLAB_API_KEY environment variable is not set",
        }),
      },
    ],
    isError: true,
  };
}

function unreachable(err: unknown): McpResponse {
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify({
          error: "api_unreachable",
          message:
            err instanceof Error ? err.message : "Failed to reach CompetLab API",
          status: 503,
        }),
      },
    ],
    isError: true,
  };
}

export async function apiGet(
  path: string,
  query?: Record<string, string | number>,
): Promise<McpResponse> {
  const apiKey = process.env.COMPETLAB_API_KEY;
  if (!apiKey) return missingKey();

  const url = new URL(`${API_BASE}${path}`);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined) url.searchParams.set(k, String(v));
    }
  }

  try {
    const res = await fetch(url, {
      headers: { "CL-API-Key": apiKey },
    });

    const body = await res.text();

    if (!res.ok) {
      return { content: [{ type: "text", text: body }], isError: true };
    }

    return { content: [{ type: "text", text: body }] };
  } catch (err) {
    return unreachable(err);
  }
}

export async function apiPost(
  path: string,
  body: Record<string, unknown>,
): Promise<McpResponse> {
  const apiKey = process.env.COMPETLAB_API_KEY;
  if (!apiKey) return missingKey();

  try {
    const res = await fetch(`${API_BASE}${path}`, {
      method: "POST",
      headers: {
        "CL-API-Key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const text = await res.text();

    if (!res.ok) {
      return { content: [{ type: "text", text }], isError: true };
    }

    return { content: [{ type: "text", text }] };
  } catch (err) {
    return unreachable(err);
  }
}
