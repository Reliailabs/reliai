import { authkitMiddleware } from "@workos-inc/authkit-nextjs";
import type { NextFetchEvent, NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { workosConfigured } from "@/lib/constants";

const workosMiddleware = authkitMiddleware();

export default function middleware(request: NextRequest, event: NextFetchEvent) {
  const baseResponse = workosConfigured()
    ? workosMiddleware(request, event)
    : NextResponse.next();
  const response = baseResponse ?? NextResponse.next();

  if (request.nextUrl.pathname.startsWith("/onboarding") && response instanceof NextResponse) {
    response.cookies.set("reliai_onboarding_public", "1", {
      path: "/onboarding",
      sameSite: "lax"
    });
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
