import type { Config } from "./config.js";
import { AuthManager } from "./auth.js";
import { sanitizeErrorValue } from "./errors.js";

type HttpMethod = "GET" | "POST" | "PUT" | "DELETE";

interface RequestOptions {
  allowFalseStatus?: boolean;
}

function normalizeMessages(raw: unknown): string[] {
  const values = Array.isArray(raw) ? raw : raw === undefined || raw === null ? [] : [raw];
  return values
    .slice(0, 10)
    .map(sanitizeErrorValue)
    .filter(Boolean);
}

export interface ApiResponse<T = unknown> {
  data: T;
  error: string[];
  info: string[];
  page?: { current: number; total: number };
}

export class ToggleboxClient {
  private auth: AuthManager;
  private apiBase: string;
  private readOnly: boolean;

  constructor(config: Config) {
    this.auth = new AuthManager(config);
    this.apiBase = `${config.baseUrl}/api`;
    this.readOnly = config.readOnly;
  }

  async get<T = unknown>(path: string, params?: Record<string, string>): Promise<T> {
    return (await this.request<T>("GET", path, undefined, params)).data;
  }

  async getStatus<T = unknown>(path: string, params?: Record<string, string>): Promise<T> {
    return (await this.request<T>("GET", path, undefined, params, { allowFalseStatus: true })).data;
  }

  async getFull<T = unknown>(path: string, params?: Record<string, string>): Promise<ApiResponse<T>> {
    return this.request<T>("GET", path, undefined, params);
  }

  async post<T = unknown>(path: string, body?: Record<string, unknown>): Promise<T> {
    return (await this.request<T>("POST", path, body)).data;
  }

  async put<T = unknown>(path: string, body?: Record<string, unknown>): Promise<T> {
    return (await this.request<T>("PUT", path, body)).data;
  }

  async del<T = unknown>(path: string, body?: Record<string, unknown>): Promise<T> {
    return (await this.request<T>("DELETE", path, body)).data;
  }

  private async request<T>(
    method: HttpMethod,
    path: string,
    body?: Record<string, unknown>,
    params?: Record<string, string>,
    options: RequestOptions = {}
  ): Promise<ApiResponse<T>> {
    if (this.readOnly && method !== "GET") {
      throw new Error("MCP server is running in read-only mode; mutating API requests are disabled");
    }

    const token = await this.auth.getToken();
    const url = new URL(`${this.apiBase}${path}`);

    if (params) {
      for (const [key, value] of Object.entries(params)) {
        url.searchParams.set(key, value);
      }
    }

    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    };

    const init: RequestInit = { method, headers };

    if (body && method !== "GET") {
      headers["Content-Type"] = "application/json";
      init.body = JSON.stringify(body);
    }

    let res = await fetch(url, init);

    if (res.status === 401) {
      res.body?.cancel();
      await this.auth.handleUnauthorized();
      const newToken = await this.auth.getToken();
      headers.Authorization = `Bearer ${newToken}`;
      res = await fetch(url, { ...init, headers });
    }

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      let detail = `${res.status} ${res.statusText}`;
      if (text) {
        try {
          const parsed = JSON.parse(text) as Record<string, unknown>;
          const msgs = normalizeMessages(parsed.error);
          if (msgs.length) detail = `${res.status}: ${msgs.join(", ")}`;
        } catch {
          // ignore parse failure
        }
      }
      throw new Error(detail);
    }

    const json = (await res.json()) as Record<string, unknown>;

    const errs = normalizeMessages(json.error);
    if (errs.length) throw new Error(errs.join(", "));
    if (json.status === false && !options.allowFalseStatus) throw new Error("API request failed");

    return {
      // Some endpoints nest under "data", others return payload at root
      data: (json.data !== undefined ? json.data : json) as T,
      error: errs,
      info: normalizeMessages(json.info),
      page: json.page as { current: number; total: number } | undefined,
    };
  }
}
