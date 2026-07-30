import assert from "node:assert/strict";
import { test } from "node:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createServer } from "../dist/server.js";

test("server registers its core tools and resources", async () => {
  const server = createServer({});
  const client = new Client({ name: "registration-test", version: "1.0.0" });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

  await Promise.all([
    server.connect(serverTransport),
    client.connect(clientTransport),
  ]);

  try {
    const { tools } = await client.listTools();
    const toolNames = new Set(tools.map((tool) => tool.name));
    assert.ok(toolNames.has("list_vms"));
    assert.ok(toolNames.has("create_vm"));
    assert.ok(toolNames.has("list_services"));
    assert.ok(toolNames.has("get_checkmk_summary"));
    assert.ok(toolNames.has("create_checkmk_monitor"));
    assert.ok(toolNames.has("refresh_checkmk_monitor"));

    const listVms = tools.find((tool) => tool.name === "list_vms");
    assert.ok(listVms.inputSchema.properties.all_pages);

    const { resources } = await client.listResources();
    assert.deepEqual(resources.map((resource) => resource.uri).sort(), [
      "togglebox://account",
      "togglebox://services",
    ]);

    const { resourceTemplates } = await client.listResourceTemplates();
    const templates = new Set(resourceTemplates.map((resource) => resource.uriTemplate));
    assert.ok(templates.has("togglebox://service/{service_id}"));
    assert.ok(templates.has("togglebox://service/{service_id}/vms"));
    assert.ok(templates.has("togglebox://service/{service_id}/vm/{vm_id}"));
  } finally {
    await client.close();
    await server.close();
  }
});
