function normalizeApiUrl(url: string): string {
  // If URL already has a scheme, return as-is
  if (url.startsWith("http://") || url.startsWith("https://")) {
    return url;
  }
  // Otherwise assume http:// (for Railway internal service URLs)
  return `http://${url}`;
}

export const API_URL = normalizeApiUrl(
  process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000"
);
export const SESSION_COOKIE_NAME = "reliai_session";
