import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ToggleboxClient } from "../client.js";
import { handleTool, handlePagedTool, serviceId, vmParams, templateParams, booleanFlag, pageParam, buildPageParams } from "./helpers.js";

export function register(server: McpServer, client: ToggleboxClient) {
  server.registerTool(
    "list_templates",
    {
      description: "List available OS templates that can be used to create or reinstall virtual machines",
      inputSchema: { ...serviceId, ...pageParam },
      annotations: { readOnlyHint: true },
    },
    async ({ service_id, page, all_pages }) =>
      handlePagedTool(
        (requestedPage) => client.getFull(`/service/${service_id}/templates`, buildPageParams(requestedPage)),
        { page, allPages: all_pages }
      )
  );

  server.registerTool(
    "get_template",
    {
      description: "Get detailed information about a specific OS template",
      inputSchema: { ...templateParams },
      annotations: { readOnlyHint: true },
    },
    async ({ service_id, template_id }) =>
      handleTool(() => client.get(`/service/${service_id}/template/${template_id}`))
  );

  server.registerTool(
    "get_template_tags",
    {
      description: "Get the tags assigned to an OS template",
      inputSchema: { ...templateParams },
      annotations: { readOnlyHint: true },
    },
    async ({ service_id, template_id }) =>
      handleTool(() => client.get(`/service/${service_id}/template/${template_id}/tags`))
  );

  server.registerTool(
    "get_template_vms",
    {
      description: "List virtual machines that were created from a specific OS template",
      inputSchema: { ...templateParams, ...pageParam },
      annotations: { readOnlyHint: true },
    },
    async ({ service_id, template_id, page, all_pages }) =>
      handlePagedTool(
        (requestedPage) => client.getFull(
          `/service/${service_id}/template/${template_id}/vms`,
          buildPageParams(requestedPage)
        ),
        { page, allPages: all_pages }
      )
  );

  server.registerTool(
    "list_template_selector",
    {
      description: "Get the template selector index showing available templates grouped for VM creation",
      inputSchema: { ...serviceId, ...pageParam },
      annotations: { readOnlyHint: true },
    },
    async ({ service_id, page, all_pages }) =>
      handlePagedTool(
        (requestedPage) => client.getFull(
          `/service/${service_id}/template-selector`,
          buildPageParams(requestedPage)
        ),
        { page, allPages: all_pages }
      )
  );

  server.registerTool(
    "delete_template",
    {
      description: "Permanently delete an OS template. This action is irreversible.",
      inputSchema: { ...templateParams },
      annotations: { readOnlyHint: false, destructiveHint: true },
    },
    async ({ service_id, template_id }) =>
      handleTool(() => client.post(`/service/${service_id}/template/${template_id}/delete`))
  );

  server.registerTool(
    "rename_template",
    {
      description: "Rename an OS template",
      inputSchema: {
        ...templateParams,
        name: z.string().describe("New name for the template"),
      },
      annotations: { readOnlyHint: false },
    },
    async ({ service_id, template_id, name }) =>
      handleTool(() =>
        client.post(`/service/${service_id}/template/${template_id}/rename`, { name })
      )
  );

  server.registerTool(
    "update_template_tags",
    {
      description: "Update the tags assigned to an OS template",
      inputSchema: {
        ...templateParams,
        tags: z.string().describe("Tags string to assign to the template"),
      },
      annotations: { readOnlyHint: false },
    },
    async ({ service_id, template_id, tags }) =>
      handleTool(() =>
        client.post(`/service/${service_id}/template/${template_id}/tags`, { tags })
      )
  );

  server.registerTool(
    "save_vm_as_template",
    {
      description: "Save a virtual machine as a reusable OS template. This is a queued, destructive operation.",
      inputSchema: {
        ...vmParams,
        name: z.string().describe("Name for the new template"),
        stop: booleanFlag.optional().describe("1 to stop the VM before saving"),
      },
      annotations: { readOnlyHint: false, destructiveHint: true },
    },
    async ({ service_id, vm_id, name, stop }) =>
      handleTool(() =>
        client.post(`/service/${service_id}/vm/${vm_id}/template/save`, {
          name,
          ...(stop !== undefined && { stop }),
        })
      )
  );
}
