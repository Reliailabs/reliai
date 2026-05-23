import { NextResponse } from "next/server";

import { resolveExternalAuthCallbackHref } from "@/lib/auth-callback-link";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const resolved = resolveExternalAuthCallbackHref(requestUrl, requestUrl.searchParams);

  if (!resolved.ok) {
    const fallback = new URL("/sign-in?error=sso_callback_unavailable", requestUrl.origin);
    return NextResponse.redirect(fallback, 307);
  }

  return NextResponse.redirect(resolved.href, 307);
}
