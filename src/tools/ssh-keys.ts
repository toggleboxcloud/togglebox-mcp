import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ToggleboxClient } from "../client.js";
import { handleTool, handlePagedTool, serviceId, vmParams, pageParam, buildPageParams } from "./helpers.js";

export function register(server: McpServer, client: ToggleboxClient) {
  server.registerTool(
    "list_ssh_keys",
    {
      description: "List all registered SSH public keys for a cloud service",
      inputSchema: { ...serviceId, ...pageParam },
      annotations: { readOnlyHint: true },
    },
    async ({ service_id, page, all_pages }) =>
      handlePagedTool(
        (requestedPage) => client.getFull(`/service/${service_id}/ssh-keys`, buildPageParams(requestedPage)),
        { page, allPages: all_pages }
      )
  );

  server.registerTool(
    "add_ssh_key",
    {
      description: "Register a new SSH public key that can be installed on virtual machines",
      inputSchema: {
        ...serviceId,
        name: z.string().describe("A label for this SSH key"),
        public_key: z.string().describe("The SSH public key content (e.g. ssh-ed25519 AAAA...)"),
      },
      annotations: { readOnlyHint: false },
    },
    async ({ service_id, name, public_key }) =>
      handleTool(() => client.post(`/service/${service_id}/ssh-keys`, { name, public_key }))
  );

  server.registerTool(
    "delete_ssh_key",
    {
      description: "Delete a registered SSH public key from a cloud service",
      inputSchema: {
        ...serviceId,
        name: z.string().describe("The name/label of the SSH key to delete"),
      },
      annotations: { readOnlyHint: false },
    },
    async ({ service_id, name }) =>
      handleTool(() => client.post(`/service/${service_id}/ssh-keys/delete`, { name }))
  );

  server.registerTool(
    "install_ssh_key",
    {
      description: "Install a saved or pasted SSH key onto a virtual machine",
      inputSchema: {
        ...vmParams,
        name: z.string().optional().describe("Name/label of a saved SSH key to install"),
        public_key: z.string().optional().describe("SSH public key content to install directly"),
        save: z.number().int().min(0).max(1).optional().describe("1 to save public_key before installing"),
        save_name: z.string().optional().describe("Name to use when saving public_key"),
      },
      annotations: { readOnlyHint: false },
    },
    async ({ service_id, vm_id, name, public_key, save, save_name }) => {
      if (!name && !public_key) {
        return { content: [{ type: "text" as const, text: "Either name or public_key must be provided" }], isError: true as const };
      }

      return handleTool(() =>
        client.post(`/service/${service_id}/vm/${vm_id}/ssh-keys/install`, {
          ...(name !== undefined && { name }),
          ...(public_key !== undefined && { public_key }),
          ...(save !== undefined && { save }),
          ...(save_name !== undefined && { save_name }),
        })
      );
    }
  );
}
