import { apiGet, apiSend, type McpResponse } from "./api-client.js";

// A person names a ticket by its number ("#14"); the API takes its id alone. These turn one into
// the other the way the hosted server does: through the list's own `number` filter.

const TICKET_ID = /^[a-f\d]{24}$/i;
const TICKET_NUMBER = /^#?(\d+)$/;

type Resolved = { id: string } | { error: McpResponse; notFound?: true };

// A body that is not JSON, or is JSON null, reads as nothing.
function parseJson<T>(response: McpResponse): T | null {
  try {
    return (JSON.parse(response.content[0].text) as T | null) ?? null;
  } catch {
    return null;
  }
}

function notFound(number: number): McpResponse {
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify({
          error: { code: "not_found", message: `No ticket #${number} on this project`, status: 404 },
        }),
      },
    ],
    isError: true,
  };
}

// An id passes through untouched. A number no ticket on the project carries answers the not-found
// error the API gives an unknown id; a refused list call (a key, a project) is handed back as it came.
export async function resolveTicketId(projectId: string, ticketId: string): Promise<Resolved> {
  const match = TICKET_NUMBER.exec(ticketId);
  if (!match || TICKET_ID.test(ticketId)) return { id: ticketId };

  const number = Number(match[1]);
  const list = await apiGet(`/v1/projects/${projectId}/tickets`, { number, limit: 1 });
  if (list.isError) return { error: list };

  const id = parseJson<{ items?: Array<{ id: string }> }>(list)?.items?.[0]?.id;
  if (id) return { id };
  return { error: notFound(number), notFound: true };
}

// The moved ticket has to resolve — nothing is moved against a guess. A neighbour named by a number
// no ticket carries any more is a stale neighbour like any other: it is left out of the request and
// reported in the answer's placement.ignored as not_found, so a move never fails because the view
// was a moment old.
export async function moveTicket(
  projectId: string,
  ticketId: string,
  body: Record<string, unknown>,
): Promise<McpResponse> {
  const moved = await resolveTicketId(projectId, ticketId);
  if ("error" in moved) return moved.error;

  const request: Record<string, unknown> = { ...body };
  const unresolved: Array<{ id: string; as: string; reason: "not_found"; status: null }> = [];
  for (const key of ["beforeId", "afterId"] as const) {
    const ref = body[key];
    if (typeof ref !== "string") continue;
    const found = await resolveTicketId(projectId, ref);
    if ("error" in found) {
      if (!found.notFound) return found.error;
      delete request[key];
      unresolved.push({ id: ref, as: key, reason: "not_found", status: null });
      continue;
    }
    request[key] = found.id;
  }

  const answer = await apiSend("PATCH", `/v1/projects/${projectId}/tickets/${moved.id}/move`, request);
  if (answer.isError || unresolved.length === 0) return answer;

  // The move has happened by now: an answer we cannot read is handed back as it came.
  const parsed = parseJson<{ placement?: { ignored?: unknown[] } }>(answer);
  if (!parsed || !Array.isArray(parsed.placement?.ignored)) return answer;
  parsed.placement.ignored.push(...unresolved);
  return { content: [{ type: "text", text: JSON.stringify(parsed) }] };
}
