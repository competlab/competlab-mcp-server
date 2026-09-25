// What each tool sends to the API, against the fake one in mock-api.mjs. Run: npm test
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PROJECT = "0123456789abcdef01234567";

let client;
let requests = [];

before(async () => {
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: ["--import", pathToFileURL(path.join(root, "test", "mock-api.mjs")).href, path.join(root, "dist", "index.js")],
    env: { ...process.env, COMPETLAB_API_KEY: "test-key" },
    stderr: "pipe",
  });
  let buffered = "";
  transport.stderr.on("data", (chunk) => {
    buffered += chunk;
    let newline;
    while ((newline = buffered.indexOf("\n")) >= 0) {
      const line = buffered.slice(0, newline);
      buffered = buffered.slice(newline + 1);
      if (line.startsWith("REQUEST ")) requests.push(JSON.parse(line.slice(8)));
    }
  });
  client = new Client({ name: "test", version: "0" });
  await client.connect(transport);
});

after(() => client?.close());

// Calls a tool and returns its answer and the requests it made, once stderr has caught up.
async function call(name, args) {
  requests = [];
  const answer = await client.callTool({ name, arguments: args });
  await new Promise((resolve) => setTimeout(resolve, 50));
  return { answer, requests, text: answer.content?.[0]?.text };
}

test("a dashboard forwards only what was passed, string numbers and booleans as values", async () => {
  const { requests } = await call("get_ai_visibility_dashboard", {
    projectId: PROJECT,
    view: "compact",
    mapOffset: "10",
    includeAnswers: "true",
    promptIndex: 0,
  });
  assert.deepEqual(requests, [
    {
      method: "GET",
      path: `/v1/projects/${PROJECT}/ai-visibility`,
      query: { view: "compact", mapOffset: "10", includeAnswers: "true", promptIndex: "0" },
      key: "test-key",
    },
  ]);
});

test("a dashboard with nothing passed sends no query, so the API's default view applies", async () => {
  const { requests } = await call("get_ai_sources_dashboard", { projectId: PROJECT });
  assert.equal(requests.length, 1);
  assert.deepEqual(requests[0].query, {});
});

test("a paging number out of range is refused before any request", async () => {
  const { answer, requests } = await call("get_ai_visibility_dashboard", { projectId: PROJECT, mapLimit: "500" });
  assert.equal(answer.isError, true);
  assert.equal(requests.length, 0);
});

test("list parameters go comma-joined", async () => {
  const { requests } = await call("list_tickets", {
    projectId: PROJECT,
    status: ["todo", "in_progress"],
    effort: "low",
    include: ["description"],
    limit: 1,
  });
  assert.deepEqual(requests[0].query, { status: "todo,in_progress", effort: "low", include: "description", limit: "1" });
});

test("a ticket number is resolved to its id through the list's number filter", async () => {
  const { requests } = await call("get_ticket", { projectId: PROJECT, ticketId: "#14" });
  assert.deepEqual(
    requests.map((r) => [r.method, r.path, r.query]),
    [
      ["GET", `/v1/projects/${PROJECT}/tickets`, { number: "14", limit: "1" }],
      ["GET", `/v1/projects/${PROJECT}/tickets/aaaaaaaaaaaaaaaaaaaaaaaa`, {}],
    ],
  );
});

test("an id passes through without a lookup", async () => {
  const { requests } = await call("list_ticket_comments", { projectId: PROJECT, ticketId: "bbbbbbbbbbbbbbbbbbbbbbbb" });
  assert.deepEqual(requests.map((r) => r.path), [`/v1/projects/${PROJECT}/tickets/bbbbbbbbbbbbbbbbbbbbbbbb/comments`]);
});

test("a number no ticket carries answers not_found and sends nothing else", async () => {
  const { answer, requests, text } = await call("delete_ticket", { projectId: PROJECT, ticketId: "99" });
  assert.equal(answer.isError, true);
  assert.deepEqual(JSON.parse(text), { error: { code: "not_found", message: "No ticket #99 on this project", status: 404 } });
  assert.equal(requests.length, 1);
});

