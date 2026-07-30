import { McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";

export function jsonResource(uri: URL, data: unknown) {
  return {
    contents: [{
      uri: uri.href,
      mimeType: "application/json",
      text: JSON.stringify(data, null, 2),
    }],
  };
}

export function requireId(value: string | string[], name: string): number {
  const n = Number(Array.isArray(value) ? value[0] : value);
  if (!Number.isInteger(n) || n <= 0) {
    throw new McpError(ErrorCode.InvalidParams, `Invalid ${name}: ${value}`);
  }
  return n;
}
