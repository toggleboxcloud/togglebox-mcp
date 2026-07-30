import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ToggleboxClient } from "../client.js";
import { handleTool, handlePagedTool, vmParams, booleanFlag, pageParam, buildPageParams } from "./helpers.js";

export function register(server: McpServer, client: ToggleboxClient) {
  server.registerTool(
    "list_backups",
    {
      description: "List all backups for a virtual machine",
      inputSchema: { ...vmParams, ...pageParam },
      annotations: { readOnlyHint: true },
    },
    async ({ service_id, vm_id, page, all_pages }) =>
      handlePagedTool(
        (requestedPage) => client.getFull(`/service/${service_id}/vm/${vm_id}/backups`, buildPageParams(requestedPage)),
        { page, allPages: all_pages }
      )
  );

  server.registerTool(
    "create_backup",
    {
      description: "Create a backup of a virtual machine disk",
      inputSchema: {
        ...vmParams,
        disk_id: z.number().int().min(0).describe("The disk ID to back up"),
        backup_name: z.string().describe("Backup name"),
      },
      annotations: { readOnlyHint: false },
    },
    async ({ service_id, vm_id, disk_id, backup_name }) =>
      handleTool(() =>
        client.post(`/service/${service_id}/vm/${vm_id}/backups`, { disk_id, name: backup_name })
      )
  );

  server.registerTool(
    "create_all_disks_backup",
    {
      description: "Create a backup of all disks on a virtual machine at once",
      inputSchema: {
        ...vmParams,
        backup_name: z.string().describe("Backup name"),
      },
      annotations: { readOnlyHint: false, destructiveHint: true },
    },
    async ({ service_id, vm_id, backup_name }) =>
      handleTool(() =>
        client.post(`/service/${service_id}/vm/${vm_id}/backups/all-disks`, { name: backup_name })
      )
  );

  server.registerTool(
    "restore_backup",
    {
      description: "Restore a virtual machine disk to a previous backup. This will overwrite the disk's current state.",
      inputSchema: {
        ...vmParams,
        backup_id: z.number().int().min(0).describe("The backup ID to restore"),
        disk_id: z.number().int().min(0).describe("The disk ID this backup belongs to"),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
      },
    },
    async ({ service_id, vm_id, backup_id, disk_id }) =>
      handleTool(() =>
        client.post(`/service/${service_id}/vm/${vm_id}/backups/${backup_id}/restore`, { disk_id })
      )
  );

  server.registerTool(
    "delete_backup",
    {
      description: "Permanently delete a backup. This action is irreversible.",
      inputSchema: {
        ...vmParams,
        backup_id: z.number().int().min(0).describe("The backup ID to delete"),
        disk_id: z.number().int().min(0).describe("The disk ID this backup belongs to"),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
      },
    },
    async ({ service_id, vm_id, backup_id, disk_id }) =>
      handleTool(() =>
        client.post(`/service/${service_id}/vm/${vm_id}/backups/${backup_id}/delete`, { disk_id })
      )
  );

  server.registerTool(
    "save_backup_as_volume",
    {
      description: "Save a disk backup as a standalone storage volume",
      inputSchema: {
        ...vmParams,
        backup_id: z.number().int().min(0).describe("The backup ID to save as a volume"),
        disk_id: z.number().int().min(0).describe("The disk ID this backup belongs to"),
        name: z.string().describe("Name for the new volume"),
        volume_type: z.string().optional().describe("Volume type (e.g. DATABLOCK, OS)"),
        persistent: booleanFlag.optional().describe("1 to make the volume persistent"),
        target_datastore_id: z.number().int().optional().describe("Target datastore ID (-1 for default)"),
      },
      annotations: { readOnlyHint: false, destructiveHint: true },
    },
    async ({ service_id, vm_id, backup_id, disk_id, name, volume_type, persistent, target_datastore_id }) =>
      handleTool(() =>
        client.post(`/service/${service_id}/vm/${vm_id}/backups/${backup_id}/save-as-volume`, {
          disk_id,
          name,
          ...(volume_type !== undefined && { volume_type }),
          ...(persistent !== undefined && { persistent }),
          ...(target_datastore_id !== undefined && { target_datastore_id }),
        })
      )
  );

  server.registerTool(
    "draas_storage_backup_save_as_volume",
    {
      description: "Save a DRaaS Storage backup as a standalone storage volume",
      inputSchema: {
        ...vmParams,
        backup_name: z.string().describe("The DRaaS Storage backup name"),
        name: z.string().describe("Name for the new volume"),
        volume_type: z.string().describe("Volume type (e.g. DATABLOCK)"),
        persistent: booleanFlag.describe("1 to make the volume persistent"),
      },
      annotations: { readOnlyHint: false, destructiveHint: true },
    },
    async ({ service_id, vm_id, backup_name, name, volume_type, persistent }) =>
      handleTool(() =>
        client.post(`/service/${service_id}/vm/${vm_id}/draas-storage/backups/save-as-volume`, {
          backup_name, name, volume_type, persistent,
        })
      )
  );

  server.registerTool(
    "draas_storage_backup_restore_disk",
    {
      description: "Restore a DRaaS Storage backup to a VM disk",
      inputSchema: {
        ...vmParams,
        backup_name: z.string().describe("The DRaaS Storage backup name"),
        disk_id: z.number().int().min(0).describe("Target disk ID on the VM"),
        backup_disk_id: z.number().int().min(0).describe("Source disk ID from the backup"),
        volume_name: z.string().describe("Name for the restore volume"),
      },
      annotations: { readOnlyHint: false, destructiveHint: true },
    },
    async ({ service_id, vm_id, backup_name, disk_id, backup_disk_id, volume_name }) =>
      handleTool(() =>
        client.post(`/service/${service_id}/vm/${vm_id}/draas-storage/backups/restore-disk`, {
          backup_name, disk_id, backup_disk_id, volume_name,
        })
      )
  );
}
