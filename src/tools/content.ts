import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ToggleboxClient } from "../client.js";
import { handleTool } from "./helpers.js";

function optionalNotificationParams(rel_type?: string, rel_id?: string): Record<string, string> {
  const params: Record<string, string> = {};
  if (rel_type !== undefined) params.rel_type = rel_type;
  if (rel_id !== undefined) params.rel_id = rel_id;
  return params;
}

export function register(server: McpServer, client: ToggleboxClient) {
  server.registerTool(
    "list_notifications",
    {
      description: "List portal notifications for the authenticated Togglebox account",
      inputSchema: {
        rel_type: z.string().optional().describe("Optional relation type filter"),
        rel_id: z.string().optional().describe("Optional relation ID filter"),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ rel_type, rel_id }) => handleTool(() => client.get("/notifications", optionalNotificationParams(rel_type, rel_id)))
  );

  server.registerTool(
    "list_new_notifications",
    {
      description: "List unread portal notifications for the authenticated Togglebox account",
      inputSchema: {
        rel_type: z.string().optional().describe("Optional relation type filter"),
        rel_id: z.string().optional().describe("Optional relation ID filter"),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ rel_type, rel_id }) =>
      handleTool(() => client.get("/notifications/new", optionalNotificationParams(rel_type, rel_id)))
  );

  server.registerTool(
    "acknowledge_notification",
    {
      description: "Mark a portal notification as read",
      inputSchema: {
        notification_id: z.number().int().min(1).describe("Notification ID"),
      },
      annotations: { readOnlyHint: false },
    },
    async ({ notification_id }) => handleTool(() => client.put(`/notifications/${notification_id}/ack`))
  );

  server.registerTool(
    "list_user_logs",
    {
      description: "List account history logs for the authenticated Togglebox account",
      inputSchema: {},
      annotations: { readOnlyHint: true },
    },
    async () => handleTool(() => client.get("/logs"))
  );

  server.registerTool(
    "list_news",
    {
      description: "List Togglebox news items",
      inputSchema: {},
      annotations: { readOnlyHint: true },
    },
    async () => handleTool(() => client.get("/news"))
  );

  server.registerTool(
    "get_news_item",
    {
      description: "Get a Togglebox news item",
      inputSchema: {
        news_id: z.number().int().min(1).describe("News item ID"),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ news_id }) => handleTool(() => client.get(`/news/${news_id}`))
  );

  server.registerTool(
    "list_knowledgebase_categories",
    {
      description: "List Togglebox knowledgebase categories",
      inputSchema: {},
      annotations: { readOnlyHint: true },
    },
    async () => handleTool(() => client.get("/knowledgebase"))
  );

  server.registerTool(
    "get_knowledgebase_category",
    {
      description: "Get a knowledgebase category with subcategories and articles",
      inputSchema: {
        category_id: z.number().int().min(1).describe("Knowledgebase category ID"),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ category_id }) => handleTool(() => client.get(`/knowledgebase/${category_id}`))
  );

  server.registerTool(
    "get_knowledgebase_article",
    {
      description: "Get a knowledgebase article",
      inputSchema: {
        article_id: z.number().int().min(1).describe("Knowledgebase article ID"),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ article_id }) => handleTool(() => client.get(`/knowledgebase/article/${article_id}`))
  );
}
