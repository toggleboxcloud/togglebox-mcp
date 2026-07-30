import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ToggleboxClient } from "../client.js";
import { handleTool, handlePagedTool, serviceId, pageParam, buildPageParams } from "./helpers.js";

export function register(server: McpServer, client: ToggleboxClient) {
  server.registerTool(
    "list_invoices",
    {
      description: "List all invoices for the authenticated client",
      inputSchema: { ...pageParam },
      annotations: { readOnlyHint: true },
    },
    async ({ page, all_pages }) =>
      handlePagedTool(
        (requestedPage) => client.getFull("/invoice", buildPageParams(requestedPage)),
        { page, allPages: all_pages }
      )
  );

  server.registerTool(
    "get_invoice",
    {
      description: "Get detailed information about a specific invoice including line items and payment status",
      inputSchema: {
        invoice_id: z.number().int().min(1).describe("The invoice ID"),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ invoice_id }) => handleTool(() => client.get(`/invoice/${invoice_id}`))
  );

  server.registerTool(
    "get_billing_summary",
    {
      description: "Get a billing summary for a cloud service (account-level billing aggregation)",
      inputSchema: { ...serviceId },
      annotations: { readOnlyHint: true },
    },
    async ({ service_id }) =>
      handleTool(() => client.get(`/service/${service_id}/billing/summary`))
  );

  server.registerTool(
    "get_billing_usage",
    {
      description: "Get detailed billing usage breakdown for a cloud service by period",
      inputSchema: {
        ...serviceId,
        period: z.string().describe("Billing period in YYYY-MM format (e.g. 2025-03)"),
        interval: z.string().optional().describe("Optional interval granularity"),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ service_id, period, interval }) => {
      const params: Record<string, string> = { period };
      if (interval) params.interval = interval;
      return handleTool(() => client.get(`/service/${service_id}/billing/usage`, params));
    }
  );
}
