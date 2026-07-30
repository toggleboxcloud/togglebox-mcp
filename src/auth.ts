import type { Config } from "./config.js";
import { sanitizeErrorValue } from "./errors.js";

export class AuthManager {
  private accessToken: string | null = null;
  private refreshToken: string | null = null;
  private authPromise: Promise<void> | null = null;
  private config: Config;

  constructor(config: Config) {
    this.config = config;
    if (config.apiToken) {
      this.accessToken = config.apiToken;
    }
  }

  async getToken(): Promise<string> {
    if (this.accessToken) {
      return this.accessToken;
    }

    await this.ensureAuth();

    if (!this.accessToken) {
      throw new Error("Authentication succeeded but no token was set");
    }
    return this.accessToken;
  }

  async handleUnauthorized(): Promise<void> {
    if (this.config.apiToken) {
      throw new Error(
      "Personal Access Token rejected (401). The token may be revoked or expired. " +
      "Generate a new one at Account → API Tokens in the Togglebox portal."
    );
    }

    this.accessToken = null;
    await this.ensureAuth();
  }

  private ensureAuth(): Promise<void> {
    if (this.authPromise) return this.authPromise;
    this.authPromise = this.doAuth().finally(() => {
      this.authPromise = null;
    });
    return this.authPromise;
  }

  private async doAuth(): Promise<void> {
    if (this.refreshToken) {
      try {
        await this.refresh();
        return;
      } catch {
        // Refresh failed, fall through to login
      }
    }

    if (this.config.username && this.config.password) {
      await this.login();
      return;
    }

    throw new Error("No authentication method available");
  }

  private async login(): Promise<void> {
    const res = await fetch(`${this.config.baseUrl}/api/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: this.config.username,
        password: this.config.password,
      }),
    });

    if (!res.ok) {
      throw new Error(`Login failed: ${res.status} ${res.statusText}`);
    }

    const body = await res.json() as { token?: string; refresh?: string; error?: string[] };

    if (body.error?.length) {
      throw new Error(`Login failed: ${body.error.map(sanitizeErrorValue).join(", ")}`);
    }

    if (!body.token) {
      throw new Error("Login response missing token");
    }

    this.accessToken = body.token;
    this.refreshToken = body.refresh ?? null;
  }

  private async refresh(): Promise<void> {
    const res = await fetch(`${this.config.baseUrl}/api/token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: this.refreshToken }),
    });

    if (!res.ok) {
      this.refreshToken = null;
      throw new Error(`Token refresh failed: ${res.status}`);
    }

    const body = await res.json() as { token?: string; error?: string[] };

    if (body.error?.length || !body.token) {
      this.refreshToken = null;
      throw new Error("Token refresh failed");
    }

    this.accessToken = body.token;
  }
}
