import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ToggleboxClient } from "../client.js";
import { booleanFlag, handleTool, serviceId } from "./helpers.js";

const bucketParam = {
  bucket: z.string().describe("RGW bucket name"),
};

const corsRule = z.object({
  AllowedOrigins: z.array(z.string()).describe("Allowed origins, e.g. [\"https://example.com\"]"),
  AllowedMethods: z.array(z.string()).describe("Allowed methods, e.g. [\"GET\", \"PUT\"]"),
  AllowedHeaders: z.array(z.string()).optional().describe("Allowed request headers"),
  ExposeHeaders: z.array(z.string()).optional().describe("Response headers exposed to browsers"),
  MaxAgeSeconds: z.number().int().min(1).optional().describe("Browser preflight cache TTL in seconds"),
});

function bucketPath(serviceId: number, bucket: string, suffix = ""): string {
  return `/service/${serviceId}/rgw/buckets/${encodeURIComponent(bucket)}${suffix}`;
}

function toolError(text: string) {
  return { content: [{ type: "text" as const, text }], isError: true as const };
}

export function register(server: McpServer, client: ToggleboxClient) {
  server.registerTool(
    "get_rgw_summary",
    {
      description: "Get RGW object-storage service summary, endpoint metadata, and bucket count",
      inputSchema: { ...serviceId },
      annotations: { readOnlyHint: true },
    },
    async ({ service_id }) => handleTool(() => client.get(`/service/${service_id}/rgw`))
  );

  server.registerTool(
    "get_rgw_credentials",
    {
      description: "Get RGW S3 access key, masked secret, endpoint, and region metadata",
      inputSchema: { ...serviceId },
      annotations: { readOnlyHint: true },
    },
    async ({ service_id }) => handleTool(() => client.get(`/service/${service_id}/rgw/credentials`))
  );

  server.registerTool(
    "rotate_rgw_credentials",
    {
      description:
        "Rotate the RGW S3 credentials for a service. Returns a new access key and a show-once secret; the previous keys are immediately revoked. Returns a busy error if a rotation is already in progress.",
      inputSchema: { ...serviceId },
      annotations: { readOnlyHint: false, destructiveHint: true },
    },
    async ({ service_id }) =>
      handleTool(() => client.post(`/service/${service_id}/rgw/credentials/rotate`))
  );

  server.registerTool(
    "get_rgw_sts",
    {
      description:
        "Get RGW STS metadata: availability, duration bounds, endpoint/region, and bucket scope. Does not issue credentials.",
      inputSchema: { ...serviceId },
      annotations: { readOnlyHint: true },
    },
    async ({ service_id }) => handleTool(() => client.get(`/service/${service_id}/rgw/sts`))
  );

  server.registerTool(
    "issue_rgw_sts",
    {
      description:
        "Issue short-lived RGW STS credentials for a service. The returned secret values are show-once and are not persisted. Optionally specify a duration in seconds within the allowed bounds (see get_rgw_sts).",
      inputSchema: {
        ...serviceId,
        duration: z
          .number()
          .int()
          .min(1)
          .optional()
          .describe("Credential lifetime in seconds; must be within the server's allowed bounds"),
      },
      annotations: { readOnlyHint: false },
    },
    async ({ service_id, duration }) =>
      handleTool(() =>
        client.post(`/service/${service_id}/rgw/sts`, {
          ...(duration !== undefined && { duration }),
        })
      )
  );

  server.registerTool(
    "list_rgw_buckets",
    {
      description: "List RGW buckets owned by a service",
      inputSchema: { ...serviceId },
      annotations: { readOnlyHint: true },
    },
    async ({ service_id }) => handleTool(() => client.get(`/service/${service_id}/rgw/buckets`))
  );

  server.registerTool(
    "create_rgw_bucket",
    {
      description: "Create an RGW bucket in the service account's primary region",
      inputSchema: {
        ...serviceId,
        suffix: z.string().optional().describe("Bucket suffix appended to the RGW UID"),
        name: z.string().optional().describe("Alias for suffix"),
        public: booleanFlag.optional().describe("1 to make the bucket public after creation"),
        encryption: booleanFlag.optional().describe("1 to enable SSE-S3 after creation"),
        cors: z.object({ rules: z.array(corsRule) }).optional().describe("Optional CORS configuration to apply after creation"),
        lifecycle: z
          .object({
            type: z.enum(["last_only", "all_versions", "prior_for_days", "custom"]),
            days: z.number().int().min(1).optional(),
            raw_xml: z.string().optional(),
          })
          .optional()
          .describe("Optional lifecycle policy to apply after creation"),
      },
      annotations: { readOnlyHint: false },
    },
    async ({ service_id, suffix, name, public: makePublic, encryption, cors, lifecycle }) => {
      const bucketSuffix = suffix ?? name;
      if (!bucketSuffix) {
        return toolError("suffix is required");
      }

      return handleTool(() =>
        client.post(`/service/${service_id}/rgw/buckets`, {
          suffix: bucketSuffix,
          ...(makePublic !== undefined && { public: makePublic }),
          ...(encryption !== undefined && { encryption }),
          ...(cors !== undefined && { cors }),
          ...(lifecycle !== undefined && { lifecycle }),
        })
      );
    }
  );

  server.registerTool(
    "delete_rgw_bucket",
    {
      description: "Delete an RGW bucket owned by a service. Use force=1 to empty objects first.",
      inputSchema: {
        ...serviceId,
        ...bucketParam,
        force: booleanFlag.optional().describe("1 to empty objects before deleting the bucket"),
      },
      annotations: { readOnlyHint: false, destructiveHint: true },
    },
    async ({ service_id, bucket, force }) =>
      handleTool(() =>
        client.del(bucketPath(service_id, bucket), {
          ...(force !== undefined && { force }),
        })
      )
  );

  server.registerTool(
    "get_rgw_bucket_cors",
    {
      description: "Get the CORS configuration for an RGW bucket",
      inputSchema: { ...serviceId, ...bucketParam },
      annotations: { readOnlyHint: true },
    },
    async ({ service_id, bucket }) => handleTool(() => client.get(bucketPath(service_id, bucket, "/cors")))
  );

  server.registerTool(
    "set_rgw_bucket_cors",
    {
      description: "Replace the CORS configuration for an RGW bucket. Pass an empty rules array to remove CORS.",
      inputSchema: {
        ...serviceId,
        ...bucketParam,
        rules: z.array(corsRule).describe("CORS rules; an empty array removes CORS"),
      },
      annotations: { readOnlyHint: false },
    },
    async ({ service_id, bucket, rules }) =>
      handleTool(() => client.put(bucketPath(service_id, bucket, "/cors"), { rules }))
  );

  server.registerTool(
    "set_rgw_bucket_public",
    {
      description: "Toggle an RGW bucket between public-read and private",
      inputSchema: {
        ...serviceId,
        ...bucketParam,
        public: booleanFlag.describe("1 for public-read, 0 for private"),
      },
      annotations: { readOnlyHint: false },
    },
    async ({ service_id, bucket, public: makePublic }) =>
      handleTool(() => client.put(bucketPath(service_id, bucket, "/public"), { public: makePublic }))
  );

  server.registerTool(
    "set_rgw_bucket_encryption",
    {
      description: "Enable or disable SSE-S3 encryption for an RGW bucket",
      inputSchema: {
        ...serviceId,
        ...bucketParam,
        enabled: booleanFlag.describe("1 to enable SSE-S3, 0 to disable"),
      },
      annotations: { readOnlyHint: false },
    },
    async ({ service_id, bucket, enabled }) =>
      handleTool(() => client.put(bucketPath(service_id, bucket, "/encryption"), { enabled }))
  );

  server.registerTool(
    "set_rgw_bucket_lifecycle",
    {
      description: "Set an RGW bucket lifecycle policy",
      inputSchema: {
        ...serviceId,
        ...bucketParam,
        type: z.enum(["last_only", "all_versions", "prior_for_days", "custom"]).describe("Lifecycle policy type"),
        days: z.number().int().min(1).optional().describe("Required when type is prior_for_days"),
        raw_xml: z.string().optional().describe("Required when type is custom"),
      },
      annotations: { readOnlyHint: false },
    },
    async ({ service_id, bucket, type, days, raw_xml }) =>
      handleTool(() =>
        client.put(bucketPath(service_id, bucket, "/lifecycle"), {
          type,
          ...(days !== undefined && { days }),
          ...(raw_xml !== undefined && { raw_xml }),
        })
      )
  );

  server.registerTool(
    "list_rgw_objects",
    {
      description: "List objects and folders in an RGW bucket with optional prefix and pagination",
      inputSchema: {
        ...serviceId,
        ...bucketParam,
        prefix: z.string().optional().describe("Optional prefix filter"),
        continuation_token: z.string().optional().describe("Pagination token from a previous response"),
        max_keys: z.number().int().min(1).max(1000).optional().describe("Page size, max 1000"),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ service_id, bucket, prefix, continuation_token, max_keys }) => {
      const params: Record<string, string> = {};
      if (prefix !== undefined) params.prefix = prefix;
      if (continuation_token !== undefined) params.continuation_token = continuation_token;
      if (max_keys !== undefined) params.max_keys = String(max_keys);
      return handleTool(() => client.get(bucketPath(service_id, bucket, "/objects"), params));
    }
  );

  server.registerTool(
    "delete_rgw_objects",
    {
      description: "Delete one object, multiple objects, or all objects under a prefix in an RGW bucket",
      inputSchema: {
        ...serviceId,
        ...bucketParam,
        key: z.string().optional().describe("Single object key to delete"),
        keys: z.array(z.string()).optional().describe("Multiple object keys to delete"),
        prefix: z.string().optional().describe("Delete all objects under this prefix"),
      },
      annotations: { readOnlyHint: false, destructiveHint: true },
    },
    async ({ service_id, bucket, key, keys, prefix }) => {
      if (!key && !keys?.length && !prefix) {
        return toolError("Provide one of key, keys, or prefix");
      }

      return handleTool(() =>
        client.del(bucketPath(service_id, bucket, "/objects"), {
          ...(key !== undefined && { key }),
          ...(keys?.length && { keys }),
          ...(prefix !== undefined && { prefix }),
        })
      );
    }
  );

  server.registerTool(
    "create_rgw_folder",
    {
      description: "Create a zero-byte folder marker in an RGW bucket",
      inputSchema: {
        ...serviceId,
        ...bucketParam,
        folder: z.string().optional().describe("Folder name without slashes"),
        name: z.string().optional().describe("Alias for folder"),
        folder_name: z.string().optional().describe("Alias for folder"),
        parent_prefix: z.string().optional().describe("Optional parent prefix"),
        prefix: z.string().optional().describe("Alias for parent_prefix"),
      },
      annotations: { readOnlyHint: false },
    },
    async ({ service_id, bucket, folder, name, folder_name, parent_prefix, prefix }) => {
      const folderName = folder ?? name ?? folder_name;
      const parentPrefix = parent_prefix ?? prefix;
      if (!folderName) {
        return toolError("folder is required");
      }

      return handleTool(() =>
        client.post(bucketPath(service_id, bucket, "/folders"), {
          folder: folderName,
          ...(parentPrefix !== undefined && { parent_prefix: parentPrefix }),
        })
      );
    }
  );

  server.registerTool(
    "presign_rgw_object",
    {
      description: "Generate a pre-signed RGW S3 URL for object upload or download",
      inputSchema: {
        ...serviceId,
        ...bucketParam,
        key: z.string().optional().describe("Object key"),
        object: z.string().optional().describe("Alias for key"),
        method: z.enum(["GET", "PUT"]).optional().describe("GET for download or PUT for upload"),
        expires: z.number().int().min(60).max(604800).optional().describe("Expiry seconds"),
        expires_seconds: z.number().int().min(60).max(604800).optional().describe("Alias for expires"),
      },
      annotations: { readOnlyHint: false },
    },
    async ({ service_id, bucket, key, object, method, expires, expires_seconds }) => {
      const objectKey = key ?? object;
      const expirySeconds = expires ?? expires_seconds;
      if (!objectKey) {
        return toolError("key is required");
      }

      return handleTool(() =>
        client.post(bucketPath(service_id, bucket, "/presign"), {
          key: objectKey,
          ...(method !== undefined && { method }),
          ...(expirySeconds !== undefined && { expires: expirySeconds }),
        })
      );
    }
  );

  server.registerTool(
    "get_rgw_usage",
    {
      description: "Get current-period RGW metered usage summary",
      inputSchema: { ...serviceId },
      annotations: { readOnlyHint: true },
    },
    async ({ service_id }) => handleTool(() => client.get(`/service/${service_id}/rgw/usage`))
  );

  server.registerTool(
    "get_rgw_usage_history",
    {
      description: "Get RGW metered usage history for a period and interval",
      inputSchema: {
        ...serviceId,
        period: z.string().optional().describe("Billing period in YYYY-MM format; defaults to current month"),
        metered_period: z.string().optional().describe("Alias for period"),
        interval: z.enum(["1h", "1d"]).optional().describe("Usage interval; defaults to 1h"),
        metered_interval: z.enum(["1h", "1d"]).optional().describe("Alias for interval"),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ service_id, period, metered_period, interval, metered_interval }) => {
      const params: Record<string, string> = {};
      const usagePeriod = period ?? metered_period;
      const usageInterval = interval ?? metered_interval;
      if (usagePeriod !== undefined) params.period = usagePeriod;
      if (usageInterval !== undefined) params.interval = usageInterval;
      return handleTool(() => client.get(`/service/${service_id}/rgw/usage/history`, params));
    }
  );
}
