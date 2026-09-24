const API_BASE = "https://api.competlab.com";
// The hosted server's HTTP client timeout. fetch_url accepts caller budgets up to 120s.
const TIMEOUT_MS = 120_000;

type McpResponse = {
  content: Array<{ type: "text"; text: string }>;
  isError?: true;
};

// The same { error: { code, message, status } } body the hosted server and the API return.
function errorResponse(code: string, message: string, status: number): McpResponse {
  return {
    content: [{ type: "text", text: JSON.stringify({ error: { code, message, status } }) }],
    isError: true,
  };
}

function missingKey(): McpResponse {
  return errorResponse("api_key_missing", "COMPETLAB_API_KEY environment variable is not set", 401);
}

function unreachable(path: string, err: unknown): McpResponse {
  // stdout carries the protocol, so the detail goes to stderr.
  console.error(
    `CompetLab API unreachable (${path}): ${err instanceof Error ? err.message : String(err)}`,
  );
  return errorResponse("api_unreachable", "CompetLab API is not reachable", 503);
}

async function toResponse(res: Response): Promise<McpResponse> {
  const text = await res.text();
  if (!res.ok) {
    return { content: [{ type: "text", text }], isError: true };
  }
  return { content: [{ type: "text", text }] };
}

export async function apiGet(
  path: string,
  query?: Record<string, string | number | boolean | Array<string | number>>,
): Promise<McpResponse> {
  const apiKey = process.env.COMPETLAB_API_KEY;
  if (!apiKey) return missingKey();

  const url = new URL(`${API_BASE}${path}`);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v === undefined) continue;
      // Array params (e.g. `sections`) are sent comma-joined. The backend also accepts repeated
      // (?k=a&k=b) and single values — see GetBriefingQueryDto — so this is just the simplest form.
      const value = Array.isArray(v) ? v.join(",") : String(v);
      if (value === "") continue; // skip empty arrays / empty strings
      url.searchParams.set(k, value);
    }
  }

  try {
    const res = await fetch(url, {
      headers: { "CL-API-Key": apiKey },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    return await toResponse(res);
  } catch (err) {
    return unreachable(path, err);
  }
}

// POST, PATCH and DELETE. PATCH bodies carry null on purpose: on update_ticket a null clears a field.
export async function apiSend(
  method: "POST" | "PATCH" | "DELETE",
  path: string,
  body?: Record<string, unknown>,
): Promise<McpResponse> {
  const apiKey = process.env.COMPETLAB_API_KEY;
  if (!apiKey) return missingKey();

  const headers: Record<string, string> = { "CL-API-Key": apiKey };
  if (body !== undefined) headers["Content-Type"] = "application/json";

  try {
    const res = await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    return await toResponse(res);
  } catch (err) {
    return unreachable(path, err);
  }
}
