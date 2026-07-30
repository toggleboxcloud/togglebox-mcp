import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ToggleboxClient } from "../client.js";
import { handleTool, serviceId, vmParams } from "./helpers.js";

export function register(server: McpServer, client: ToggleboxClient) {
  server.registerTool(
    "get_vm_operation_status",
    {
      description: "Get the status of a specific operation on a virtual machine (e.g. check if a queued action completed)",
      inputSchema: {
        ...vmParams,
        operation: z.string().describe("Operation name to check (e.g. vm_hostname_change, reboot, resize)"),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ service_id, vm_id, operation }) =>
      handleTool(() =>
        client.getStatus(`/service/${service_id}/vm/${vm_id}/operation-status`, { operation })
      )
  );

  server.registerTool(
    "get_service_operation_status",
    {
      description: "Get the status of a specific operation at the service level (e.g. vm_create)",
      inputSchema: {
        ...serviceId,
        operation: z.string().describe("Operation name to check (e.g. vm_create)"),
        request_id: z.string().optional().describe("Optional request ID from a queued operation response"),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ service_id, operation, request_id }) => {
      const params: Record<string, string> = { operation };
      if (request_id) params.request_id = request_id;
      return handleTool(() =>
        client.getStatus(`/service/${service_id}/operation-status`, params)
      );
    }
  );

  server.registerTool(
    "check_task_status",
    {
      description: "Check a queued task/operation status. Provide vm_id for VM-scoped tasks, or request_id for service-scoped tasks such as VM creation.",
      inputSchema: {
        ...serviceId,
        operation: z.string().describe("Operation key to check (e.g. reboot, vm_create, volume_attach)"),
        vm_id: z.number().int().min(0).optional().describe("VM ID for VM-scoped tasks"),
        request_id: z.string().optional().describe("Request ID returned by a service-scoped queued task"),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ service_id, operation, vm_id, request_id }) => {
      const params: Record<string, string> = { operation };
      if (request_id) params.request_id = request_id;
      const path =
        vm_id !== undefined
          ? `/service/${service_id}/vm/${vm_id}/operation-status`
          : `/service/${service_id}/operation-status`;

      return handleTool(() => client.getStatus(path, params));
    }
  );

  server.registerTool(
    "get_vm_usage",
    {
      description: "Get CPU, memory, and network usage metrics for a virtual machine",
      inputSchema: {
        ...vmParams,
        time_range: z
          .enum(["all", "1h", "6h", "12h", "24h", "7d", "30d", "90d"])
          .optional()
          .default("all")
          .describe("Time range for usage data"),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ service_id, vm_id, time_range }) =>
      handleTool(() =>
        client.get(`/service/${service_id}/vm/${vm_id}/usage`, { time_range: time_range ?? "all" })
      )
  );

  server.registerTool(
    "get_vm_activity",
    {
      description: "Get the activity log for a virtual machine",
      inputSchema: {
        ...vmParams,
        limit: z.number().int().min(1).max(1000).optional().describe("Number of entries per page"),
        offset: z.number().int().min(0).optional().describe("Result offset for pagination"),
        sort_by: z.string().optional().describe("Column to sort by"),
        sort_order: z.enum(["asc", "desc"]).optional().describe("Sort direction"),
        action: z.string().optional().describe("Filter by action name"),
        status: z.string().optional().describe("Filter by status"),
        search: z.string().optional().describe("Search text filter"),
        start_date: z.string().optional().describe("Filter entries from this date (ISO format)"),
        end_date: z.string().optional().describe("Filter entries until this date (ISO format)"),
        time_range: z.string().optional().describe("Predefined time range filter"),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ service_id, vm_id, limit, offset, sort_by, sort_order, action, status, search, start_date, end_date, time_range }) => {
      const params: Record<string, string> = {};
      if (limit !== undefined) params.limit = String(limit);
      if (offset !== undefined) params.offset = String(offset);
      if (sort_by) params.sort_by = sort_by;
      if (sort_order) params.sort_order = sort_order;
      if (action) params.action = action;
      if (status) params.status = status;
      if (search) params.search = search;
      if (start_date) params.start_date = start_date;
      if (end_date) params.end_date = end_date;
      if (time_range) params.time_range = time_range;
      return handleTool(() =>
        client.get(`/service/${service_id}/vm/${vm_id}/activity`, params)
      );
    }
  );

  server.registerTool(
    "get_service_activity",
    {
      description: "Get the activity log for an entire cloud service (all VMs and volumes)",
      inputSchema: {
        ...serviceId,
        limit: z.number().int().min(1).max(1000).optional().describe("Number of entries per page"),
        offset: z.number().int().min(0).optional().describe("Result offset for pagination"),
        sort_by: z.string().optional().describe("Column to sort by"),
        sort_order: z.enum(["asc", "desc"]).optional().describe("Sort direction"),
        action: z.string().optional().describe("Filter by action name"),
        status: z.string().optional().describe("Filter by status"),
        search: z.string().optional().describe("Search text filter"),
        start_date: z.string().optional().describe("Filter entries from this date (ISO format)"),
        end_date: z.string().optional().describe("Filter entries until this date (ISO format)"),
        vm_id: z.number().int().min(0).optional().describe("Filter by specific VM ID"),
        volume_id: z.number().int().min(1).optional().describe("Filter by specific volume ID"),
        filter_all_vms: z.number().int().min(0).max(1).optional().describe("1 to include all VMs"),
        filter_all_volumes: z.number().int().min(0).max(1).optional().describe("1 to include all volumes"),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ service_id, limit, offset, sort_by, sort_order, action, status, search, start_date, end_date, vm_id, volume_id, filter_all_vms, filter_all_volumes }) => {
      const params: Record<string, string> = {};
      if (limit !== undefined) params.limit = String(limit);
      if (offset !== undefined) params.offset = String(offset);
      if (sort_by) params.sort_by = sort_by;
      if (sort_order) params.sort_order = sort_order;
      if (action) params.action = action;
      if (status) params.status = status;
      if (search) params.search = search;
      if (start_date) params.start_date = start_date;
      if (end_date) params.end_date = end_date;
      if (vm_id !== undefined) params.vm_id = String(vm_id);
      if (volume_id !== undefined) params.volume_id = String(volume_id);
      if (filter_all_vms !== undefined) params.filter_all_vms = String(filter_all_vms);
      if (filter_all_volumes !== undefined) params.filter_all_volumes = String(filter_all_volumes);
      return handleTool(() =>
        client.get(`/service/${service_id}/activity`, params)
      );
    }
  );
}
