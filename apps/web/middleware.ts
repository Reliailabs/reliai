import { authkitMiddleware } from "@workos-inc/authkit-nextjs";
import type { NextFetchEvent, NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { workosConfigured } from "@/lib/constants";

const workosMiddleware = authkitMiddleware();

export default function middleware(request: NextRequest, event: NextFetchEvent) {
  const response = workosConfigured()
    ? workosMiddleware(request, event)
    : NextResponse.next();

  return response ?? NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
