import "server-only";

import { cookies } from "next/headers";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { API_URL, SESSION_COOKIE_NAME } from "@/lib/constants";

export interface OperatorSession {
  operator: {
    id: string;
    email: string;
    is_system_admin: boolean;
  };
  memberships: Array<{
    organization_id: string;
    organization_name?: string | null;
    role: string;
  }>;
  active_organization_id?: string | null;
  expires_at: string;
}

export function sanitizeReturnTo(value?: string) {
  if (typeof value === "string" && value.startsWith("/") && !value.startsWith("//")) {
    return value;
  }
  return "/pulse";
}

async function getRequestReturnTo(): Promise<string> {
  const requestHeaders = await headers();
  const candidates = [
    requestHeaders.get("next-url"),
    requestHeaders.get("x-pathname"),
    requestHeaders.get("x-invoke-path"),
    requestHeaders.get("x-matched-path"),
  ];

  for (const candidate of candidates) {
    if (!candidate) {
      continue;
    }
    try {
      if (candidate.startsWith("http://") || candidate.startsWith("https://")) {
        const parsed = new URL(candidate);
        return sanitizeReturnTo(`${parsed.pathname}${parsed.search}`);
      }
      return sanitizeReturnTo(candidate);
    } catch {
      continue;
    }
  }

  return "/pulse";
}

async function authRequest<T>(path: string, token: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Auth request failed: ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export async function getApiAccessToken(): Promise<string | null> {
  return (await cookies()).get(SESSION_COOKIE_NAME)?.value ?? null;
}

export async function signIn(email: string, password: string) {
  const response = await fetch(`${API_URL}/api/v1/auth/sign-in`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
    cache: "no-store",
  });

  if (!response.ok) {
    return null;
  }

  return (await response.json()) as OperatorSession & { session_token: string };
}

export async function getOperatorSession(): Promise<OperatorSession | null> {
  const token = await getApiAccessToken();
  if (!token) {
    return null;
  }

  try {
    return await authRequest<OperatorSession>("/api/v1/auth/session", token);
  } catch {
    return null;
  }
}

export async function requireOperatorSession(returnTo?: string): Promise<OperatorSession> {
  const session = await getOperatorSession();
  if (!session) {
    const safeReturnTo = returnTo ? sanitizeReturnTo(returnTo) : await getRequestReturnTo();
    redirect(`/sign-in?return_to=${encodeURIComponent(safeReturnTo)}`);
  }
  return session;
}

export async function requireSystemAdminSession(returnTo?: string): Promise<OperatorSession> {
  const session = await requireOperatorSession(returnTo);
  if (!session.operator.is_system_admin) {
    redirect("/pulse");
  }
  return session;
}
