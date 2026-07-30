import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ToggleboxClient } from "../client.js";
import { jsonResource, requireId } from "./helpers.js";

export function register(server: McpServer, client: ToggleboxClient) {
  server.registerResource(
    "account",
    "togglebox://account",
    {
      description: "Account details and current balance for the authenticated user",
      mimeType: "application/json",
    },
    async (uri) => {
      const [details, balance] = await Promise.all([
        client.get("/details"),
        client.get("/balance"),
      ]);
      return jsonResource(uri, { details, balance });
    }
  );

  server.registerResource(
    "services",
    "togglebox://services",
    {
      description: "First page of cloud services/accounts. Use list_services tool for full paginated listing.",
      mimeType: "application/json",
    },
    async (uri) => {
      const data = await client.get("/service", { page: "1" });
      return jsonResource(uri, data);
    }
  );

  server.registerResource(
    "service",
    new ResourceTemplate("togglebox://service/{service_id}", { list: undefined }),
    {
      description: "Details for a specific cloud service",
      mimeType: "application/json",
    },
    async (uri, { service_id }) => {
      const id = requireId(service_id, "service_id");
      const data = await client.get(`/service/${id}`);
      return jsonResource(uri, data);
    }
  );
}
