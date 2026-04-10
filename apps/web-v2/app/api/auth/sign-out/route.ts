import { NextResponse } from "next/server";

import { getApiAccessToken } from "@/lib/auth";
import { API_URL, SESSION_COOKIE_NAME } from "@/lib/constants";

export async function POST(request: Request) {
  const token = await getApiAccessToken();
  if (token) {
    await fetch(`${API_URL}/api/v1/auth/sign-out`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
    }).catch(() => undefined);
  }

  const response = NextResponse.redirect(new URL("/sign-in", request.url), { status: 303 });
  response.cookies.delete(SESSION_COOKIE_NAME);
  return response;
}

export function GET() {
  return NextResponse.json({ detail: "Use POST to /api/auth/sign-out." }, { status: 405 });
}
