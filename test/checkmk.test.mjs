import assert from "node:assert/strict";
import { test } from "node:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createServer } from "../dist/server.js";

async function withServer(mockClient, fn) {
  const server = createServer(mockClient);
  const client = new Client({ name: "checkmk-test", version: "1.0.0" });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

  try {
    await fn(client);
  } finally {
    await client.close();
    await server.close();
  }
}

function resultJson(result) {
  assert.equal(result.isError, undefined);
  return JSON.parse(result.content[0].text);
}

function completeHttpSettings(response_time) {
  return {
    method: "GET",
    expected_codes: "200",
    content_search: "healthy",
    response_time,
    check_cert: true,
    ssl_expiry_warn_days: 40,
    ssl_expiry_crit_days: 20,
  };
}

test("Checkmk read tools use the module's public User API routes", async () => {
  const calls = [];
  const mockClient = {
    async get(path, params) {
      calls.push({ method: "GET", path, params });
      return { path, params };
    },
  };

  await withServer(mockClient, async (client) => {
    const monitor = await client.callTool({
      name: "get_checkmk_monitor",
      arguments: { service_id: 44, monitor_id: 7 },
    });
    assert.equal(resultJson(monitor).path, "/service/44/checkmk/monitors/7");

    const incidents = await client.callTool({
      name: "list_checkmk_incidents",
      arguments: { service_id: 44, monitor_id: 7, limit: 25 },
    });
    assert.deepEqual(resultJson(incidents), {
      path: "/service/44/checkmk/monitors/7/incidents",
      params: { limit: "25" },
    });
  });

  assert.deepEqual(calls, [
    { method: "GET", path: "/service/44/checkmk/monitors/7", params: undefined },
    { method: "GET", path: "/service/44/checkmk/monitors/7/incidents", params: { limit: "25" } },
  ]);
});

test("Checkmk mutation tools send nested definitions and bulk actions unchanged", async () => {
  const calls = [];
  const mockClient = {
    async post(path, body) {
      calls.push({ method: "POST", path, body });
      return { ok: true };
    },
  };

  await withServer(mockClient, async (client) => {
    const created = await client.callTool({
      name: "create_checkmk_monitor",
      arguments: {
        service_id: 44,
        definition: {
          name: "Website",
          type: "http",
          target: "https://example.com/health",
          interval: 60,
          timeout: 10,
          http: { method: "GET", expected_codes: "200:299", check_cert: true },
        },
        contacts: [{ type: "client", id: 9, ticket_email: true, sms: false }],
      },
    });
    assert.deepEqual(resultJson(created), { ok: true });

    const bulk = await client.callTool({
      name: "bulk_manage_checkmk_monitors",
      arguments: { service_id: 44, action: "pause", monitor_ids: [2, 3] },
    });
    assert.deepEqual(resultJson(bulk), { ok: true });
  });

  assert.deepEqual(calls, [
    {
      method: "POST",
      path: "/service/44/checkmk/monitors",
      body: {
        definition: {
          name: "Website",
          type: "http",
          target: "https://example.com/health",
          interval: 60,
          timeout: 10,
          http: { method: "GET", expected_codes: "200:299", check_cert: true },
        },
        contacts: [{ type: "client", id: 9, ticket_email: true, sms: false }],
      },
    },
    {
      method: "POST",
      path: "/service/44/checkmk/monitors/bulk",
      body: { action: "pause", monitor_ids: [2, 3] },
    },
  ]);
});