test("a refused lookup is handed back as the API gave it", async () => {
  const { answer, requests, text } = await call("get_ticket", { projectId: "ffffffffffffffffffffffff", ticketId: "#14" });
  assert.equal(answer.isError, true);
  assert.deepEqual(JSON.parse(text), { error: { code: "forbidden", message: "Not your project", status: 403 } });
  assert.equal(requests.length, 1);
});

test("update_ticket keeps a null, which clears the field", async () => {
  const { requests } = await call("update_ticket", { projectId: PROJECT, ticketId: "#15", dueDate: null, impact: 3 });
  assert.deepEqual(requests.at(-1), {
    method: "PATCH",
    path: `/v1/projects/${PROJECT}/tickets/bbbbbbbbbbbbbbbbbbbbbbbb`,
    query: {},
    body: { dueDate: null, impact: 3 },
    key: "test-key",
  });
});

test("a move resolves its neighbours; one no ticket carries is left out and reported as ignored", async () => {
  const { requests, text } = await call("move_ticket", {
    projectId: PROJECT,
    ticketId: "#14",
    status: "todo",
    beforeId: "#15",
    afterId: "#16",
  });
  const move = requests.at(-1);
  assert.equal(move.path, `/v1/projects/${PROJECT}/tickets/aaaaaaaaaaaaaaaaaaaaaaaa/move`);
  assert.deepEqual(move.body, { status: "todo", beforeId: "bbbbbbbbbbbbbbbbbbbbbbbb" });
  assert.deepEqual(JSON.parse(text).placement.ignored, [{ id: "#16", as: "afterId", reason: "not_found", status: null }]);
});

test("a move to a position sends the position", async () => {
  const { requests } = await call("move_ticket", { projectId: PROJECT, ticketId: "#14", status: "done", position: "top" });
  assert.deepEqual(requests.at(-1).body, { status: "done", position: "top" });
});

test("a free tool posts its arguments as the body", async () => {
  const { requests } = await call("check_sitemap", { domain: "example.com" });
  assert.deepEqual(requests, [
    { method: "POST", path: "/v1/tools/sitemap-visualizer", query: {}, body: { domain: "example.com" }, key: "test-key" },
  ]);
});

test("briefing sections go comma-joined", async () => {
  const { requests } = await call("get_briefing", { projectId: PROJECT, sections: ["hub", "deep-pricing"] });
  assert.equal(requests[0].query.sections, "hub,deep-pricing");
});

test("a paging number too large to be exact is refused, not sent rounded", async () => {
  const { answer, requests } = await call("get_ai_visibility_dashboard", {
    projectId: PROJECT,
    mapOffset: "99999999999999999999",
  });
  assert.equal(answer.isError, true);
  assert.equal(requests.length, 0);
});

test("a URL is sent as written", async () => {
  const { requests } = await call("fetch_url", { url: "https://Example.com/a/b/." });
  assert.equal(requests[0].body.url, "https://Example.com/a/b/.");
});

test("a lookup answered with something other than JSON reads as no such ticket", async () => {
  const { answer, text } = await call("get_ticket", { projectId: "eeeeeeeeeeeeeeeeeeeeeeee", ticketId: "#14" });
  assert.equal(answer.isError, true);
  assert.equal(JSON.parse(text).error.code, "not_found");
});

test("a move that happened is reported as it came, even when its answer is not JSON", async () => {
  const { answer, text } = await call("move_ticket", {
    projectId: "eeeeeeeeeeeeeeeeeeeeeeee",
    ticketId: "aaaaaaaaaaaaaaaaaaaaaaaa",
    status: "todo",
    afterId: "#16",
  });
  assert.notEqual(answer.isError, true);
  assert.equal(text, "moved");
});
