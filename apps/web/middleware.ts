import { authkitMiddleware } from "@workos-inc/authkit-nextjs";
import type { NextFetchEvent, NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { workosConfigured } from "@/lib/constants";

const workosMiddleware = authkitMiddleware();

export default function middleware(request: NextRequest, event: NextFetchEvent) {
  if (!workosConfigured()) {
    return NextResponse.next();
  }
  return workosMiddleware(request, event);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
