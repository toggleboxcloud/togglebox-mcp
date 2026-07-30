import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ToggleboxClient } from "../client.js";
import { handleTool, handlePagedTool, vmParams, aliasParams, pageParam, buildPageParams } from "./helpers.js";

export function register(server: McpServer, client: ToggleboxClient) {
  server.registerTool(
    "list_interfaces",
    {
      description: "List all network interfaces attached to a virtual machine",
      inputSchema: { ...vmParams, ...pageParam },
      annotations: { readOnlyHint: true },
    },
    async ({ service_id, vm_id, page, all_pages }) =>
      handlePagedTool(
        (requestedPage) => client.getFull(`/service/${service_id}/vm/${vm_id}/interfaces`, buildPageParams(requestedPage)),
        { page, allPages: all_pages }
      )
  );

  server.registerTool(
    "attach_interface",
    {
      description: "Attach a new network interface to a virtual machine",
      inputSchema: {
        ...vmParams,
        network_id: z.number().int().min(0).describe("The network ID to attach"),
      },
      annotations: { readOnlyHint: false },
    },
    async ({ service_id, vm_id, network_id }) =>
      handleTool(() => client.post(`/service/${service_id}/vm/${vm_id}/interfaces`, { network_id }))
  );

  server.registerTool(
    "detach_interface",
    {
      description: "Detach a network interface from a virtual machine",
      inputSchema: {
        ...vmParams,
        nic_id: z.number().int().min(0).describe("The network interface ID to detach"),
      },
      annotations: { readOnlyHint: false },
    },
    async ({ service_id, vm_id, nic_id }) =>
      handleTool(() => client.post(`/service/${service_id}/vm/${vm_id}/interfaces/${nic_id}/detach`))
  );

  server.registerTool(
    "swap_interfaces",
    {
      description: "Swap a network interface between two service-owned virtual machines",
      inputSchema: {
        ...vmParams,
        target_vm_id: z.number().int().min(1).describe("The target VM ID to swap the NIC with"),
        network_id: z.number().int().min(0).describe("The network ID for the swap"),
        nic_id: z.number().int().min(0).optional().describe("Specific NIC ID to swap (optional)"),
      },
      annotations: { readOnlyHint: false, destructiveHint: true },
    },
    async ({ service_id, vm_id, target_vm_id, network_id, nic_id }) =>
      handleTool(() =>
        client.post(`/service/${service_id}/vm/${vm_id}/interfaces/swap`, {
          target_vm_id,
          network_id,
          ...(nic_id !== undefined && { nic_id }),
        })
      )
  );

  server.registerTool(
    "get_reverse_dns",
    {
      description: "Get reverse DNS (PTR) records for a virtual machine's IP addresses",
      inputSchema: { ...vmParams },
      annotations: { readOnlyHint: true },
    },
    async ({ service_id, vm_id }) =>
      handleTool(() => client.get(`/service/${service_id}/vm/${vm_id}/reverse-dns`))
  );

  server.registerTool(
    "set_reverse_dns",
    {
      description: "Set a reverse DNS (PTR) record for a virtual machine's IP address",
      inputSchema: {
        ...vmParams,
        ip: z.string().describe("The IP address to set rDNS for"),
        hostname: z.string().describe("The hostname to point the PTR record to"),
      },
      annotations: { readOnlyHint: false },
    },
    async ({ service_id, vm_id, ip, hostname }) =>
      handleTool(() => client.post(`/service/${service_id}/vm/${vm_id}/reverse-dns/set`, { ip, hostname }))
  );

  server.registerTool(
    "clear_reverse_dns",
    {
      description: "Clear the reverse DNS (PTR) record for a virtual machine's IP address",
      inputSchema: {
        ...vmParams,
        ip: z.string().describe("The IP address to clear the PTR record for"),
      },
      annotations: { readOnlyHint: false },
    },
    async ({ service_id, vm_id, ip }) =>
      handleTool(() => client.post(`/service/${service_id}/vm/${vm_id}/reverse-dns/clear`, { ip }))
  );

  server.registerTool(
    "add_ip_alias",
    {
      description: "Add an IP alias from an accessible network to a virtual machine",
      inputSchema: {
        ...vmParams,
        network_id: z.number().int().min(0).describe("The network ID to allocate the alias from"),
      },
      annotations: { readOnlyHint: false },
    },
    async ({ service_id, vm_id, network_id }) =>
      handleTool(() => client.post(`/service/${service_id}/vm/${vm_id}/ip-aliases`, { network_id }))
  );

  server.registerTool(
    "move_ip_alias",
    {
      description: "Move an IP alias from one virtual machine to another within the same service",
      inputSchema: {
        ...aliasParams,
        target_vm_id: z.number().int().min(1).describe("The target VM ID to move the alias to"),
        ip: z.string().describe("The IP address of the alias to move"),
        network_id: z.number().int().min(0).optional().describe("Override network ID (uses alias network if omitted)"),
      },
      annotations: { readOnlyHint: false, destructiveHint: true },
    },
    async ({ service_id, vm_id, alias_id, target_vm_id, ip, network_id }) =>
      handleTool(() =>
        client.post(`/service/${service_id}/vm/${vm_id}/ip-aliases/${alias_id}/move`, {
          target_vm_id,
          ip,
          ...(network_id !== undefined && { network_id }),
        })
      )
  );

  server.registerTool(
    "delete_ip_alias",
    {
      description: "Delete an IP alias from a virtual machine. This releases the IP back to the pool.",
      inputSchema: {
        ...aliasParams,
        ip: z.string().describe("The IP address of the alias to delete"),
      },
      annotations: { readOnlyHint: false, destructiveHint: true },
    },
    async ({ service_id, vm_id, alias_id, ip }) =>
      handleTool(() =>
        client.post(`/service/${service_id}/vm/${vm_id}/ip-aliases/${alias_id}/delete`, { ip })
      )
  );
}
