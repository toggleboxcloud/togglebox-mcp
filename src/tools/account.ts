import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ToggleboxClient } from "../client.js";
import { handleTool } from "./helpers.js";

export function register(server: McpServer, client: ToggleboxClient) {
  server.registerTool(
    "get_account_details",
    {
      description: "Get the authenticated client's account details including name, email, address, and company information",
      inputSchema: {},
      annotations: { readOnlyHint: true },
    },
    async () => handleTool(() => client.get("/details"))
  );

  server.registerTool(
    "get_balance",
    {
      description: "Get account balance and available credit",
      inputSchema: {},
      annotations: { readOnlyHint: true },
    },
    async () => handleTool(() => client.get("/balance"))
  );
}
