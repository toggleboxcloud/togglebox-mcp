import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ToggleboxClient } from "../client.js";
import { handleTool, serviceId } from "./helpers.js";

const monitorId = {
  monitor_id: z.number().int().min(1).describe("The Checkmk monitor ID"),
};

const monitorType = z.enum(["http", "ping", "tcp_port"]);
const notificationContact = z.object({
  type: z.enum(["client", "contact"]).describe("Primary client or client sub-contact"),
  id: z.number().int().min(1).describe("Client or contact ID returned by list_checkmk_notification_contacts"),
  ticket_email: z.boolean().optional().describe("Send incident and ticket email to this recipient"),
  sms: z.boolean().optional().describe("Send incident SMS to this recipient"),
});

const httpMethod = z.enum(["GET", "POST", "PUT", "HEAD"]);
const responseTimeSettings = z
  .object({
    warn: z.number().positive().describe("Warning response-time threshold in seconds"),
    crit: z.number().positive().describe("Critical response-time threshold in seconds"),
  })
  .refine(({ warn, crit }) => crit >= warn, {
    message: "Critical response-time threshold must be greater than or equal to warning threshold",
    path: ["crit"],
  });

const positiveUpdateThreshold = z.union([
  z.number().positive(),
  z.string().refine(
    (value) => /^(?:\d+(?:\.\d*)?|\.\d+)$/.test(value.trim()) && Number(value) > 0,
    "Response-time threshold must be a positive number"
  ),
]);
const activeUpdateResponseTime = z
  .object({
    warn: positiveUpdateThreshold,
    crit: positiveUpdateThreshold,
  })
  .refine(({ warn, crit }) => Number(crit) >= Number(warn), {
    message: "Critical response-time threshold must be greater than or equal to warning threshold",
    path: ["crit"],
  });
const updateResponseTimeSettings = z.union([
  activeUpdateResponseTime,
  z.object({ warn: z.literal(""), crit: z.literal("") }),
]);

const httpSettings = z.object({
  method: httpMethod.optional().describe("HTTP request method (default: GET)"),
  expected_codes: z.string().optional().describe("Expected HTTP status codes, for example 200:399 or 200,204"),
  content_search: z.string().optional().describe("Text that must appear in the response body"),
  response_time: responseTimeSettings.optional(),
  check_cert: z.boolean().optional().describe("Check TLS certificate validity and expiration; target must use HTTPS"),
  ssl_expiry_warn_days: z.number().int().positive().optional().describe("Warn this many days before certificate expiry"),
  ssl_expiry_crit_days: z.number().int().positive().optional().describe("Become critical this many days before certificate expiry"),
});

const updateHttpSettings = httpSettings.extend({
  method: httpMethod.describe("HTTP request method"),
  expected_codes: z.string().describe("Expected HTTP status codes; use an empty string for no explicit codes"),
  content_search: z.string().describe("Required response text; use an empty string to disable content matching"),
  response_time: updateResponseTimeSettings.describe("Paired response-time thresholds from edit_definition; empty strings disable thresholds"),
  check_cert: z.boolean().describe("Whether to check TLS certificate validity and expiration"),
  ssl_expiry_warn_days: z.number().int().positive().describe("Warning threshold in days before certificate expiry"),
  ssl_expiry_crit_days: z.number().int().positive().describe("Critical threshold in days before certificate expiry"),
});

const tcpSettings = z.object({
  port: z.number().int().min(1).max(65535).describe("TCP port to check"),
});

const definitionFields = {
  name: z.string().min(1).max(255).describe("Display name for the monitor"),
  type: monitorType.describe("Monitor type"),
  target: z.string().min(1).describe("Public URL, hostname, IP address, or owned VM address to monitor"),
  interval: z.number().int().positive().optional().describe("Check interval in seconds"),
  timeout: z.number().int().positive().optional().describe("Check timeout in seconds"),
  proactive: z.boolean().optional().describe("Automatically open a support ticket on failure when the product permits it"),
  renotify_minutes: z
    .union([z.literal(0), z.literal(10), z.literal(30), z.literal(60)])
    .optional()
    .describe("Repeat notification interval while down; 0 disables repeats"),
  http: httpSettings.optional().describe("HTTP-specific check settings"),
  tcp: tcpSettings.optional().describe("TCP-specific check settings; required for tcp_port monitors"),
};

/** tcp_port monitors are rejected server-side without a port; catch it before the round trip. */
const hasPortWhenTcp = (definition: { type?: string; tcp?: unknown }) =>
  definition.type !== "tcp_port" || definition.tcp !== undefined;
const tcpPortRequired = {
  message: "tcp.port is required for tcp_port monitors",
  path: ["tcp"],
};

