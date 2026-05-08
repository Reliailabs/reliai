function normalizeApiUrl(url: string): string {
  if (url.startsWith("http://") || url.startsWith("https://")) {
    return url;
  }
  return `http://${url}`;
}

export const API_URL = normalizeApiUrl(
  process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000",
);

export const SESSION_COOKIE_NAME = "reliai_session";

export function devAuthEnabled() {
  const explicit = process.env.RELIAI_DEV_AUTH_ENABLED;
  if (explicit === "true") {
    return true;
  }
  if (explicit === "false") {
    return false;
  }
  return process.env.NODE_ENV !== "production";
}

