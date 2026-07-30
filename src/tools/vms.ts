import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ToggleboxClient } from "../client.js";
import { handleTool, handlePagedTool, serviceId, vmParams, summarizeList, booleanFlag, pageParam, buildPageParams } from "./helpers.js";

export function register(server: McpServer, client: ToggleboxClient) {
  server.registerTool(
    "list_vms",
    {
      description: "List all virtual machines for a cloud service",
      inputSchema: { ...serviceId, ...pageParam },
      annotations: { readOnlyHint: true },
    },
    async ({ service_id, page, all_pages }) => {
      const VM_FIELDS = [
        "id", "hostname", "state", "STATE", "LCM_STATE_STR",
        "cpu", "memory", "disk", "ips", "power", "tags",
      ];
      return handlePagedTool(
        (requestedPage) => client.getFull(`/service/${service_id}/vms`, buildPageParams(requestedPage)),
        { page, allPages: all_pages, transform: (data) => summarizeList(data, "vms", VM_FIELDS) }
      );
    }
  );

  server.registerTool(
    "get_vm",
    {
      description: "Get detailed information about a specific virtual machine including CPU, RAM, disks, and network interfaces",
      inputSchema: { ...vmParams },
      annotations: { readOnlyHint: true },
    },
    async ({ service_id, vm_id }) =>
      handleTool(() => client.get(`/service/${service_id}/vm/${vm_id}`))
  );

  server.registerTool(
    "get_vm_status",
    {
      description: "Get the current power state and resource usage of a virtual machine",
      inputSchema: { ...vmParams },
      annotations: { readOnlyHint: true },
    },
    async ({ service_id, vm_id }) =>
      handleTool(() => client.get(`/service/${service_id}/vm/${vm_id}/status`))
  );

  server.registerTool(
    "get_vm_tags",
    {
      description: "Get the tags assigned to a virtual machine",
      inputSchema: { ...vmParams },
      annotations: { readOnlyHint: true },
    },
    async ({ service_id, vm_id }) =>
      handleTool(() => client.get(`/service/${service_id}/vm/${vm_id}/tags`))
  );

  server.registerTool(
    "create_vm",
    {
      description: "Create a new virtual machine. This is a queued operation — poll operation_status after calling.",
      inputSchema: {
        ...serviceId,
        hostname: z.string().describe("Hostname for the new VM"),
        template_id: z.number().int().min(1).describe("OS template ID to use"),
        cpu: z.number().int().min(1).describe("Number of vCPUs"),
        memory: z.number().int().min(1).optional().describe("Memory in GB"),
        memory_gb: z.number().int().min(1).optional().describe("Memory in GB (alias for memory)"),
        ram: z.number().int().min(1).optional().describe("Deprecated: RAM in MB; converted to memory GB"),
        primary_disk_size: z.number().int().min(1).optional().describe("Primary disk size in GB"),
        disk_size: z.number().int().min(1).optional().describe("Deprecated: primary disk size in GB"),
        network_ids: z.array(z.number().int().min(0)).optional().describe("Network IDs to attach, in preferred order"),
        primary_network_id: z.number().int().min(0).optional().describe("Primary network ID; defaults to the first network_ids entry"),
        sshkey: z.string().optional().describe("SSH public key to inject into the VM"),
        sshkey_save: booleanFlag.optional().describe("1 to save sshkey to the service account"),
        sshkey_name: z.string().optional().describe("Name to use when saving sshkey"),
        volumecare_policy: z.string().optional().describe("Optional VolumeCare policy name"),
      },
      annotations: { readOnlyHint: false },
    },
    async ({
      service_id,
      hostname,
      template_id,
      cpu,
      memory,
      memory_gb,
      ram,
      primary_disk_size,
      disk_size,
      network_ids,
      primary_network_id,
      sshkey,
      sshkey_save,
      sshkey_name,
      volumecare_policy,
    }) => {
      const memoryGb = memory ?? memory_gb ?? (ram !== undefined ? Math.ceil(ram / 1024) : undefined);
      const primaryDiskSize = primary_disk_size ?? disk_size;
      if (memoryGb === undefined || primaryDiskSize === undefined) {
        return {
          content: [{ type: "text" as const, text: "Both memory and primary_disk_size are required" }],
          isError: true as const,
        };
      }

      return handleTool(() =>
        client.post(`/service/${service_id}/vms`, {
          hostname,
          template_id,
          cpu,
          memory: memoryGb,
          primary_disk_size: primaryDiskSize,
          ...(network_ids !== undefined && { network_ids }),
          ...(primary_network_id !== undefined && { primary_network_id }),
          ...(sshkey !== undefined && { sshkey }),
          ...(sshkey_save !== undefined && { sshkey_save }),
          ...(sshkey_name !== undefined && { sshkey_name }),
          ...(volumecare_policy !== undefined && { volumecare_policy }),
        })
      );
    }
  );

  server.registerTool(
    "resize_vm",
    {
      description: "Resize a virtual machine's CPU and/or RAM. The VM may need to be powered off first.",
      inputSchema: {
        ...vmParams,
        cpu: z.number().int().min(1).optional().describe("New number of vCPUs"),
        memory_mb: z.number().int().min(1).optional().describe("New memory in MB"),
        memory_gb: z.number().int().min(1).optional().describe("New memory in GB"),
        ram: z.number().int().min(1).optional().describe("Deprecated: new memory in MB"),
      },
      annotations: { readOnlyHint: false },
    },
    async ({ service_id, vm_id, cpu, memory_mb, memory_gb, ram }) => {
      const memoryMb = memory_mb ?? ram ?? (memory_gb !== undefined ? memory_gb * 1024 : undefined);
      if (cpu === undefined && memoryMb === undefined) {
        return { content: [{ type: "text" as const, text: "At least one of cpu, memory_mb, or memory_gb must be provided" }], isError: true as const };
      }
      return handleTool(() =>
        client.post(`/service/${service_id}/vm/${vm_id}/resize`, {
          ...(cpu !== undefined && { cpu }),
          ...(memoryMb !== undefined && { memory_mb: memoryMb }),
        })
      );
    }
  );

  server.registerTool(
    "change_vm_hostname",
    {
      description: "Change the hostname of a virtual machine",
      inputSchema: {
        ...vmParams,
        hostname: z.string().describe("New hostname for the VM"),
      },
      annotations: { readOnlyHint: false },
    },
    async ({ service_id, vm_id, hostname }) =>
      handleTool(() =>
        client.post(`/service/${service_id}/vm/${vm_id}/hostname`, { hostname })
      )
  );

  server.registerTool(
    "update_vm_tags",
    {
      description: "Update the tags assigned to a virtual machine",
      inputSchema: {
        ...vmParams,
        tags: z.array(z.string()).describe("Array of tag strings to assign to the VM"),
      },
      annotations: { readOnlyHint: false },
    },
    async ({ service_id, vm_id, tags }) =>
      handleTool(() =>
        client.post(`/service/${service_id}/vm/${vm_id}/tags`, { tags })
      )
  );

  server.registerTool(
    "clone_vm",
    {
      description: "Clone a virtual machine to create a new copy. This is a queued, destructive operation.",
      inputSchema: {
        ...vmParams,
        name: z.string().describe("Hostname for the cloned VM"),
        stop: booleanFlag.optional().describe("1 to stop the source VM before cloning"),
      },
      annotations: { readOnlyHint: false, destructiveHint: true },
    },
    async ({ service_id, vm_id, name, stop }) =>
      handleTool(() =>
        client.post(`/service/${service_id}/vm/${vm_id}/clone`, {
          name,
          ...(stop !== undefined && { stop }),
        })
      )
  );

  server.registerTool(
    "reset_vm_password",
    {
      description: "Reset the root password of a virtual machine. This is a destructive operation that modifies VM state.",
      inputSchema: { ...vmParams },
      annotations: { readOnlyHint: false, destructiveHint: true },
    },
    async ({ service_id, vm_id }) =>
      handleTool(() => client.post(`/service/${service_id}/vm/${vm_id}/password/reset`))
  );

  server.registerTool(
    "reinstall_vm",
    {
      description: "Reinstall a virtual machine from a template. This is a destructive operation — all data on the VM will be lost.",
      inputSchema: {
        ...vmParams,
        template_id: z.number().int().min(1).describe("OS template ID to reinstall from"),
      },
      annotations: { readOnlyHint: false, destructiveHint: true },
    },
    async ({ service_id, vm_id, template_id }) =>
      handleTool(() =>
        client.post(`/service/${service_id}/vm/${vm_id}/reinstall`, { template_id })
      )
  );

  server.registerTool(
    "destroy_vm",
    {
      description: "Permanently destroy a virtual machine. This action is irreversible — all data on the VM will be lost.",
      inputSchema: {
        ...vmParams,
        confirm: z.string().describe("The hostname of the VM to confirm destruction"),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
      },
    },
    async ({ service_id, vm_id, confirm }) =>
      handleTool(() => client.post(`/service/${service_id}/vm/${vm_id}/destroy`, { confirm }))
  );
}
