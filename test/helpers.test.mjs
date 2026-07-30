import assert from "node:assert/strict";
import { test } from "node:test";
import { errorResult, handlePagedTool } from "../dist/tools/helpers.js";

function resultJson(result) {
  assert.equal(result.isError, undefined);
  return JSON.parse(result.content[0].text);
}

test("handlePagedTool retrieves one requested page by default", async () => {
  const requested = [];
  const result = await handlePagedTool(async (page) => {
    requested.push(page);
    return {
      data: { items: [{ id: page }] },
      error: [],
      info: [],
      page: { current: page, total: 4 },
    };
  }, { page: 3 });

  assert.deepEqual(requested, [3]);
  assert.deepEqual(resultJson(result), {
    items: [{ id: 3 }],
    page: { current: 3, total: 4 },
  });
});

test("handlePagedTool retrieves and combines all pages", async () => {
  const requested = [];
  const result = await handlePagedTool(async (page) => {
    requested.push(page);
    return {
      data: {
        items: [{ id: page }],
        keyed: { [page]: { id: page } },
      },
      error: [],
      info: [],
      page: { current: page, total: 3 },
    };
  }, { allPages: true });

  assert.deepEqual(requested, [1, 2, 3]);
  assert.deepEqual(resultJson(result), {
    items: [{ id: 1 }, { id: 2 }, { id: 3 }],
    keyed: { 1: { id: 1 }, 2: { id: 2 }, 3: { id: 3 } },
    page: { current: 3, total: 3 },
    pages_fetched: 3,
  });
});

test("errorResult does not stringify arbitrary thrown values", () => {
  const result = errorResult({ token: "tbpat_should-not-leak" });
  assert.equal(result.isError, true);
  assert.equal(result.content[0].text, "Unexpected error");
});

test("all-page retrieval refuses an excessive number of requests", async () => {
  const result = await handlePagedTool(async (page) => ({
    data: { items: [] },
    error: [],
    info: [],
    page: { current: page, total: 101 },
  }), { allPages: true });

  assert.equal(result.isError, true);
  assert.match(result.content[0].text, /limited to 100/);
});

test("all-page retrieval stops when the accumulated result is too large", async () => {
  const requested = [];
  const result = await handlePagedTool(async (page) => {
    requested.push(page);
    return {
      data: { items: ["x".repeat(110_000)] },
      error: [],
      info: [],
      page: { current: page, total: 3 },
    };
  }, { allPages: true });

  assert.deepEqual(requested, [1, 2]);
  assert.equal(result.isError, true);
  assert.match(result.content[0].text, /too large to return safely/);
});
