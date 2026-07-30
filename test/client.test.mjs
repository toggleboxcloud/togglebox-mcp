import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { ToggleboxClient } from "../dist/client.js";

const originalFetch = globalThis.fetch;
const config = {
  baseUrl: "https://api.example.test",
  apiToken: "tbpat_test-token",
  readOnly: false,
};

afterEach(() => {
  globalThis.fetch = originalFetch;
});

test("getFull sends authentication and preserves pagination metadata", async () => {
  globalThis.fetch = async (url, init) => {
    assert.equal(String(url), "https://api.example.test/api/service?page=2");
    assert.equal(init.method, "GET");
    assert.equal(init.headers.Authorization, "Bearer tbpat_test-token");
    return Response.json({
      data: { services: [{ id: 2 }] },
      error: [],
      info: [],
      page: { current: 2, total: 3 },
    });
  };

  const response = await new ToggleboxClient(config).getFull("/service", { page: "2" });
  assert.deepEqual(response.data, { services: [{ id: 2 }] });
  assert.deepEqual(response.page, { current: 2, total: 3 });
});

test("API errors are bounded and credentials are redacted", async () => {
  const secret = `tbpat_${"x".repeat(1000)}`;
  globalThis.fetch = async () => Response.json(
    { error: [`Rejected Bearer abc123 with ${secret}\nand control\u0000data`] },
    { status: 400, statusText: "Bad Request" }
  );

  await assert.rejects(
    () => new ToggleboxClient(config).get("/service"),
    (error) => {
      assert.equal(error.message.includes(secret), false);
      assert.equal(error.message.includes("abc123"), false);
      assert.match(error.message, /\[redacted token\]/);
      assert.ok(error.message.length < 900);
      return true;
    }
  );
});

test("structured and free-form credentials are redacted from API errors", async () => {
  const jwt = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjMifQ.signature";
  globalThis.fetch = async () => Response.json({
    error: [
      {
        api_token: "plain-secret-123",
        password: "hunter2",
        nested: {
          refresh_token: "refresh-me",
          clientSecret: "client-secret",
          cookie: "session=private",
        },
      },
      "authorization=Basic dXNlcjpwYXNz",
      `token=${jwt}`,
      '{"secret":"json-string-secret"}',
    ],
  });

  await assert.rejects(
    () => new ToggleboxClient(config).get("/service"),
    (error) => {
      for (const secret of [
        "plain-secret-123",
        "hunter2",
        "refresh-me",
        "client-secret",
        "session=private",
        "dXNlcjpwYXNz",
        jwt,
        "json-string-secret",
      ]) {
        assert.equal(error.message.includes(secret), false);
      }
      assert.match(error.message, /\[redacted\]/);
      assert.ok(error.message.length <= 500);
      return true;
    }
  );
});

test("read-only mode rejects mutations before making a request", async () => {
  let called = false;
  globalThis.fetch = async () => {
    called = true;
    return Response.json({ data: {} });
  };

  const client = new ToggleboxClient({ ...config, readOnly: true });
  await assert.rejects(() => client.post("/service", {}), /read-only mode/);
  assert.equal(called, false);
});
