#!/usr/bin/env node

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { loadConfig } from "./config.js";
import { ToggleboxClient } from "./client.js";
import { createServer } from "./server.js";

async function main() {
  const config = loadConfig();
  const client = new ToggleboxClient(config);
  const server = createServer(client);

  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error("@toggleboxcloud/togglebox-mcp server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
