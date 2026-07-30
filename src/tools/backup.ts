import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ToggleboxClient } from "../client.js";
import { handleTool, vmParams, booleanFlag } from "./helpers.js";

export function register(server: McpServer, client: ToggleboxClient) {
  server.registerTool(
    "get_backup_summary",
    {
      description: "Get a summary of backup configuration and status for a virtual machine",
      inputSchema: { ...vmParams },
      annotations: { readOnlyHint: true },
    },
    async ({ service_id, vm_id }) =>
      handleTool(() => client.get(`/service/${service_id}/vm/${vm_id}/backup-summary`))
  );

  server.registerTool(
    "get_backup_schedule",
    {
      description: "Get the automatic backup schedule configured for a virtual machine",
      inputSchema: { ...vmParams },
      annotations: { readOnlyHint: true },
    },
    async ({ service_id, vm_id }) =>
      handleTool(() => client.get(`/service/${service_id}/vm/${vm_id}/backup-schedule`))
  );

  server.registerTool(
    "enable_backup_schedule",
    {
      description: "Enable automatic backups for a virtual machine",
      inputSchema: { ...vmParams },
      annotations: { readOnlyHint: false },
    },
    async ({ service_id, vm_id }) =>
      handleTool(() => client.post(`/service/${service_id}/vm/${vm_id}/backup-schedule/enable`))
  );

  server.registerTool(
    "disable_backup_schedule",
    {
      description: "Disable automatic backups for a virtual machine",
      inputSchema: { ...vmParams },
      annotations: { readOnlyHint: false },
    },
    async ({ service_id, vm_id }) =>
      handleTool(() => client.post(`/service/${service_id}/vm/${vm_id}/backup-schedule/disable`))
  );

  server.registerTool(
    "update_backup_schedule",
    {
      description: "Update the automatic backup schedule for a virtual machine. Automatic backups must be enabled first.",
      inputSchema: {
        ...vmParams,
        daily_enabled: booleanFlag.describe("1 to enable daily backups, 0 to disable"),
        daily_count: z.number().int().min(0).describe("Number of daily backups to retain"),
        daily_hour: z.number().int().min(0).max(23).describe("Hour of day (0-23) to run daily backups"),
        weekly_enabled: booleanFlag.describe("1 to enable weekly backups, 0 to disable"),
        weekly_count: z.number().int().min(0).describe("Number of weekly backups to retain"),
        weekly_dow: z.number().int().min(0).max(6).describe("Day of week (0=Sunday, 6=Saturday) for weekly backups"),
        weekly_hour: z.number().int().min(0).max(23).describe("Hour of day (0-23) to run weekly backups"),
        monthly_enabled: booleanFlag.describe("1 to enable monthly backups, 0 to disable"),
        monthly_count: z.number().int().min(0).describe("Number of monthly backups to retain"),
      },
      annotations: { readOnlyHint: false },
    },
    async ({ service_id, vm_id, daily_enabled, daily_count, daily_hour, weekly_enabled, weekly_count, weekly_dow, weekly_hour, monthly_enabled, monthly_count }) =>
      handleTool(() =>
        client.post(`/service/${service_id}/vm/${vm_id}/backup-schedule`, {
          daily_enabled,
          daily_count,
          daily_hour,
          weekly_enabled,
          weekly_count,
          weekly_dow,
          weekly_hour,
          monthly_enabled,
          monthly_count,
        })
      )
  );
}
