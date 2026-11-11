import sources from "./sources.mjs";

const protocolVersions = ["2025-11-25", "2025-06-18", "2025-03-26"];
const challengePath = "/.well-known/openai-apps-challenge";
const sourceIds = Object.keys(sources);
const allowedOrigins = new Set([
  "https://mtb.bible",
  "https://www.mtb.bible",
  "https://chatgpt.com",
  "https://platform.openai.com",
]);

const tool = {
  name: "read_mtb_source",
  title: "Read a Mastering the Bible source",
  description: "Retrieve the Core Convictions, Tenets of Faith and Doctrine, or an MTB guide to interpreting Scripture. Use numbered sections for individual convictions and tenets. The tool accepts source identifiers and section numbers only.",
  inputSchema: {
    type: "object",
    properties: {
      source: { type: "string", enum: sourceIds },
      sections: {
        type: "array",
        description: "Optional conviction or tenet numbers. Omit to read the entire source.",
        items: { type: "integer", minimum: 1, maximum: 20 },
        minItems: 1,
        maxItems: 20,
        uniqueItems: true,
      },
    },
    required: ["source"],
    additionalProperties: false,
  },
  outputSchema: {
    type: "object",
    properties: {
      title: { type: "string" },
      url: { type: ["string", "null"] },
      text: { type: "string" },
    },
    required: ["title", "url", "text"],
    additionalProperties: false,
  },
  annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  _meta: {
    securitySchemes: [{ type: "noauth" }],
    "openai/toolInvocation/invoking": "Reading the MTB source",
    "openai/toolInvocation/invoked": "Read the MTB source",
  },
};

function rpcError(id, code, message, status = 200) {
  return Response.json({ jsonrpc: "2.0", id, error: { code, message } }, { status });
}

function sourceError(text) {
  return { isError: true, content: [{ type: "text", text }] };
}

function readSource(args) {
  if (!args || typeof args !== "object" || Array.isArray(args) ||
      Object.keys(args).some((key) => key !== "source" && key !== "sections") ||
      !sourceIds.includes(args.source)) {
    return sourceError("Choose one of the listed MTB source identifiers.");
  }

  const source = sources[args.source];
  let text = source.text;
  if (args.sections !== undefined) {
    const sections = args.sections;
    if (!source.sections || !Array.isArray(sections) || sections.length === 0 ||
        sections.length > 20 || new Set(sections).size !== sections.length ||
        sections.some((number) => !Number.isInteger(number) || !Object.hasOwn(source.sections, number))) {
      return sourceError("Choose distinct section numbers that exist in this MTB source, or omit sections to read the entire source.");
    }
    text = sections.map((number) => source.sections[number]).join("\n\n");
  }

  const record = { title: source.title, url: source.url, text };
  const heading = source.url ? `${source.title}\n${source.url}` : source.title;
  return { structuredContent: record, content: [{ type: "text", text: `${heading}\n\n${text}` }] };
}

function handleMessage(message) {
  if (!message || message.jsonrpc !== "2.0" || typeof message.method !== "string" ||
      (Object.hasOwn(message, "id") && typeof message.id !== "string" &&
        !Number.isSafeInteger(message.id))) {
    return rpcError(null, -32600, "Invalid JSON-RPC request", 400);
  }
  if (!Object.hasOwn(message, "id")) return new Response(null, { status: 202 });

  const { id, method, params } = message;
  let result;
  switch (method) {
    case "initialize": {
      const requested = params?.protocolVersion;
      result = {
        protocolVersion: protocolVersions.includes(requested) ? requested : protocolVersions[0],
        capabilities: { tools: {} },
        serverInfo: { name: "ask-mtb", version: "0.2.0" },
      };
      break;
    }
    case "ping":
      result = {};
      break;
    case "tools/list":
      result = { tools: [tool] };
      break;
    case "tools/call":
      if (params?.name !== tool.name) return rpcError(id, -32602, "Unknown tool");
      result = readSource(params.arguments);
      break;
    default:
      return rpcError(id, -32601, "Method not found");
  }
  return Response.json({ jsonrpc: "2.0", id, result }, { headers: { "Cache-Control": "no-store" } });
}

export default async function handler(request) {
  const url = new URL(request.url);
  const origin = request.headers.get("Origin");
  if (origin && !allowedOrigins.has(origin) && origin !== url.origin) {
    return new Response("Forbidden origin", { status: 403 });
  }

  if (url.pathname === challengePath) {
    if (request.method !== "GET") return new Response(null, { status: 405, headers: { Allow: "GET" } });
    const token = process.env.ASK_MTB_OPENAI_CHALLENGE;
    return token
      ? new Response(token, { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } })
      : new Response("Not found", { status: 404 });
  }

  if (request.method !== "POST") return new Response(null, { status: 405, headers: { Allow: "POST" } });
  const version = request.headers.get("MCP-Protocol-Version");
  if (version && !protocolVersions.includes(version)) {
    return rpcError(null, -32600, "Unsupported MCP protocol version", 400);
  }
  const mediaType = request.headers.get("Content-Type")?.split(";")[0].trim().toLowerCase();
  if (mediaType !== "application/json") return new Response(null, { status: 415 });

  let message;
  try {
    const body = await request.arrayBuffer();
    if (body.byteLength > 8192) return new Response(null, { status: 413 });
    message = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(body));
  } catch {
    return rpcError(null, -32700, "Invalid JSON", 400);
  }
  return handleMessage(message);
}

export const config = {
  path: ["/mcp", "/.well-known/openai-apps-challenge"],
  preferStatic: true,
};
