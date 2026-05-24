function normalizeApiUrl(url: string): string {
  if (url.startsWith("http://") || url.startsWith("https://")) {
    return url;
  }
  return `http://${url}`;
}

function getConfiguredApiUrl(): string {
  return normalizeApiUrl(process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000");
}

export const API_URL = getConfiguredApiUrl();

export const SESSION_COOKIE_NAME = "reliai_session";

export function devAuthEnabled() {
  return process.env.RELIAI_DEV_AUTH_ENABLED === "true";
}

export function getAuthRuntimeConfigError(): string | null {
  const explicitApiUrl = process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL;
  if (process.env.NODE_ENV === "production" && !explicitApiUrl) {
    return "missing_api_url";
  }

  try {
    const parsed = new URL(getConfiguredApiUrl());
    const host = parsed.hostname.toLowerCase();
    if (process.env.NODE_ENV === "production" && (host === "localhost" || host === "127.0.0.1" || host === "0.0.0.0")) {
      return "invalid_production_api_url";
    }
  } catch {
    return "invalid_api_url";
  }

  return null;
}
