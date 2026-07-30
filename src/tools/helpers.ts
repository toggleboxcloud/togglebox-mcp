import { z } from "zod";
import type { ApiResponse } from "../client.js";
import { safeErrorMessage } from "../errors.js";

const MAX_AUTO_PAGES = 100;
const MAX_RESULT_LENGTH = 200_000;

interface PagedToolOptions<T> {
  page?: number;
  allPages?: boolean;
  transform?: (data: T) => unknown;
}

export const serviceId = {
  service_id: z.number().int().min(1).describe("The cloud service/account ID"),
};

export const vmParams = {
  ...serviceId,
  vm_id: z.number().int().min(0).describe("The virtual machine ID"),
};

export const diskParams = {
  ...vmParams,
  disk_id: z.number().int().min(0).describe("The disk ID"),
};

export const volumeParams = {
  ...serviceId,
  volume_id: z.number().int().min(1).describe("The volume ID"),
};

export const templateParams = {
  ...serviceId,
  template_id: z.number().int().min(1).describe("The template ID"),
};

export const aliasParams = {
  ...vmParams,
  alias_id: z.number().int().min(0).describe("The IP alias ID"),
};

export const netParams = {
  ...serviceId,
  net_id: z.number().int().min(1).describe("The private network ID"),
};

export const arParams = {
  ...netParams,
  ar_id: z.number().int().min(1).describe("The address range ID"),
};

/** Reusable Zod schema for API boolean flags encoded as 0/1 integers. */
export const booleanFlag = z.number().int().min(0).max(1);

export const pageParam = {
  page: z.number().int().min(1).optional().describe("Page number to retrieve (default: 1)"),
  all_pages: z.boolean().optional().describe("Retrieve and combine every page (maximum 100 pages)"),
};

export function buildPageParams(page?: number): Record<string, string> {
  return page !== undefined ? { page: String(page) } : {};
}

export function jsonResult(data: unknown) {
  const text = data !== undefined ? JSON.stringify(data) : "No data returned";
  if (text.length > MAX_RESULT_LENGTH) {
    return errorResult(
      new Error(
        `Response is too large to return safely (${text.length} characters). Request a specific page or a narrower result.`
      )
    );
  }
  return { content: [{ type: "text" as const, text }] };
}

export function errorResult(err: unknown) {
  return {
    content: [{ type: "text" as const, text: safeErrorMessage(err) }],
    isError: true as const,
  };
}

export async function handleTool<T>(fn: () => Promise<T>) {
  try {
    const data = await fn();
    return jsonResult(data);
  } catch (err) {
    return errorResult(err);
  }
}

export async function handlePagedTool<T>(
  fetchPage: (page?: number) => Promise<ApiResponse<T>>,
  options: PagedToolOptions<T> = {}
) {
  try {
    const firstPage = options.allPages ? 1 : options.page;
    const firstResponse = await fetchPage(firstPage);
    const totalPages = firstResponse.page?.total ?? 1;

    if (options.allPages && totalPages > MAX_AUTO_PAGES) {
      throw new Error(
        `Result has ${totalPages} pages; automatic retrieval is limited to ${MAX_AUTO_PAGES}. Request individual pages instead.`
      );
    }

    const transformPage = (data: T) => options.transform ? options.transform(data) : data;
    let transformed = transformPage(firstResponse.data);
    let pagesFetched = 1;

    if (options.allPages) {
      assertResultSize(transformed);
      for (let page = 2; page <= totalPages; page += 1) {
        const response = await fetchPage(page);
        transformed = mergePageData(transformed, transformPage(response.data));
        pagesFetched += 1;
        assertResultSize(transformed);
      }
    }

    const result: Record<string, unknown> =
      transformed && typeof transformed === "object" && !Array.isArray(transformed)
        ? { ...(transformed as Record<string, unknown>) }
        : { data: transformed };
    if (firstResponse.page && firstResponse.page.total > 1) {
      result.page = options.allPages
        ? { current: totalPages, total: totalPages }
        : firstResponse.page;
    }
    if (options.allPages) {
      result.pages_fetched = pagesFetched;
    }
    return jsonResult(result);
  } catch (err) {
    return errorResult(err);
  }
}

function assertResultSize(data: unknown): void {
  const length = JSON.stringify(data)?.length ?? 0;
  if (length > MAX_RESULT_LENGTH) {
    throw new Error(
      `Response is too large to return safely (${length} characters). Request a specific page or a narrower result.`
    );
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

/** Combine common API collection shapes while preserving non-collection metadata. */
function mergePageData(current: unknown, next: unknown): unknown {
  if (Array.isArray(current) && Array.isArray(next)) return [...current, ...next];
  if (!isRecord(current) || !isRecord(next)) return { pages: [current, next] };

  const merged: Record<string, unknown> = { ...current };
  for (const [key, nextValue] of Object.entries(next)) {
    const currentValue = current[key];
    if (Array.isArray(currentValue) && Array.isArray(nextValue)) {
      merged[key] = [...currentValue, ...nextValue];
    } else if (isRecord(currentValue) && isRecord(nextValue)) {
      merged[key] = { ...currentValue, ...nextValue };
    } else if (currentValue === undefined) {
      merged[key] = nextValue;
    }
  }
  return merged;
}

/** Pick specific fields from each item in a collection response. */
export function summarizeList(
  data: unknown,
  listKey: string,
  fields: string[]
): unknown {
  if (!data || typeof data !== "object") return data;
  const obj = data as Record<string, unknown>;
  const collection = obj[listKey];
  if (!collection || typeof collection !== "object") return data;

  // Collection may be an array or a keyed object (e.g. { "1693": {...}, "1694": {...} })
  const items = Array.isArray(collection)
    ? collection
    : Object.values(collection);

  const trimmed = items.map((item) => {
    if (!item || typeof item !== "object") return item;
    const record = item as Record<string, unknown>;
    const picked: Record<string, unknown> = {};
    for (const f of fields) {
      if (f in record) picked[f] = record[f];
    }
    return picked;
  });

  return { ...obj, [listKey]: trimmed };
}
