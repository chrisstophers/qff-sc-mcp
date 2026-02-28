/// <reference lib="webworker" />
/**
 * Vercel Edge Function — MCP HTTP transport.
 *
 * Implements the Model Context Protocol over HTTP (stateless, JSON-RPC 2.0).
 * Each request is handled independently — no persistent process or session state.
 *
 * Reuses TOOLS and handleTool from src/tool-handlers.ts, the same shared layer
 * that powers the stdio transport in src/server.ts.  Both transports stay in sync
 * automatically: add a tool once in tool-handlers.ts, it appears on both.
 *
 * MCP protocol reference: https://spec.modelcontextprotocol.io/
 */
import { TOOLS, handleTool } from '../src/tool-handlers.js';

export const config = { runtime: 'edge' };

const SERVER_NAME = 'qff-sc-mcp';
const SERVER_VERSION = '0.1.0';

/**
 * The MCP protocol version this server implements.
 * Clients send this back in their `initialize` request; we echo it in the response.
 */
const PROTOCOL_VERSION = '2024-11-05';

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Accept, Mcp-Session-Id',
  'X-Powered-By': `${SERVER_NAME}/${SERVER_VERSION}`,
};

// ─── Response helpers ──────────────────────────────────────────────────────────

function jsonRpc(id: unknown, result: unknown, status = 200): Response {
  return new Response(JSON.stringify({ jsonrpc: '2.0', id, result }), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

function jsonRpcError(id: unknown, code: number, message: string): Response {
  // JSON-RPC errors always use HTTP 200 — the error is in the response body.
  // (HTTP status codes reflect the transport layer, not the RPC layer.)
  return new Response(
    JSON.stringify({ jsonrpc: '2.0', id: id ?? null, error: { code, message } }),
    { status: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
  );
}

// ─── Main handler ──────────────────────────────────────────────────────────────

export default async function handler(req: Request): Promise<Response> {
  // Preflight CORS — browsers send OPTIONS before the real POST
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405, headers: CORS_HEADERS });
  }

  // Parse the JSON-RPC request body
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonRpcError(null, -32700, 'Parse error: request body is not valid JSON');
  }

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return jsonRpcError(null, -32600, 'Invalid Request: body must be a JSON object');
  }

  const { jsonrpc, id, method, params } = body as Record<string, unknown>;

  if (jsonrpc !== '2.0') {
    return jsonRpcError(id, -32600, 'Invalid Request: jsonrpc must be "2.0"');
  }

  if (typeof method !== 'string') {
    return jsonRpcError(id, -32600, 'Invalid Request: method must be a string');
  }

  // Dispatch JSON-RPC methods
  try {
    switch (method) {
      // ── MCP handshake ──────────────────────────────────────────────────────
      case 'initialize':
        return jsonRpc(id, {
          protocolVersion: PROTOCOL_VERSION,
          capabilities: { tools: {} },
          serverInfo: { name: SERVER_NAME, version: SERVER_VERSION },
        });

      case 'notifications/initialized':
        // One-way notification from the client — no response body, just acknowledge
        return new Response(null, { status: 202, headers: CORS_HEADERS });

      // ── Tool discovery ─────────────────────────────────────────────────────
      case 'tools/list':
        return jsonRpc(id, { tools: TOOLS });

      // ── Tool execution ─────────────────────────────────────────────────────
      case 'tools/call': {
        const p =
          params && typeof params === 'object' && !Array.isArray(params)
            ? (params as Record<string, unknown>)
            : {};

        const name = typeof p['name'] === 'string' ? p['name'] : '';
        const args =
          p['arguments'] && typeof p['arguments'] === 'object' && !Array.isArray(p['arguments'])
            ? (p['arguments'] as Record<string, unknown>)
            : {};

        const result = await handleTool(name, args);
        return jsonRpc(id, result);
      }

      // ── Unknown method ─────────────────────────────────────────────────────
      default:
        return jsonRpcError(id, -32601, `Method not found: ${method}`);
    }
  } catch (error) {
    return jsonRpcError(
      id,
      -32603,
      error instanceof Error ? error.message : 'Internal server error',
    );
  }
}
