#!/usr/bin/env node
/**
 * Entry point for the qff-sc-mcp stdio server.
 *
 * Run directly:   node dist/index.js
 * Run via npx:    npx qff-sc-mcp
 * Add to Claude:  claude mcp add qff-sc-mcp -- node /path/to/dist/index.js
 */

import { startStdioServer } from './server.js';

startStdioServer().catch((err: unknown) => {
  // Write to stderr so it doesn't interfere with the MCP stdio protocol
  process.stderr.write(`qff-sc-mcp: fatal error: ${String(err)}\n`);
  process.exit(1);
});
