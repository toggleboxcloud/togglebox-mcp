import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ToggleboxClient } from "../client.js";
import { handleTool, vmParams, booleanFlag } from "./helpers.js";

export function register(server: McpServer, client: ToggleboxClient) {
  server.registerTool(
    "attach_iso",
    {
      description: "Attach an ISO image to a virtual machine as a virtual CD-ROM drive",
      inputSchema: {
        ...vmParams,
        iso_id: z.number().int().min(0).describe("The ISO ID to attach"),
        set_as_boot: booleanFlag.optional().describe("1 to set the ISO as the boot device"),
      },
      annotations: { readOnlyHint: false, destructiveHint: true },
    },
    async ({ service_id, vm_id, iso_id, set_as_boot }) =>
      handleTool(() =>
        client.post(`/service/${service_id}/vm/${vm_id}/iso/attach`, {
          iso_id,
          ...(set_as_boot !== undefined && { set_as_boot }),
        })
      )
  );

  server.registerTool(
    "detach_iso",
    {
      description: "Detach an ISO image (virtual CD-ROM) from a virtual machine",
      inputSchema: {
        ...vmParams,
        disk_id: z.number().int().min(0).describe("The disk ID of the attached ISO to detach"),
      },
      annotations: { readOnlyHint: false, destructiveHint: true },
    },
    async ({ service_id, vm_id, disk_id }) =>
      handleTool(() =>
        client.post(`/service/${service_id}/vm/${vm_id}/iso/detach`, { disk_id })
      )
  );
}