const monitorDefinition = z.object(definitionFields).refine(hasPortWhenTcp, tcpPortRequired);
const bulkMonitorDefinition = z
  .object({
    ...definitionFields,
    name: definitionFields.name.optional().describe("Optional prefix; omit to derive names from VM labels"),
    type: z.enum(["ping", "tcp_port"]).describe("Bulk creation supports Ping and TCP monitors"),
    target: z.string().optional().describe("Ignored; targets are loaded from the account's OpenNebula VMs"),
  })
  .refine(hasPortWhenTcp, tcpPortRequired);
// No hasPortWhenTcp refinement here: the backend validates the merge of this definition with the
// stored monitor, so resending type "tcp_port" for a monitor that already has a port is valid.
// Only a type *switch* needs a new tcp block, and the schema cannot see the stored type.
const updateMonitorDefinition = z.object({
  name: definitionFields.name.optional(),
  type: definitionFields.type
    .optional()
    .describe("Monitor type; switching an existing monitor to tcp_port requires sending tcp in the same call"),
  target: definitionFields.target.optional(),
  interval: definitionFields.interval,
  timeout: definitionFields.timeout,
  proactive: definitionFields.proactive,
  renotify_minutes: definitionFields.renotify_minutes,
  http: updateHttpSettings.optional().describe("Complete replacement HTTP settings from the monitor's edit_definition"),
  tcp: definitionFields.tcp,
});

function monitorsPath(serviceIdValue: number, suffix = ""): string {
  return `/service/${serviceIdValue}/checkmk/monitors${suffix}`;
}

function monitorPath(serviceIdValue: number, monitorIdValue: number, suffix = ""): string {
  return `${monitorsPath(serviceIdValue)}/${monitorIdValue}${suffix}`;
}

