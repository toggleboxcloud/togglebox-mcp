import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ToggleboxClient } from "../client.js";
import { handleTool, handlePagedTool, pageParam, buildPageParams } from "./helpers.js";

export function register(server: McpServer, client: ToggleboxClient) {
  server.registerTool(
    "list_support_tickets",
    {
      description: "List all support tickets for the authenticated client",
      inputSchema: { ...pageParam },
      annotations: { readOnlyHint: true },
    },
    async ({ page, all_pages }) =>
      handlePagedTool(
        (requestedPage) => client.getFull("/tickets", buildPageParams(requestedPage)),
        { page, allPages: all_pages }
      )
  );

  server.registerTool(
    "get_support_ticket",
    {
      description: "Get a support ticket with its full message history",
      inputSchema: {
        ticket_id: z.number().int().min(1).describe("The ticket number"),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ ticket_id }) => handleTool(() => client.get(`/tickets/${ticket_id}`))
  );

  server.registerTool(
    "create_support_ticket",
    {
      description: "Create a new support ticket",
      inputSchema: {
        dept_id: z.number().int().min(1).optional().describe("The support department ID"),
        department_id: z.number().int().min(1).optional().describe("Deprecated: support department ID"),
        subject: z.string().describe("Ticket subject"),
        body: z.string().describe("Ticket message body"),
        priority: z.enum(["low", "medium", "high"]).optional().describe("Ticket priority"),
      },
      annotations: { readOnlyHint: false },
    },
    async ({ dept_id, department_id, subject, body, priority }) => {
      const departmentId = dept_id ?? department_id;
      if (departmentId === undefined) {
        return { content: [{ type: "text" as const, text: "dept_id is required" }], isError: true as const };
      }

      return handleTool(() =>
        client.post("/tickets", {
          dept_id: departmentId,
          subject,
          body,
          ...(priority !== undefined && { priority }),
        })
      );
    }
  );

  server.registerTool(
    "reply_support_ticket",
    {
      description: "Reply to an existing support ticket",
      inputSchema: {
        ticket_id: z.number().int().min(1).describe("The ticket number to reply to"),
        body: z.string().describe("Reply message body"),
      },
      annotations: { readOnlyHint: false },
    },
    async ({ ticket_id, body }) =>
      handleTool(() => client.post(`/tickets/${ticket_id}`, { body }))
  );
}
