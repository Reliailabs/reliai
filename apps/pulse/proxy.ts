import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { API_URL, SESSION_COOKIE_NAME } from "@/lib/constants";

const PROTECTED_PATH_PREFIXES = [
  "/pulse",
  "/projects",
  "/services",
  "/incidents",
  "/errors",
  "/traces",
  "/deployments",
  "/audits",
  "/guardrails",
  "/metrics",
  "/on-call",
  "/postmortems",
  "/settings",
  "/playground",
];

function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PATH_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

function toSignInRedirect(request: NextRequest) {
  const returnTo = `${request.nextUrl.pathname}${request.nextUrl.search}`;
  const signInUrl = new URL("/sign-in", request.url);
  signInUrl.searchParams.set("return_to", returnTo);
  return NextResponse.redirect(signInUrl);
}

export async function proxy(request: NextRequest) {
  if (!isProtectedPath(request.nextUrl.pathname)) {
    return NextResponse.next();
  }

  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!token) {
    return toSignInRedirect(request);
  }

  try {
    const response = await fetch(`${API_URL}/api/v1/auth/session`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!response.ok) {
      return toSignInRedirect(request);
    }
  } catch {
    return toSignInRedirect(request);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/pulse/:path*",
    "/projects/:path*",
    "/services/:path*",
    "/incidents/:path*",
    "/errors/:path*",
    "/traces/:path*",
    "/deployments/:path*",
    "/audits/:path*",
    "/guardrails/:path*",
    "/metrics/:path*",
    "/on-call/:path*",
    "/postmortems/:path*",
    "/settings/:path*",
    "/playground/:path*",
  ],
};
