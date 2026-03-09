import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { SESSION_COOKIE_NAME } from "@/lib/api";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export interface OperatorSession {
  operator: {
    id: string;
    email: string;
  };
  memberships: Array<{
    organization_id: string;
    role: string;
  }>;
  expires_at: string;
}

async function authRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers ?? {})
    },
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error(`Auth request failed: ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export async function signIn(email: string, password: string) {
  const response = await fetch(`${API_URL}/api/v1/auth/sign-in`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
    cache: "no-store"
  });

  if (!response.ok) {
    return null;
  }

  const session = (await response.json()) as OperatorSession & { session_token: string };
  (await cookies()).set(SESSION_COOKIE_NAME, session.session_token, {
    httpOnly: true,
    secure: false,
    sameSite: "lax",
    path: "/"
  });
  return session;
}

export async function getOperatorSession(): Promise<OperatorSession | null> {
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  if (!token) {
    return null;
  }

  try {
    return await authRequest<OperatorSession>("/api/v1/auth/session");
  } catch {
    return null;
  }
}

export async function requireOperatorSession(): Promise<OperatorSession> {
  const session = await getOperatorSession();
  if (!session) {
    redirect("/sign-in");
  }
  return session;
}

export async function signOut(): Promise<void> {
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  if (token) {
    await fetch(`${API_URL}/api/v1/auth/sign-out`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`
      },
      cache: "no-store"
    }).catch(() => undefined);
  }
  (await cookies()).delete(SESSION_COOKIE_NAME);
}
