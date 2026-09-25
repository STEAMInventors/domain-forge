/** SSRF-safe URL validation for source retrieval */
const ALLOWED_PROTOCOLS = new Set(['http:', 'https:']);
const BLOCKED_HOSTS = new Set(['localhost', '127.0.0.1', '0.0.0.0', '[::1]']);

export interface UrlValidationOptions {
  maxUrlLength?: number;
}

export function validateRetrievalUrl(url: string, options?: UrlValidationOptions): void {
  const maxLen = options?.maxUrlLength ?? 2048;
  if (url.length > maxLen) {
    throw new Error('URL exceeds maximum length');
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error('Invalid URL');
  }

  if (!ALLOWED_PROTOCOLS.has(parsed.protocol)) {
    throw new Error(`Protocol not allowed: ${parsed.protocol}`);
  }

  const host = parsed.hostname.toLowerCase();
  if (BLOCKED_HOSTS.has(host) || host.endsWith('.local')) {
    throw new Error(`Host not allowed: ${host}`);
  }

  if (parsed.username || parsed.password) {
    throw new Error('URLs with credentials are not allowed');
  }
}

export const DEFAULT_FETCH_LIMITS = {
  maxBytes: 10 * 1024 * 1024,
  timeoutMs: 30_000,
} as const;
