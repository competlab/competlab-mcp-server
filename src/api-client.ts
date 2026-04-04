const API_BASE = "https://api.competlab.com";

export async function apiGet(
  path: string,
  query?: Record<string, string | number>,
): Promise<{ content: Array<{ type: "text"; text: string }>; isError?: true }> {
  const apiKey = process.env.COMPETLAB_API_KEY;
  if (!apiKey) {
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
}
