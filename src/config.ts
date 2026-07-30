const DEFAULT_URL = "https://manage.togglebox.com";
const ALLOW_INSECURE_HTTP = "TOGGLEBOX_ALLOW_INSECURE_HTTP";
const READ_ONLY = "TOGGLEBOX_MCP_READ_ONLY";

export interface Config {
  baseUrl: string;
  apiToken?: string;
  username?: string;
  password?: string;
  readOnly: boolean;
}

function enabled(value: string | undefined): boolean {
  return value === "1" || value?.toLowerCase() === "true";
}

function isLocalHttpHost(hostname: string): boolean {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]";
}

function normalizeBaseUrl(rawBaseUrl: string): string {
  let url: URL;
  const trimmed = rawBaseUrl.trim();

  try {
    url = new URL(trimmed);
  } catch {
    throw new Error("TOGGLEBOX_URL must be an absolute http(s) URL");
  }

  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("TOGGLEBOX_URL must use the https:// scheme");
  }

  if (url.username || url.password) {
    throw new Error("TOGGLEBOX_URL must not include embedded credentials");
  }

  if (url.search || url.hash) {
    throw new Error("TOGGLEBOX_URL must not include a query string or fragment");
  }

  if (
    url.protocol === "http:" &&
    !isLocalHttpHost(url.hostname) &&
    process.env[ALLOW_INSECURE_HTTP] !== "1"
  ) {
    throw new Error(
      "TOGGLEBOX_URL must use https:// unless it points to localhost. " +
      `Set ${ALLOW_INSECURE_HTTP}=1 only for trusted non-production HTTP endpoints.`
    );
  }

  return url.toString().replace(/\/+$/, "");
}

export function loadConfig(): Config {
  const baseUrl = normalizeBaseUrl(process.env.TOGGLEBOX_URL ?? DEFAULT_URL);

  // Personal Access Token (PAT), format: tbpat_<hex>. Preferred over username/password for long-lived integrations.
  const apiToken = process.env.TOGGLEBOX_API_TOKEN;
  const username = process.env.TOGGLEBOX_USERNAME;
  const password = process.env.TOGGLEBOX_PASSWORD;

  if (!apiToken && (!username || !password)) {
    throw new Error(
      "TOGGLEBOX_API_TOKEN is not set. Generate a Personal Access Token (PAT) at Account → API Tokens " +
      "in the Togglebox portal, then set TOGGLEBOX_API_TOKEN=tbpat_... in your MCP config. " +
      "Alternatively, set TOGGLEBOX_USERNAME and TOGGLEBOX_PASSWORD (not recommended for long-lived integrations)."
    );
  }

  return {
    baseUrl,
    apiToken,
    username,
    password,
    readOnly: enabled(process.env[READ_ONLY]),
  };
}
