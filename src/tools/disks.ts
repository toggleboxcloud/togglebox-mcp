import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ToggleboxClient } from "../client.js";
import { handleTool, handlePagedTool, vmParams, diskParams, booleanFlag, pageParam, buildPageParams } from "./helpers.js";

export function register(server: McpServer, client: ToggleboxClient) {
  server.registerTool(
    "list_disks",
    {
      description: "List all disks attached to a virtual machine",
      inputSchema: { ...vmParams, ...pageParam },
      annotations: { readOnlyHint: true },
    },
    async ({ service_id, vm_id, page, all_pages }) =>
      handlePagedTool(
        (requestedPage) => client.getFull(`/service/${service_id}/vm/${vm_id}/disks`, buildPageParams(requestedPage)),
        { page, allPages: all_pages }
      )
  );

  server.registerTool(
    "add_disk",
    {
      description: "Add a new disk to a virtual machine",
      inputSchema: {
        ...vmParams,
        disk_size: z.number().int().min(1).optional().describe("Disk size in GB"),
        size: z.number().int().min(1).optional().describe("Deprecated: disk size in GB"),
        disk_name: z.string().optional().describe("Optional disk name"),
        datastore_id: z.number().int().optional().describe("Target datastore ID (-1 for default)"),
        volume_type: z.string().optional().describe("Volume type (default: DATABLOCK)"),
      },
      annotations: { readOnlyHint: false },
    },
    async ({ service_id, vm_id, disk_size, size, disk_name, datastore_id, volume_type }) => {
      const diskSize = disk_size ?? size;
      if (diskSize === undefined) {
        return { content: [{ type: "text" as const, text: "disk_size is required" }], isError: true as const };
      }

      return handleTool(() =>
        client.post(`/service/${service_id}/vm/${vm_id}/disks`, {
          disk_size: diskSize,
          ...(disk_name !== undefined && { disk_name }),
          ...(datastore_id !== undefined && { datastore_id }),
          ...(volume_type !== undefined && { volume_type }),
        })
      );
    }
  );

  server.registerTool(
    "resize_disk",
    {
      description: "Resize an existing disk on a virtual machine. Disks can only be enlarged, not shrunk.",
      inputSchema: {
        ...vmParams,
        disk_id: z.number().int().min(0).describe("The disk ID to resize"),
        size_gb: z.number().int().min(1).optional().describe("New disk size in GB (must be larger than current)"),
        size: z.number().int().min(1).optional().describe("Deprecated: new disk size in GB"),
      },
      annotations: { readOnlyHint: false },
    },
    async ({ service_id, vm_id, disk_id, size_gb, size }) => {
      const newSizeGb = size_gb ?? size;
      if (newSizeGb === undefined) {
        return { content: [{ type: "text" as const, text: "size_gb is required" }], isError: true as const };
      }

      return handleTool(() =>
        client.post(`/service/${service_id}/vm/${vm_id}/disks/${disk_id}/resize`, { size_gb: newSizeGb })
      );
    }
  );

  server.registerTool(
    "detach_disk",
    {
      description: "Detach a disk from a virtual machine. The disk data is preserved as a volume.",
      inputSchema: { ...diskParams },
      annotations: { readOnlyHint: false, destructiveHint: true },
    },
    async ({ service_id, vm_id, disk_id }) =>
      handleTool(() => client.post(`/service/${service_id}/vm/${vm_id}/disks/${disk_id}/detach`))
  );

  server.registerTool(
    "delete_disk",
    {
      description: "Permanently delete a disk from a virtual machine. This action is irreversible — all data on the disk will be lost.",
      inputSchema: { ...diskParams },
      annotations: { readOnlyHint: false, destructiveHint: true },
    },
    async ({ service_id, vm_id, disk_id }) =>
      handleTool(() => client.post(`/service/${service_id}/vm/${vm_id}/disks/${disk_id}/delete`))
  );

  server.registerTool(
    "set_boot_disk",
    {
      description: "Set a disk as the boot disk for a virtual machine",
      inputSchema: { ...diskParams },
      annotations: { readOnlyHint: false, destructiveHint: true },
    },
    async ({ service_id, vm_id, disk_id }) =>
      handleTool(() => client.post(`/service/${service_id}/vm/${vm_id}/disks/${disk_id}/set-boot`))
  );

  server.registerTool(
    "save_disk_as_volume",
    {
      description: "Save a VM disk as a standalone storage volume",
      inputSchema: {
        ...diskParams,
        name: z.string().describe("Name for the new volume"),
        volume_type: z.string().describe("Volume type (e.g. DATABLOCK, OS)"),
        persistent: booleanFlag.describe("1 to make the volume persistent, 0 for non-persistent"),
        target_datastore_id: z.number().int().optional().describe("Target datastore ID (-1 for default)"),
      },
      annotations: { readOnlyHint: false, destructiveHint: true },
    },
    async ({ service_id, vm_id, disk_id, name, volume_type, persistent, target_datastore_id }) =>
      handleTool(() =>
        client.post(`/service/${service_id}/vm/${vm_id}/disks/${disk_id}/save-as-volume`, {
          name,
          volume_type,
          persistent,
          ...(target_datastore_id !== undefined && { target_datastore_id }),
        })
      )
  );
}
