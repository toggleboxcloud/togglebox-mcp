import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ToggleboxClient } from "../client.js";
import { handleTool, serviceId } from "./helpers.js";

const resourcesSchema = z.record(z.unknown()).optional().describe("Upgrade resource selections keyed by Togglebox resource ID");

export function register(server: McpServer, client: ToggleboxClient) {
  server.registerTool(
    "get_service_methods",
    {
      description: "List API methods available for a Togglebox service",
      inputSchema: { ...serviceId },
      annotations: { readOnlyHint: true },
    },
    async ({ service_id }) => handleTool(() => client.get(`/service/${service_id}/methods`))
  );

  server.registerTool(
    "get_service_upgrade_options",
    {
      description: "List available upgrade options for a Togglebox service",
      inputSchema: { ...serviceId },
      annotations: { readOnlyHint: true },
    },
    async ({ service_id }) => handleTool(() => client.get(`/service/${service_id}/upgrade`))
  );

  server.registerTool(
    "request_service_upgrade",
    {
      description: "Estimate or submit a Togglebox service upgrade request",
      inputSchema: {
        ...serviceId,
        resources: resourcesSchema,
        package: z.number().int().min(1).optional().describe("Optional new product/package ID"),
        cycle: z.string().optional().describe("Optional new billing cycle"),
        send: z.boolean().optional().describe("true to submit the upgrade request; omit/false to estimate"),
      },
      annotations: { readOnlyHint: false },
    },
    async ({ service_id, resources, package: packageId, cycle, send }) =>
      handleTool(() =>
        client.post(`/service/${service_id}/upgrade`, {
          ...(resources !== undefined && { resources }),
          ...(packageId !== undefined && { package: packageId }),
          ...(cycle !== undefined && { cycle }),
          ...(send !== undefined && { send }),
        })
      )
  );

  server.registerTool(
    "cancel_service",
    {
      description: "Submit a cancellation request for a Togglebox service",
      inputSchema: {
        ...serviceId,
        reason: z.string().min(1).describe("Cancellation reason"),
        immediate: z.boolean().optional().describe("true for immediate cancellation; false/end omitted for end of billing period"),
      },
      annotations: { readOnlyHint: false, destructiveHint: true },
    },
    async ({ service_id, reason, immediate }) =>
      handleTool(() =>
        client.post(`/service/${service_id}/cancel`, {
          reason,
          ...(immediate !== undefined && { immediate }),
        })
      )
  );

  server.registerTool(
    "get_service_label",
    {
      description: "Get the custom label for a Togglebox service",
      inputSchema: { ...serviceId },
      annotations: { readOnlyHint: true },
    },
    async ({ service_id }) => handleTool(() => client.get(`/service/${service_id}/label`))
  );

  server.registerTool(
    "set_service_label",
    {
      description: "Set the custom label for a Togglebox service",
      inputSchema: {
        ...serviceId,
        label: z.string().describe("New service label"),
      },
      annotations: { readOnlyHint: false },
    },
    async ({ service_id, label }) => handleTool(() => client.post(`/service/${service_id}/label`, { label }))
  );

  server.registerTool(
    "renew_service",
    {
      description: "Generate a manual renewal invoice for a Togglebox service",
      inputSchema: { ...serviceId },
      annotations: { readOnlyHint: false },
    },
    async ({ service_id }) => handleTool(() => client.post(`/service/${service_id}/renew`))
  );

  server.registerTool(
    "get_service_billing_cycles",
    {
      description: "List recurring billing cycle options for a Togglebox service",
      inputSchema: { ...serviceId },
      annotations: { readOnlyHint: true },
    },
    async ({ service_id }) => handleTool(() => client.get(`/service/${service_id}/cycle`))
  );

  server.registerTool(
    "set_service_billing_cycle",
    {
      description: "Change the recurring billing cycle for a Togglebox service",
      inputSchema: {
        ...serviceId,
        cycle: z.string().min(1).describe("New billing cycle value from get_service_billing_cycles"),
      },
      annotations: { readOnlyHint: false },
    },
    async ({ service_id, cycle }) => handleTool(() => client.post(`/service/${service_id}/cycle`, { cycle }))
  );
}