export function register(server: McpServer, client: ToggleboxClient) {
  server.registerTool(
    "get_checkmk_summary",
    {
      description: "Get a Checkmk monitoring service summary, monitor state counts, capacity, and enabled capabilities",
      inputSchema: { ...serviceId },
      annotations: { readOnlyHint: true },
    },
    async ({ service_id }) => handleTool(() => client.get(`/service/${service_id}/checkmk`))
  );

  server.registerTool(
    "list_checkmk_monitors",
    {
      description: "List all Checkmk monitors belonging to a monitoring service",
      inputSchema: { ...serviceId },
      annotations: { readOnlyHint: true },
    },
    async ({ service_id }) => handleTool(() => client.get(monitorsPath(service_id)))
  );

  server.registerTool(
    "get_checkmk_monitor",
    {
      description: "Get one Checkmk monitor with its current per-site state and check output",
      inputSchema: { ...serviceId, ...monitorId },
      annotations: { readOnlyHint: true },
    },
    async ({ service_id, monitor_id }) =>
      handleTool(() => client.get(monitorPath(service_id, monitor_id)))
  );

  server.registerTool(
    "list_checkmk_incidents",
    {
      description: "Get recent incident history for a Checkmk monitor",
      inputSchema: {
        ...serviceId,
        ...monitorId,
        limit: z.number().int().min(1).max(100).optional().describe("Maximum incidents to return (default: 50)"),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ service_id, monitor_id, limit }) =>
      handleTool(() =>
        client.get(monitorPath(service_id, monitor_id, "/incidents"), {
          ...(limit !== undefined && { limit: String(limit) }),
        })
      )
  );

  server.registerTool(
    "list_checkmk_notification_contacts",
    {
      description: "List notification recipients available to a Checkmk service and optionally show those selected for a monitor",
      inputSchema: {
        ...serviceId,
        monitor_id: z.number().int().min(1).optional().describe("Monitor whose selected recipients should be included"),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ service_id, monitor_id }) =>
      handleTool(() =>
        client.get(`/service/${service_id}/checkmk/notifications`, {
          ...(monitor_id !== undefined && { monitor_id: String(monitor_id) }),
        })
      )
  );

  server.registerTool(
    "list_checkmk_monitorable_vms",
    {
      description: "List the account's OpenNebula VMs that can be targets for Checkmk Ping or TCP monitors",
      inputSchema: { ...serviceId },
      annotations: { readOnlyHint: true },
    },
    async ({ service_id }) => handleTool(() => client.get(`/service/${service_id}/checkmk/vms`))
  );

  server.registerTool(
    "create_checkmk_monitor",
    {
      description: "Create and immediately activate an HTTP, Ping, or TCP Checkmk monitor",
      inputSchema: {
        ...serviceId,
        definition: monitorDefinition.describe("Monitor definition"),
        contacts: z.array(notificationContact).optional().describe("Initial notification recipients"),
      },
      annotations: { readOnlyHint: false },
    },
    async ({ service_id, definition, contacts }) =>
      handleTool(() =>
        client.post(monitorsPath(service_id), {
          definition,
          ...(contacts !== undefined && { contacts }),
        })
      )
  );

  server.registerTool(
    "bulk_create_checkmk_vm_monitors",
    {
      description: "Create one Ping or TCP Checkmk monitor for every monitorable OpenNebula VM in the account",
      inputSchema: {
        ...serviceId,
        definition: bulkMonitorDefinition.describe("Shared definition; VM targets are selected by the server"),
        contacts: z.array(notificationContact).optional().describe("Initial notification recipients"),
      },
      annotations: { readOnlyHint: false },
    },
    async ({ service_id, definition, contacts }) =>
      handleTool(() =>
        client.post(monitorsPath(service_id, "/bulk-create"), {
          definition,
          ...(contacts !== undefined && { contacts }),
        })
      )
  );

  server.registerTool(
    "update_checkmk_monitor",
    {
      description: "Update a Checkmk monitor definition; use pause/resume tools for lifecycle state",
      inputSchema: {
        ...serviceId,
        ...monitorId,
        definition: updateMonitorDefinition.describe("Top-level fields to update; when changing HTTP settings, pass the complete http block from get_checkmk_monitor edit_definition"),
      },
      annotations: { readOnlyHint: false, idempotentHint: true },
    },
    async ({ service_id, monitor_id, definition }) =>
      handleTool(() => client.put(monitorPath(service_id, monitor_id), { definition }))
  );

  server.registerTool(
    "delete_checkmk_monitor",
    {
      description: "Permanently delete a Checkmk monitor and its generated monitoring objects",
      inputSchema: { ...serviceId, ...monitorId },
      annotations: { readOnlyHint: false, destructiveHint: true },
    },
    async ({ service_id, monitor_id }) =>
      handleTool(() => client.del(monitorPath(service_id, monitor_id)))
  );

  for (const action of ["pause", "resume"] as const) {
    server.registerTool(
      `${action}_checkmk_monitor`,
      {
        description: `${action === "pause" ? "Disable" : "Re-enable"} a Checkmk monitor without deleting it`,
        inputSchema: { ...serviceId, ...monitorId },
        annotations: { readOnlyHint: false, idempotentHint: true },
      },
      async ({ service_id, monitor_id }) =>
        handleTool(() => client.post(monitorPath(service_id, monitor_id, `/${action}`)))
    );
  }

  server.registerTool(
    "refresh_checkmk_monitor",
    {
      description: "Pull a Checkmk monitor's live status and return its updated state and per-site check output",
      inputSchema: { ...serviceId, ...monitorId },
      annotations: { readOnlyHint: false },
    },
    async ({ service_id, monitor_id }) =>
      handleTool(() => client.post(monitorPath(service_id, monitor_id, "/refresh")))
  );

  server.registerTool(
    "refresh_checkmk_monitors",
    {
      description: "Refresh one bounded batch of monitor statuses; repeat with the returned cursor until it is 0",
      inputSchema: {
        ...serviceId,
        cursor: z.number().int().min(0).optional().describe("Cursor returned by the previous refresh call; omit for the first batch"),
      },
      annotations: { readOnlyHint: false },
    },
    async ({ service_id, cursor }) =>
      handleTool(() =>
        client.post(monitorsPath(service_id, "/refresh"), {
          ...(cursor !== undefined && { cursor }),
        })
      )
  );

  server.registerTool(
    "create_checkmk_monitor_ticket",
    {
      description: "Open a support ticket containing a failing Checkmk monitor's current status",
      inputSchema: { ...serviceId, ...monitorId },
      annotations: { readOnlyHint: false },
    },
    async ({ service_id, monitor_id }) =>
      handleTool(() => client.post(monitorPath(service_id, monitor_id, "/ticket")))
  );

  server.registerTool(
    "bulk_manage_checkmk_monitors",
    {
      description: "Pause, resume, or permanently delete up to 200 Checkmk monitors and report per-monitor failures",
      inputSchema: {
        ...serviceId,
        action: z.enum(["pause", "resume", "delete"]).describe("Action to apply"),
        monitor_ids: z.array(z.number().int().min(1)).min(1).max(200).describe("Monitor IDs to manage"),
      },
      annotations: { readOnlyHint: false, destructiveHint: true },
    },
    async ({ service_id, action, monitor_ids }) =>
      handleTool(() =>
        client.post(monitorsPath(service_id, "/bulk"), { action, monitor_ids })
      )
  );

  server.registerTool(
    "set_checkmk_notification_contacts",
    {
      description: "Replace the notification recipients and delivery channels for a Checkmk monitor",
      inputSchema: {
        ...serviceId,
        ...monitorId,
        contacts: z.array(notificationContact).describe("Complete replacement recipient list; an empty array restores primary-client email delivery"),
      },
      annotations: { readOnlyHint: false, idempotentHint: true },
    },
    async ({ service_id, monitor_id, contacts }) =>
      handleTool(() =>
        client.put(`/service/${service_id}/checkmk/notifications/${monitor_id}`, { contacts })
      )
  );
}
