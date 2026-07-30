import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ToggleboxClient } from "../client.js";
import { handleTool, handlePagedTool, pageParam, buildPageParams } from "./helpers.js";

export function register(server: McpServer, client: ToggleboxClient) {
  server.registerTool(
    "list_services",
    {
      description: "List all services/accounts owned by the authenticated client",
      inputSchema: { ...pageParam },
      annotations: { readOnlyHint: true },
    },
    async ({ page, all_pages }) =>
      handlePagedTool(
        (requestedPage) => client.getFull("/service", buildPageParams(requestedPage)),
        { page, allPages: all_pages }
      )
  );

  server.registerTool(
    "get_service_details",
    {
      description: "Get detailed information about a specific service/account including status, product, and billing cycle",
      inputSchema: {
        service_id: z.number().int().min(1).describe("The service/account ID"),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ service_id }) => handleTool(() => client.get(`/service/${service_id}`))
  );
}
