#!/usr/bin/env node
// Rewrites src/tools.ts and src/instructions.ts from the hosted server (mcp.competlab.com), so this
// copy says exactly what the hosted one says.
//
//   COMPETLAB_API_KEY=cl_live_... npm run sync     reads the hosted server live
//   npm run sync -- <capture.json>                 reads a capture of it instead
//
// A capture is { serverInfo, instructions, tools } — the hosted server's initialize answer and its
// tools/list result, verbatim. Every tool needs a route in src/routes.ts; a JSON-schema shape this
// script does not know stops it rather than being guessed at.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HOSTED = "https://mcp.competlab.com/mcp";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

async function readHosted(apiKey) {
  const { Client } = await import("@modelcontextprotocol/sdk/client/index.js");
  const { StreamableHTTPClientTransport } = await import("@modelcontextprotocol/sdk/client/streamableHttp.js");
  const client = new Client({ name: "competlab-mcp-sync", version: "1.0.0" });
  await client.connect(
    new StreamableHTTPClientTransport(new URL(HOSTED), { requestInit: { headers: { "CL-API-Key": apiKey } } }),
  );
  const tools = [];
  let cursor;
  do {
    const page = await client.listTools(cursor ? { cursor } : undefined);
    tools.push(...page.tools);
    cursor = page.nextCursor;
  } while (cursor);
  const capture = {
    at: new Date().toISOString(),
    serverInfo: client.getServerVersion(),
    instructions: client.getInstructions(),
    tools,
  };
  await client.close();
  return capture;
}

const capturePath = process.argv[2];
const apiKey = process.env.COMPETLAB_API_KEY;
if (!capturePath && !apiKey) {
  console.error("usage: COMPETLAB_API_KEY=cl_live_... npm run sync   or   npm run sync -- <capture.json>");
  process.exit(2);
}
const capture = capturePath ? JSON.parse(fs.readFileSync(capturePath, "utf8")) : await readHosted(apiKey);
if (!Array.isArray(capture.tools) || typeof capture.instructions !== "string") {
  console.error("the capture needs `tools` (the tools/list result) and `instructions`");
  process.exit(2);
}

