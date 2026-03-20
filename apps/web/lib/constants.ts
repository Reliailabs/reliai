export const API_URL =
  process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000";
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

export function workosConfigured() {
  return Boolean(
    process.env.WORKOS_CLIENT_ID &&
      process.env.WORKOS_API_KEY &&
      process.env.WORKOS_COOKIE_PASSWORD &&
      process.env.NEXT_PUBLIC_WORKOS_REDIRECT_URI,
  );
}

export function workosLogoutRedirectUri() {
  return process.env.WORKOS_LOGOUT_REDIRECT_URI ?? `${process.env.NEXT_PUBLIC_APP_URL ?? "http://127.0.0.1:3000"}/sign-in`;
}
