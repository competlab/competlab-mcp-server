// Preloaded into the server under test (node --import): replaces fetch with a fake CompetLab API
// that answers from the table below and reports every request on stderr as `REQUEST {json}`.

const TICKETS = { 14: "aaaaaaaaaaaaaaaaaaaaaaaa", 15: "bbbbbbbbbbbbbbbbbbbbbbbb" };
// A project the key may not read: every call on it is refused.
const REFUSED = "ffffffffffffffffffffffff";
const PLAIN_TEXT = "eeeeeeeeeeeeeeeeeeeeeeee";

const json = (status, body) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

globalThis.fetch = async (input, init = {}) => {
  const url = new URL(String(input));
  const method = init.method ?? "GET";
  const body = init.body === undefined ? undefined : JSON.parse(init.body);
  process.stderr.write(
    `REQUEST ${JSON.stringify({ method, path: url.pathname, query: Object.fromEntries(url.searchParams), body, key: init.headers?.["CL-API-Key"] })}\n`,
  );

  if (url.pathname.startsWith(`/v1/projects/${REFUSED}/`)) {
    return json(403, { error: { code: "forbidden", message: "Not your project", status: 403 } });
  }
  // A board whose answers are not JSON: the lookup and the move both come back as plain text.
  if (url.pathname.startsWith(`/v1/projects/${PLAIN_TEXT}/`)) {
    if (method === "GET" && url.searchParams.has("number")) return new Response("ok", { status: 200 });
    if (method === "PATCH") return new Response("moved", { status: 200 });
  }
  if (method === "GET" && url.pathname.endsWith("/tickets") && url.searchParams.has("number")) {
    const id = TICKETS[url.searchParams.get("number")];
    return json(200, { items: id ? [{ id }] : [], pagination: { page: 1, limit: 1, total: id ? 1 : 0 } });
  }
  if (method === "PATCH" && url.pathname.endsWith("/move")) {
    return json(200, { item: { id: url.pathname.split("/").at(-2) }, placement: { above: null, below: null, ignored: [] } });
  }
  return json(200, { ok: true });
};
