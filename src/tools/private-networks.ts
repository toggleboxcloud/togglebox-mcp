import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ToggleboxClient } from "../client.js";
import { handleTool, handlePagedTool, serviceId, netParams, arParams, pageParam, buildPageParams } from "./helpers.js";

export function register(server: McpServer, client: ToggleboxClient) {
  server.registerTool(
    "list_private_networks",
    {
      description: "List all private networks for a cloud service",
      inputSchema: { ...serviceId, ...pageParam },
      annotations: { readOnlyHint: true },
    },
    async ({ service_id, page, all_pages }) =>
      handlePagedTool(
        (requestedPage) => client.getFull(`/service/${service_id}/private-networks`, buildPageParams(requestedPage)),
        { page, allPages: all_pages }
      )
  );

  server.registerTool(
    "get_private_network",
    {
      description: "Get detailed information about a specific private network",
      inputSchema: { ...netParams },
      annotations: { readOnlyHint: true },
    },
    async ({ service_id, net_id }) =>
      handleTool(() => client.get(`/service/${service_id}/private-network/${net_id}`))
  );

  server.registerTool(
    "create_private_network",
    {
      description: "Create a new private network for a cloud service",
      inputSchema: {
        ...serviceId,
        template_id: z.number().int().min(1).describe("Network template ID to use"),
        name: z.string().describe("Name for the private network"),
        network_address: z.string().describe("Network address (e.g. 10.0.0.0)"),
        network_mask: z.string().describe("Subnet mask (e.g. 255.255.255.0)"),
        gateway: z.string().describe("Gateway IP address"),
        gateway6: z.string().optional().describe("IPv6 gateway address"),
        dns: z.string().optional().describe("DNS server address"),
        method: z.string().optional().describe("Network method (e.g. static)"),
        security_groups: z.string().optional().describe("Comma-separated security group IDs"),
      },
      annotations: { readOnlyHint: false, destructiveHint: true },
    },
    async ({ service_id, template_id, name, network_address, network_mask, gateway, gateway6, dns, method, security_groups }) =>
      handleTool(() =>
        client.post(`/service/${service_id}/private-networks`, {
          template_id,
          name,
          network_address,
          network_mask,
          gateway,
          ...(gateway6 !== undefined && { gateway6 }),
          ...(dns !== undefined && { dns }),
          ...(method !== undefined && { method }),
          ...(security_groups !== undefined && { security_groups }),
        })
      )
  );

  server.registerTool(
    "delete_private_network",
    {
      description: "Delete a private network. Fails if VMs still have NICs attached to it.",
      inputSchema: { ...netParams },
      annotations: { readOnlyHint: false, destructiveHint: true },
    },
    async ({ service_id, net_id }) =>
      handleTool(() => client.post(`/service/${service_id}/private-network/${net_id}/delete`))
  );

  server.registerTool(
    "add_network_address_range",
    {
      description: "Add an address range (AR) to an existing private network",
      inputSchema: {
        ...netParams,
        ip: z.string().describe("Starting IP address for the range"),
        size: z.number().int().min(1).describe("Number of IP addresses in the range"),
        type: z.enum(["IP4", "IP6", "IP4_6"]).describe("Address range type"),
        network_address: z.string().optional().describe("Network address override"),
        network_mask: z.string().optional().describe("Subnet mask override"),
        gateway: z.string().optional().describe("Gateway for this range"),
        gateway6: z.string().optional().describe("IPv6 gateway for this range"),
        security_groups: z.string().optional().describe("Comma-separated security group IDs"),
      },
      annotations: { readOnlyHint: false, destructiveHint: true },
    },
    async ({ service_id, net_id, ip, size, type, network_address, network_mask, gateway, gateway6, security_groups }) =>
      handleTool(() =>
        client.post(`/service/${service_id}/private-network/${net_id}/address-ranges`, {
          ip,
          size,
          type,
          ...(network_address !== undefined && { network_address }),
          ...(network_mask !== undefined && { network_mask }),
          ...(gateway !== undefined && { gateway }),
          ...(gateway6 !== undefined && { gateway6 }),
          ...(security_groups !== undefined && { security_groups }),
        })
      )
  );

  server.registerTool(
    "update_network_address_range",
    {
      description: "Update an address range on a private network. At least one field must be provided.",
      inputSchema: {
        ...arParams,
        network_address: z.string().optional().describe("New network address"),
        network_mask: z.string().optional().describe("New subnet mask"),
        gateway: z.string().optional().describe("New gateway IP"),
        gateway6: z.string().optional().describe("New IPv6 gateway"),
        security_groups: z.string().optional().describe("New comma-separated security group IDs"),
      },
      annotations: { readOnlyHint: false },
    },
    async ({ service_id, net_id, ar_id, network_address, network_mask, gateway, gateway6, security_groups }) =>
      handleTool(() => {
        if ([network_address, network_mask, gateway, gateway6, security_groups].every(v => v === undefined)) {
          throw new Error("At least one field must be provided to update the address range");
        }
        return client.post(`/service/${service_id}/private-network/${net_id}/address-range/${ar_id}/update`, {
          ...(network_address !== undefined && { network_address }),
          ...(network_mask !== undefined && { network_mask }),
          ...(gateway !== undefined && { gateway }),
          ...(gateway6 !== undefined && { gateway6 }),
          ...(security_groups !== undefined && { security_groups }),
        });
      })
  );

  server.registerTool(
    "delete_network_address_range",
    {
      description: "Delete an address range from a private network. This action is irreversible.",
      inputSchema: { ...arParams },
      annotations: { readOnlyHint: false, destructiveHint: true },
    },
    async ({ service_id, net_id, ar_id }) =>
      handleTool(() =>
        client.post(`/service/${service_id}/private-network/${net_id}/address-range/${ar_id}/delete`)
      )
  );

  server.registerTool(
    "update_network_dns",
    {
      description: "Update the DNS server for a private network",
      inputSchema: {
        ...netParams,
        dns: z.string().describe("DNS server address"),
      },
      annotations: { readOnlyHint: false },
    },
    async ({ service_id, net_id, dns }) =>
      handleTool(() =>
        client.post(`/service/${service_id}/private-network/${net_id}/dns`, { dns })
      )
  );

  server.registerTool(
    "update_network_method",
    {
      description: "Update the network method for a private network",
      inputSchema: {
        ...netParams,
        method: z.string().describe("Network method (e.g. static, dhcp)"),
      },
      annotations: { readOnlyHint: false },
    },
    async ({ service_id, net_id, method }) =>
      handleTool(() =>
        client.post(`/service/${service_id}/private-network/${net_id}/method`, { method })
      )
  );
}
