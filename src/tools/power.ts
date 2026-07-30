import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ToggleboxClient } from "../client.js";
import { handleTool, vmParams } from "./helpers.js";


export function register(server: McpServer, client: ToggleboxClient) {
  server.registerTool(
    "poweron_vm",
    {
      description: "Power on a virtual machine",
      inputSchema: { ...vmParams },
      annotations: { readOnlyHint: false },
    },
    async ({ service_id, vm_id }) =>
      handleTool(() => client.post(`/service/${service_id}/vm/${vm_id}/poweron`))
  );

  server.registerTool(
    "shutdown_vm",
    {
      description: "Gracefully shut down a virtual machine (ACPI shutdown signal)",
      inputSchema: { ...vmParams },
      annotations: { readOnlyHint: false },
    },
    async ({ service_id, vm_id }) =>
      handleTool(() => client.post(`/service/${service_id}/vm/${vm_id}/shutdown`))
  );

  server.registerTool(
    "reboot_vm",
    {
      description: "Reboot a virtual machine",
      inputSchema: { ...vmParams },
      annotations: { readOnlyHint: false },
    },
    async ({ service_id, vm_id }) =>
      handleTool(() => client.post(`/service/${service_id}/vm/${vm_id}/reboot`))
  );

  server.registerTool(
    "poweroff_vm",
    {
      description: "Hard power off a virtual machine (immediate, ungraceful shutdown — equivalent to pulling the power cord)",
      inputSchema: { ...vmParams },
      annotations: { readOnlyHint: false },
    },
    async ({ service_id, vm_id }) =>
      handleTool(() => client.post(`/service/${service_id}/vm/${vm_id}/poweroff`))
  );
}
