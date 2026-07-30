const MAX_MESSAGE_LENGTH = 500;

function isSensitiveKey(key: string): boolean {
  const normalized = key.replace(/[^a-z0-9]/gi, "").toLowerCase();
  return normalized === "authorization" ||
    normalized === "cookie" ||
    normalized === "setcookie" ||
    normalized === "passwd" ||
    normalized === "pwd" ||
    normalized.endsWith("apikey") ||
    normalized.endsWith("password") ||
    normalized.endsWith("secret") ||
    normalized.endsWith("token");
}

function redactStructuredValue(value: unknown): string {
  try {
    return JSON.stringify(
      value,
      (key, nestedValue) => key && isSensitiveKey(key) ? "[redacted]" : nestedValue
    ) ?? "Unserializable error detail";
  } catch {
    return "Unserializable error detail";
  }
}

/** Remove credentials and noisy formatting before an error is returned to an MCP client. */
export function sanitizeErrorMessage(message: string): string {
  const sanitized = message
    .replace(/tbpat_[A-Za-z0-9_-]+/gi, "[redacted token]")
    .replace(/\bBearer\s+[^\s,;]+/gi, "Bearer [redacted]")
    .replace(/\bBasic\s+[A-Za-z0-9+/=]+/gi, "Basic [redacted]")
    .replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, "[redacted token]")
    .replace(
      /\b([a-z0-9_-]*(?:password|secret|token)|api[_-]?key|authorization|cookie)(\s*[:=]\s*)(?:"[^"]*"|'[^']*'|[^\s,;]+)/gi,
      "$1$2[redacted]"
    )
    .replace(/(https?:\/\/)[^\s/@:]+:[^\s/@]+@/gi, "$1[redacted]@")
    .replace(/[\u0000-\u001f\u007f]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return sanitized.slice(0, MAX_MESSAGE_LENGTH);
}

export function sanitizeErrorValue(value: unknown): string {
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
      try {
        return sanitizeErrorMessage(redactStructuredValue(JSON.parse(trimmed)));
      } catch {
        // Treat malformed JSON as a regular error message.
      }
    }
    return sanitizeErrorMessage(value);
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return sanitizeErrorMessage(redactStructuredValue(value));
}

export function safeErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : "Unexpected error";
  return sanitizeErrorValue(message) || "Request failed";
}
