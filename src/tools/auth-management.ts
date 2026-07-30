import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ToggleboxClient } from "../client.js";
import { handleTool } from "./helpers.js";

export function register(server: McpServer, client: ToggleboxClient) {
  server.registerTool(
    "list_personal_access_tokens",
    {
      description: "List personal access tokens for the authenticated Togglebox account",
      inputSchema: {},
      annotations: { readOnlyHint: true },
    },
    async () => handleTool(() => client.get("/tokens"))
  );

  server.registerTool(
    "create_personal_access_token",
    {
      description: "Create a new Togglebox personal access token. This is rejected when authenticated with an existing PAT.",
      inputSchema: {
        name: z.string().min(1).describe("Token name, e.g. MCP Client"),
        expires_at: z.string().optional().describe("Optional expiration date or datetime, e.g. 2026-12-31"),
        scopes: z.string().optional().describe("Optional future-use scope string"),
      },
      annotations: { readOnlyHint: false },
    },
    async ({ name, expires_at, scopes }) =>
      handleTool(() =>
        client.post("/tokens", {
          name,
          ...(expires_at !== undefined && { expires_at }),
          ...(scopes !== undefined && { scopes }),
        })
      )
  );

  server.registerTool(
    "revoke_personal_access_token",
    {
      description: "Revoke a personal access token owned by the authenticated Togglebox account",
      inputSchema: {
        token_id: z.number().int().min(1).describe("Personal access token ID"),
      },
      annotations: { readOnlyHint: false, destructiveHint: true },
    },
    async ({ token_id }) => handleTool(() => client.del(`/tokens/${token_id}`))
  );

  server.registerTool(
    "logout_current_session",
    {
      description: "Invalidate the current Togglebox API session. If authenticated by PAT, this revokes the current PAT.",
      inputSchema: {},
      annotations: { readOnlyHint: false, destructiveHint: true },
    },
    async () => handleTool(() => client.post("/logout"))
  );

  server.registerTool(
    "revoke_current_auth_token",
    {
      description: "Invalidate the current Togglebox API token, or revoke a supplied refresh token",
      inputSchema: {
        refresh_token: z.string().optional().describe("Optional refresh token to revoke instead of the current token"),
      },
      annotations: { readOnlyHint: false, destructiveHint: true },
    },
    async ({ refresh_token }) =>
      handleTool(() =>
        client.post("/revoke", {
          ...(refresh_token !== undefined && { refresh_token }),
        })
      )
  );
}
