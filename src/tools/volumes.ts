import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ToggleboxClient } from "../client.js";
import { handleTool, handlePagedTool, serviceId, volumeParams, booleanFlag, pageParam, buildPageParams } from "./helpers.js";

export function register(server: McpServer, client: ToggleboxClient) {
  server.registerTool(
    "list_volumes",
    {
      description: "List all storage volumes for a cloud service",
      inputSchema: { ...serviceId, ...pageParam },
      annotations: { readOnlyHint: true },
    },
    async ({ service_id, page, all_pages }) =>
      handlePagedTool(
        (requestedPage) => client.getFull(`/service/${service_id}/volumes`, buildPageParams(requestedPage)),
        { page, allPages: all_pages }
      )
  );

  server.registerTool(
    "get_volume",
    {
      description: "Get detailed information about a specific storage volume",
      inputSchema: { ...volumeParams },
      annotations: { readOnlyHint: true },
    },
    async ({ service_id, volume_id }) =>
      handleTool(() => client.get(`/service/${service_id}/volume/${volume_id}`))
  );

  server.registerTool(
    "create_volume",
    {
      description: "Create a new storage volume",
      inputSchema: {
        ...serviceId,
        name: z.string().describe("Volume name"),
        size_gb: z.number().int().min(1).optional().describe("Volume size in GB"),
        size: z.number().int().min(1).optional().describe("Deprecated: volume size in GB"),
        type: z.string().optional().describe("Volume type (OS, CDROM, or DATABLOCK; default: DATABLOCK)"),
        persistent: booleanFlag.optional().describe("1 to make persistent, 0 for non-persistent"),
        datastore_id: z.number().int().optional().describe("Target datastore ID (-1 for default)"),
      },
      annotations: { readOnlyHint: false },
    },
    async ({ service_id, name, size_gb, size, type, persistent, datastore_id }) => {
      const volumeSizeGb = size_gb ?? size;
      if (volumeSizeGb === undefined) {
        return { content: [{ type: "text" as const, text: "size_gb is required" }], isError: true as const };
      }

      return handleTool(() =>
        client.post(`/service/${service_id}/volumes`, {
          name,
          size_gb: volumeSizeGb,
          ...(type !== undefined && { type }),
          ...(persistent !== undefined && { persistent }),
          ...(datastore_id !== undefined && { datastore_id }),
        })
      );
    }
  );

  server.registerTool(
    "delete_volume",
    {
      description: "Permanently delete a storage volume. This action is irreversible — all data on the volume will be lost.",
      inputSchema: { ...volumeParams },
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
      },
    },
    async ({ service_id, volume_id }) =>
      handleTool(() => client.post(`/service/${service_id}/volume/${volume_id}/delete`))
  );

  server.registerTool(
    "attach_volume",
    {
      description: "Attach a storage volume to a virtual machine",
      inputSchema: {
        ...volumeParams,
        vm_id: z.number().int().min(1).describe("The virtual machine ID to attach to"),
      },
      annotations: { readOnlyHint: false },
    },
    async ({ service_id, volume_id, vm_id }) =>
      handleTool(() => client.post(`/service/${service_id}/volume/${volume_id}/attach`, { vm_id }))
  );

  server.registerTool(
    "rename_volume",
    {
      description: "Rename a storage volume",
      inputSchema: {
        ...volumeParams,
        name: z.string().describe("New name for the volume"),
      },
      annotations: { readOnlyHint: false },
    },
    async ({ service_id, volume_id, name }) =>
      handleTool(() => client.post(`/service/${service_id}/volume/${volume_id}/rename`, { name }))
  );

  server.registerTool(
    "clone_volume",
    {
      description: "Clone a storage volume to create a new copy",
      inputSchema: {
        ...volumeParams,
        name: z.string().describe("Name for the cloned volume"),
        datastore_id: z.number().int().optional().describe("Target datastore ID (-1 for default)"),
        persistent: booleanFlag.optional().describe("1 to make the clone persistent"),
        type: z.string().optional().describe("Image type for the clone (e.g. DATABLOCK)"),
      },
      annotations: { readOnlyHint: false },
    },
    async ({ service_id, volume_id, name, datastore_id, persistent, type }) =>
      handleTool(() =>
        client.post(`/service/${service_id}/volume/${volume_id}/clone`, {
          name,
          ...(datastore_id !== undefined && { datastore_id }),
          ...(persistent !== undefined && { persistent }),
          ...(type !== undefined && { type }),
        })
      )
  );

  server.registerTool(
    "toggle_volume_persistent",
    {
      description: "Toggle whether a storage volume is persistent (survives VM deletion) or non-persistent",
      inputSchema: {
        ...volumeParams,
        persistent: booleanFlag.describe("1 to make persistent, 0 to make non-persistent"),
      },
      annotations: { readOnlyHint: false },
    },
    async ({ service_id, volume_id, persistent }) =>
      handleTool(() =>
        client.post(`/service/${service_id}/volume/${volume_id}/toggle-persistent`, { persistent })
      )
  );

  server.registerTool(
    "change_volume_type",
    {
      description: "Change the image type of a storage volume (e.g. DATABLOCK, OS)",
      inputSchema: {
        ...volumeParams,
        type: z.string().describe("New image type (e.g. DATABLOCK, OS)"),
      },
      annotations: { readOnlyHint: false },
    },
    async ({ service_id, volume_id, type }) =>
      handleTool(() =>
        client.post(`/service/${service_id}/volume/${volume_id}/change-type`, { type })
      )
  );
}
