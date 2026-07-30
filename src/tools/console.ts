import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ToggleboxClient } from "../client.js";
import { handleTool, vmParams } from "./helpers.js";

export function register(server: McpServer, client: ToggleboxClient) {
  server.registerTool(
    "get_console",
    {
      description: "Get console access information (VNC/noVNC URL) for a virtual machine",
      inputSchema: { ...vmParams },
      annotations: { readOnlyHint: true },
    },
    async ({ service_id, vm_id }) =>
      handleTool(() => client.get(`/service/${service_id}/vm/${vm_id}/console`))
  );
}
