/**
 * MCP server setup.
 *
 * createServer() — builds and configures the Server instance.
 *   Used by: this file (stdio) and api/mcp.ts (HTTP, Phase 3).
 *
 * startStdioServer() — connects the server to stdin/stdout.
 *   Used by: src/index.ts (the CLI entry point).
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type CallToolResult,
} from '@modelcontextprotocol/sdk/types.js';
import { TOOLS, handleTool } from './tool-handlers.js';

const SERVER_NAME = 'qff-sc-mcp';
const SERVER_VERSION = '0.1.0';

/**
 * Build and configure the MCP Server instance.
 * Registers all tool definitions and request handlers.
 * The caller is responsible for connecting a transport.
 */
export function createServer(): Server {
  const server = new Server(
    { name: SERVER_NAME, version: SERVER_VERSION },
    { capabilities: { tools: {} } },
  );

  // tools/list — return the tool definitions Claude uses to know what's available
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: TOOLS,
  }));

  // tools/call — dispatch to the appropriate handler.
  // Cast is safe: our ToolResult shape matches CallToolResult exactly at runtime.
  // The SDK v1.27.1 handler union includes agent task result types that TypeScript
  // can't narrow away, so we help it with an explicit cast.
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    return handleTool(name, args ?? {}) as unknown as CallToolResult;
  });

  return server;
}

/**
 * Start the MCP server using stdio transport.
 * This is the standard local mode: Claude Code spawns this process
 * and communicates via stdin/stdout JSON-RPC messages.
 */
export async function startStdioServer(): Promise<void> {
  const server = createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
