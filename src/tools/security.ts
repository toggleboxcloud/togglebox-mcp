import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ToggleboxClient } from "../client.js";
import { handleTool, handlePagedTool, serviceId, vmParams, pageParam, buildPageParams } from "./helpers.js";

export function register(server: McpServer, client: ToggleboxClient) {
  server.registerTool(
    "list_security_groups",
    {
      description: "List all available security groups (firewall rule sets) for a cloud service",
      inputSchema: { ...serviceId, ...pageParam },
      annotations: { readOnlyHint: true },
    },
    async ({ service_id, page, all_pages }) =>
      handlePagedTool(
        (requestedPage) => client.getFull(`/service/${service_id}/security-groups`, buildPageParams(requestedPage)),
        { page, allPages: all_pages }
      )
  );

  server.registerTool(
    "get_security_group",
    {
      description: "Get details of a specific security group including its rules",
      inputSchema: {
        ...serviceId,
        sg_id: z.number().int().min(1).describe("The security group ID"),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ service_id, sg_id }) =>
      handleTool(() => client.get(`/service/${service_id}/security-group/${sg_id}`))
  );

  server.registerTool(
    "get_vm_security_groups",
    {
      description: "Get security groups currently attached to a virtual machine",
      inputSchema: { ...vmParams },
      annotations: { readOnlyHint: true },
    },
    async ({ service_id, vm_id }) =>
      handleTool(() => client.get(`/service/${service_id}/vm/${vm_id}/security-groups`))
  );

  server.registerTool(
    "attach_security_group",
    {
      description: "Attach a security group to a virtual machine's network interface",
      inputSchema: {
        ...vmParams,
        sg_id: z.number().int().min(0).describe("The security group ID to attach"),
        nic_id: z.number().int().min(0).describe("The NIC ID to attach the security group to"),
      },
      annotations: { readOnlyHint: false },
    },
    async ({ service_id, vm_id, sg_id, nic_id }) =>
      handleTool(() =>
        client.post(`/service/${service_id}/vm/${vm_id}/security-groups/attach`, {
          sg_id,
          nic_id,
        })
      )
  );

  server.registerTool(
    "detach_security_group",
    {
      description: "Detach a security group from a virtual machine's network interface",
      inputSchema: {
        ...vmParams,
        sg_id: z.number().int().min(0).describe("The security group ID to detach"),
        nic_id: z.number().int().min(0).describe("The NIC ID to detach the security group from"),
      },
      annotations: { readOnlyHint: false },
    },
    async ({ service_id, vm_id, sg_id, nic_id }) =>
      handleTool(() =>
        client.post(`/service/${service_id}/vm/${vm_id}/security-groups/detach`, {
          sg_id,
          nic_id,
        })
      )
  );
}