test("Checkmk schemas reject lossy HTTP updates and incomplete response-time thresholds", async () => {
  const calls = [];
  const mockClient = {
    async post(path, body) {
      calls.push({ method: "POST", path, body });
      return { ok: true };
    },
    async put(path, body) {
      calls.push({ method: "PUT", path, body });
      return { ok: true };
    },
  };

  await withServer(mockClient, async (client) => {
    const partialHttpUpdate = await client.callTool({
      name: "update_checkmk_monitor",
      arguments: {
        service_id: 44,
        monitor_id: 7,
        definition: { http: { expected_codes: "200" } },
      },
    });
    assert.equal(partialHttpUpdate.isError, true);

    // The http block wholly replaces the stored one, so dropping only response_time
    // would silently discard the monitor's configured thresholds.
    const httpMissingResponseTime = completeHttpSettings({ warn: "2", crit: "4" });
    delete httpMissingResponseTime.response_time;
    const droppedResponseTime = await client.callTool({
      name: "update_checkmk_monitor",
      arguments: { service_id: 44, monitor_id: 7, definition: { http: httpMissingResponseTime } },
    });
    assert.equal(droppedResponseTime.isError, true);

    const incompleteResponseTime = await client.callTool({
      name: "create_checkmk_monitor",
      arguments: {
        service_id: 44,
        definition: {
          name: "Website",
          type: "http",
          target: "https://example.com",
          http: { response_time: { warn: 2 } },
        },
      },
    });
    assert.equal(incompleteResponseTime.isError, true);

    const reversedResponseTime = await client.callTool({
      name: "create_checkmk_monitor",
      arguments: {
        service_id: 44,
        definition: {
          name: "Website",
          type: "http",
          target: "https://example.com",
          http: { response_time: { warn: 4, crit: 2 } },
        },
      },
    });
    assert.equal(reversedResponseTime.isError, true);

    const mixedResponseTimeUpdate = await client.callTool({
      name: "update_checkmk_monitor",
      arguments: {
        service_id: 44,
        monitor_id: 7,
        definition: { http: completeHttpSettings({ warn: "2", crit: "" }) },
      },
    });
    assert.equal(mixedResponseTimeUpdate.isError, true);

    const completeHttpUpdate = await client.callTool({
      name: "update_checkmk_monitor",
      arguments: {
        service_id: 44,
        monitor_id: 7,
        definition: { http: completeHttpSettings({ warn: "2", crit: "4" }) },
      },
    });
    assert.deepEqual(resultJson(completeHttpUpdate), { ok: true });

    const disabledResponseTimeUpdate = await client.callTool({
      name: "update_checkmk_monitor",
      arguments: {
        service_id: 44,
        monitor_id: 7,
        definition: { http: completeHttpSettings({ warn: "", crit: "" }) },
      },
    });
    assert.deepEqual(resultJson(disabledResponseTimeUpdate), { ok: true });
  });

  assert.deepEqual(calls, [
    {
      method: "PUT",
      path: "/service/44/checkmk/monitors/7",
      body: { definition: { http: completeHttpSettings({ warn: "2", crit: "4" }) } },
    },
    {
      method: "PUT",
      path: "/service/44/checkmk/monitors/7",
      body: { definition: { http: completeHttpSettings({ warn: "", crit: "" }) } },
    },
  ]);
});

test("Checkmk create schemas reject tcp_port monitors without a port", async () => {
  const calls = [];
  const mockClient = {
    async post(path, body) {
      calls.push({ path, body });
      return { ok: true };
    },
  };

  await withServer(mockClient, async (client) => {
    const portless = await client.callTool({
      name: "create_checkmk_monitor",
      arguments: {
        service_id: 44,
        definition: { name: "SSH", type: "tcp_port", target: "10.0.0.5" },
      },
    });
    assert.equal(portless.isError, true);

    const portlessBulk = await client.callTool({
      name: "bulk_create_checkmk_vm_monitors",
      arguments: { service_id: 44, definition: { type: "tcp_port" } },
    });
    assert.equal(portlessBulk.isError, true);

    const withPort = await client.callTool({
      name: "create_checkmk_monitor",
      arguments: {
        service_id: 44,
        definition: { name: "SSH", type: "tcp_port", target: "10.0.0.5", tcp: { port: 22 } },
      },
    });
    assert.deepEqual(resultJson(withPort), { ok: true });

    // Updates stay unrefined: the backend validates against the stored monitor's tcp block.
    const { tools } = await client.listTools();
    const update = tools.find((tool) => tool.name === "update_checkmk_monitor");
    assert.match(update.inputSchema.properties.definition.properties.type.description, /tcp_port requires sending tcp/);
  });

  assert.deepEqual(calls, [
    {
      path: "/service/44/checkmk/monitors",
      body: {
        definition: { name: "SSH", type: "tcp_port", target: "10.0.0.5", tcp: { port: 22 } },
      },
    },
  ]);
});

test("bulk VM monitors allow backend-derived names and notification docs describe fallback", async () => {
  const calls = [];
  const mockClient = {
    async post(path, body) {
      calls.push({ path, body });
      return { ok: true };
    },
  };

  await withServer(mockClient, async (client) => {
    const result = await client.callTool({
      name: "bulk_create_checkmk_vm_monitors",
      arguments: { service_id: 44, definition: { type: "ping" } },
    });
    assert.deepEqual(resultJson(result), { ok: true });

    const { tools } = await client.listTools();
    const notifications = tools.find((tool) => tool.name === "set_checkmk_notification_contacts");
    assert.match(notifications.inputSchema.properties.contacts.description, /restores primary-client email delivery/);
  });

  assert.deepEqual(calls, [
    {
      path: "/service/44/checkmk/monitors/bulk-create",
      body: { definition: { type: "ping" } },
    },
  ]);
});
