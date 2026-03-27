#!/usr/bin/env node
/**
 * BrandaptOS MCP Server
 *
 * Gives Claude live read/write access to BrandaptOS from any Claude tab:
 * - Ventures & project logs (decisions, milestones, insights)
 * - VentureChat conversations & messages
 * - Knowledge base documents
 * - Venture analytics metrics
 *
 * Transport: stdio (runs as subprocess of the Claude desktop app)
 *
 * Setup:
 * 1. npm install && npm run build
 * 2. Set BRANDAPT_SERVICE_ACCOUNT_PATH env var to your Firebase service account JSON
 *    OR set GOOGLE_APPLICATION_CREDENTIALS
 *    OR be logged in via: gcloud auth application-default login
 * 3. Add to Claude desktop app → Settings → MCP Servers:
 *    {
 *      "brandapt": {
 *        "command": "node",
 *        "args": ["C:/path/to/_sdk/brandapt-mcp-server/dist/index.js"],
 *        "env": {
 *          "BRANDAPT_SERVICE_ACCOUNT_PATH": "C:/path/to/service-account.json",
 *          "BRANDAPT_PROJECT_ID": "brandaptos-v2"
 *        }
 *      }
 *    }
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerVentureTools } from "./tools/ventures.js";
import { registerConversationTools } from "./tools/conversations.js";
import { registerKnowledgeTools } from "./tools/knowledge.js";

// Validate required environment
const projectId = process.env.BRANDAPT_PROJECT_ID || "brandaptos-v2";
const serviceAccountPath = process.env.BRANDAPT_SERVICE_ACCOUNT_PATH;

if (!serviceAccountPath && !process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  process.stderr.write(
    "WARNING: No service account credentials found.\n" +
    "Set BRANDAPT_SERVICE_ACCOUNT_PATH or GOOGLE_APPLICATION_CREDENTIALS.\n" +
    "Or run: gcloud auth application-default login\n"
  );
}

// Create MCP server
const server = new McpServer({
  name: "brandapt-mcp-server",
  version: "1.0.0",
});

// Register all tool groups
registerVentureTools(server);
registerConversationTools(server);
registerKnowledgeTools(server);

// Start server via stdio
async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  process.stderr.write(`BrandaptOS MCP Server running (project: ${projectId})\n`);
}

main().catch((error: unknown) => {
  process.stderr.write(`Fatal error: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
