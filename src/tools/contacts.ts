import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ToggleboxClient } from "../client.js";
import { handleTool } from "./helpers.js";

const contactFields = z.record(z.unknown()).optional().describe("Additional Togglebox contact fields to submit as a flat object");
const privileges = z.record(z.unknown()).optional().describe("Contact privileges, in the shape returned by get_contact_privileges");

function contactBody(fields?: Record<string, unknown>, extra: Record<string, unknown> = {}): Record<string, unknown> {
  const body: Record<string, unknown> = { ...(fields ?? {}) };
  for (const [key, value] of Object.entries(extra)) {
    if (value !== undefined) body[key] = value;
  }
  return body;
}

export function register(server: McpServer, client: ToggleboxClient) {
  server.registerTool(
    "list_contacts",
    {
      description: "List contact profiles on the authenticated Togglebox account",
      inputSchema: {},
      annotations: { readOnlyHint: true },
    },
    async () => handleTool(() => client.get("/contact"))
  );

  server.registerTool(
    "get_contact",
    {
      description: "Get details for a Togglebox contact profile",
      inputSchema: {
        contact_id: z.number().int().min(1).describe("Contact ID"),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ contact_id }) => handleTool(() => client.get(`/contact/${contact_id}`))
  );

  server.registerTool(
    "get_contact_privileges",
    {
      description: "List possible contact privilege fields for the authenticated Togglebox account",
      inputSchema: {},
      annotations: { readOnlyHint: true },
    },
    async () => handleTool(() => client.get("/contact/privileges"))
  );

  server.registerTool(
    "create_contact",
    {
      description: "Create a Togglebox contact profile. Put account-specific contact fields in fields.",
      inputSchema: {
        fields: contactFields,
        email: z.string().email().optional().describe("Contact email address"),
        firstname: z.string().optional().describe("Contact first name"),
        lastname: z.string().optional().describe("Contact last name"),
        companyname: z.string().optional().describe("Optional company name"),
        password: z.string().optional().describe("Optional contact login password"),
        privileges,
      },
      annotations: { readOnlyHint: false },
    },
    async ({ fields, email, firstname, lastname, companyname, password, privileges }) =>
      handleTool(() =>
        client.post(
          "/contact",
          contactBody(fields, {
            email,
            firstname,
            lastname,
            companyname,
            password,
            privileges,
          })
        )
      )
  );

  server.registerTool(
    "update_contact",
    {
      description: "Update a Togglebox contact profile. Put account-specific contact fields in fields.",
      inputSchema: {
        contact_id: z.number().int().min(1).describe("Contact ID"),
        fields: contactFields,
        email: z.string().email().optional().describe("Contact email address"),
        firstname: z.string().optional().describe("Contact first name"),
        lastname: z.string().optional().describe("Contact last name"),
        companyname: z.string().optional().describe("Optional company name"),
        password: z.string().optional().describe("Optional new contact login password"),
        privileges,
      },
      annotations: { readOnlyHint: false },
    },
    async ({ contact_id, fields, email, firstname, lastname, companyname, password, privileges }) =>
      handleTool(() =>
        client.put(
          `/contact/${contact_id}`,
          contactBody(fields, {
            email,
            firstname,
            lastname,
            companyname,
            password,
            privileges,
          })
        )
      )
  );
}
