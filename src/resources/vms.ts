import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ToggleboxClient } from "../client.js";
import { jsonResource, requireId } from "./helpers.js";

export function register(server: McpServer, client: ToggleboxClient) {
  server.registerResource(
    "vms",
    new ResourceTemplate("togglebox://service/{service_id}/vms", { list: undefined }),
    {
      description: "First page of VMs for a cloud service. Use list_vms tool for full paginated listing.",
      mimeType: "application/json",
    },
    async (uri, { service_id }) => {
      const id = requireId(service_id, "service_id");
      const data = await client.get(`/service/${id}/vms`, { page: "1" });
      return jsonResource(uri, data);
    }
  );

  server.registerResource(
    "vm",
    new ResourceTemplate("togglebox://service/{service_id}/vm/{vm_id}", { list: undefined }),
    {
      description: "Full state of a single virtual machine including status, specs, and disks",
      mimeType: "application/json",
    },
    async (uri, { service_id, vm_id }) => {
      const serviceId = requireId(service_id, "service_id");
      const vmId = requireId(vm_id, "vm_id");
      const data = await client.get(`/service/${serviceId}/vm/${vmId}`);
      return jsonResource(uri, data);
    }
  );
}
