import "server-only";

import { withAuth, getSignInUrl, signOut as workosSignOut } from "@workos-inc/authkit-nextjs";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import {
  API_URL,
  SESSION_COOKIE_NAME,
  devAuthEnabled,
  workosConfigured,
  workosLogoutRedirectUri,
} from "@/lib/constants";

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

async function authRequest<T>(path: string, token: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(init?.headers ?? {})
    },
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error(`Auth request failed: ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export async function getApiAccessToken(): Promise<string | null> {
  const legacyToken = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  if (legacyToken) {
    return legacyToken;
  }
  if (!workosConfigured()) {
    return null;
  }
  const session = await withAuth({ ensureSignedIn: false });
  return session.user ? session.accessToken : null;
}

export async function signIn(email: string, password: string) {
  if (!devAuthEnabled()) {
    return null;
  }

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
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/"
  });
  return session;
}

export async function getWorkosSignInUrl(): Promise<string | null> {
  if (!workosConfigured()) {
    return null;
  }
  return getSignInUrl({ returnTo: "/dashboard" });
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

export async function switchOrganization(organizationId: string): Promise<OperatorSession> {
  const token = await getApiAccessToken();
  if (!token) {
    throw new Error("No session");
  }
  return authRequest<OperatorSession>("/api/v1/auth/switch-organization", token, {
    method: "POST",
    body: JSON.stringify({ organization_id: organizationId })
  });
}

export async function requireOperatorSession(): Promise<OperatorSession> {
  const session = await getOperatorSession();
  if (!session) {
    redirect("/sign-in");
  }
  return session;
}

export async function requireSystemAdminSession(): Promise<OperatorSession> {
  const session = await requireOperatorSession();
  if (!session.operator.is_system_admin) {
    redirect("/");
  }
  return session;
}

export async function signOut(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (token) {
    await fetch(`${API_URL}/api/v1/auth/sign-out`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`
      },
      cache: "no-store"
    }).catch(() => undefined);
    cookieStore.delete(SESSION_COOKIE_NAME);
    return;
  }
  if (workosConfigured()) {
    cookieStore.delete(SESSION_COOKIE_NAME);
    await workosSignOut({
      returnTo: workosLogoutRedirectUri()
    });
  }
}