// Tool names routed in src/routes.ts, read from its source so the script needs no build step.
const routesSource = fs.readFileSync(path.join(root, "src", "routes.ts"), "utf8");
const routed = new Set([...routesSource.matchAll(/^\s+(\w+): \{ method: "/gm)].map((m) => m[1]));
const unrouted = capture.tools.map((t) => t.name).filter((name) => !routed.has(name));
if (unrouted.length) {
  console.error(`no route in src/routes.ts for: ${unrouted.join(", ")}`);
  process.exit(1);
}

const MAX_SAFE = Number.MAX_SAFE_INTEGER;

// Patterns the hosted server validates with a flag or a message of its own, kept as it does.
const KNOWN_PATTERNS = {
  "^[a-f\\d]{24}$": "objectId()",
  "^(#?\\d+|[a-f\\d]{24})$": "ticketRef()",
  "^\\d{4}-\\d{2}-\\d{2}$": "calendarDay()",
};

const fail = (where, schema) => {
  console.error(`${where}: no rule for ${JSON.stringify(schema)}`);
  process.exit(1);
};

const lit = (value) => JSON.stringify(value);

const isNumberish = (s) =>
  s.anyOf?.length === 2 &&
  s.anyOf[0].type === "integer" &&
  s.anyOf[1].type === "string" &&
  s.anyOf[1].pattern === "^\\d+$";

const isBooleanish = (s) =>
  s.anyOf?.length === 3 &&
  s.anyOf[0].type === "boolean" &&
  s.anyOf[1].const === "true" &&
  s.anyOf[2].const === "false";

// The keys each kind of node may carry. Any other key is a rule this script would silently drop,
// so it stops instead.
const HANDLED = {
  string: ["type", "pattern", "enum", "const", "format", "minLength", "maxLength"],
  integer: ["type", "minimum", "maximum"],
  boolean: ["type"],
  array: ["type", "items"],
  null: ["type"],
  anyOf: ["anyOf"],
};

function checkKeys(s, where, schema) {
  const allowed = HANDLED[s.anyOf ? "anyOf" : s.type];
  if (!allowed || Object.keys(s).some((key) => !allowed.includes(key))) fail(where, schema);
}

function zod(schema, where) {
  const { description, ...s } = schema;
  checkKeys(s, where, schema);
  if (isBooleanish(s)) return "booleanish()";
  if (isNumberish(s)) {
    const { minimum, maximum } = s.anyOf[0];
    return maximum === undefined || maximum === MAX_SAFE
      ? `numberish(${minimum})`
      : `numberish(${minimum}, ${maximum})`;
  }
  if (s.anyOf) {
    const nulls = s.anyOf.filter((b) => b.type === "null");
    const rest = s.anyOf.filter((b) => b.type !== "null");
    const inner =
      rest.length === 1
        ? zod(rest[0], where)
        : `z.union([${rest.map((b) => zod(b, where)).join(", ")}])`;
    return nulls.length ? `${inner}.nullable()` : inner;
  }
  switch (s.type) {
    case "string": {
      if (s.pattern !== undefined) {
        const known = KNOWN_PATTERNS[s.pattern];
        if (!known) fail(where, schema);
        return known;
      }
      if (s.enum) return `z.enum(${lit(s.enum)})`;
      if (s.const !== undefined) return `z.literal(${lit(s.const)})`;
      let out = "z.string()";
      if (s.format === "uri") out += ".url()";
      else if (s.format !== undefined) fail(where, schema);
      if (s.minLength !== undefined) out += `.min(${s.minLength})`;
      if (s.maxLength !== undefined) out += `.max(${s.maxLength})`;
      return out;
    }
    case "integer": {
      let out = "z.number().int()";
      if (s.minimum !== undefined) out += `.min(${s.minimum})`;
      if (s.maximum !== undefined && s.maximum !== MAX_SAFE) out += `.max(${s.maximum})`;
      return out;
    }
    case "boolean":
      return "z.boolean()";
    case "array":
      return `z.array(${zod(s.items, `${where}[]`)})`;
    default:
      return fail(where, schema);
  }
}

// A long description reads as one sentence a line; the served string is the lines joined.
function stringExpr(text, indent) {
  const pieces = text.match(/[^\n]*?(?:\. |\n|$)/g).filter((piece) => piece !== "");
  if (pieces.join("") !== text) throw new Error(`split lost text: ${text.slice(0, 80)}`);
  if (pieces.length <= 1) return lit(text);
  return pieces.map(lit).join(` +\n${indent}`);
}

const toolSource = (tool) => {
  const props = tool.inputSchema?.properties ?? {};
  const required = new Set(tool.inputSchema?.required ?? []);
  const params = Object.entries(props).map(([name, schema]) => {
    let expr = zod(schema, `${tool.name}.${name}`);
    if (!required.has(name)) expr += ".optional()";
    if (schema.description !== undefined) expr += `.describe(${stringExpr(schema.description, "          ")})`;
    return `      ${name}: ${expr},`;
  });
  const annotations = tool.annotations
    ? `\n    annotations: ${JSON.stringify(tool.annotations).replace(/"(\w+)":/g, "$1: ").replace(/,/g, ", ")},`
    : "";
  return `  {
    name: ${lit(tool.name)},
    description:
      ${stringExpr(tool.description, "      ")},
    parameters: z.object({${params.length ? `\n${params.join("\n")}\n    ` : ""}}),${annotations}
  },`;
};

const header = `// GENERATED by scripts/sync-tools.mjs from the hosted server's tools/list — do not edit by hand.
// Names, descriptions, parameters and annotations are the hosted server's (mcp.competlab.com),
// word for word. Where each tool goes on the API is src/routes.ts.
`;

// zod/v4 is the hosted server's zod: the same validation, and JSON schemas that say the same.
const tools = `${header}
import { z } from "zod/v4";

export interface ToolAnnotations {
  readOnlyHint?: boolean;
  destructiveHint?: boolean;
  idempotentHint?: boolean;
  openWorldHint?: boolean;
}

export interface ToolDef {
  name: string;
  description: string;
  parameters: z.ZodObject<z.ZodRawShape>;
  annotations?: ToolAnnotations;
}

const objectId = () =>
  z.string().regex(/^[a-f\\d]{24}$/i, "Invalid ID format — must be a 24-character hex string");

// A ticket's ID or its number as a person writes it ("#14" or "14").
const ticketRef = () =>
  z.string().regex(/^(#?\\d+|[a-f\\d]{24})$/i, "A ticket ID (24-character hex) or a ticket number ('#14')");

const calendarDay = () => z.string().regex(/^\\d{4}-\\d{2}-\\d{2}$/, "A calendar day, as YYYY-MM-DD");

// Clients routinely send JSON-schema booleans and integers as strings ("true", "0"). The hosted
// server accepts both forms instead of rejecting the call, and so does this one.
const booleanish = () =>
  z.union([
    z.boolean(),
    z.literal("true").transform(() => true),
    z.literal("false").transform(() => false),
  ]);

// The string form goes through the same integer check as the number, as on the hosted server, so a
// value too large to be exact is refused rather than sent rounded.
const numberish = (min: number, max?: number) => {
  const number = max === undefined ? z.number().int().min(min) : z.number().int().min(min).max(max);
  return z.union([
    number,
    z.string().regex(/^\\d+$/, "must be a non-negative integer").transform(Number).pipe(number),
  ]);
};

export const tools: ToolDef[] = [
${capture.tools.map(toolSource).join("\n")}
];
`;

const instructions = `${header}
export const SERVER_DESCRIPTION =
  ${stringExpr(capture.serverInfo?.description ?? "", "  ")};

export const SERVER_INSTRUCTIONS =
  ${stringExpr(capture.instructions, "  ")};
`;

fs.writeFileSync(path.join(root, "src", "tools.ts"), tools);
fs.writeFileSync(path.join(root, "src", "instructions.ts"), instructions);
console.log(
  `src/tools.ts: ${capture.tools.length} tools · src/instructions.ts: ${capture.instructions.length} characters of instructions` +
    (capture.at ? ` · capture ${capture.at}` : ""),
);
