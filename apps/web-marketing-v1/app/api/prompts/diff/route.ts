import { NextRequest, NextResponse } from "next/server";

import { getApiAccessToken } from "@/lib/auth";
import { API_URL } from "@/lib/constants";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const token = await getApiAccessToken();
  if (!token) {
    return NextResponse.json({ detail: "unauthorized" }, { status: 401 });
  }

  const fromVersionId = request.nextUrl.searchParams.get("fromVersionId");
  const toVersionId = request.nextUrl.searchParams.get("toVersionId");

  if (!fromVersionId || !toVersionId) {
    return NextResponse.json(
      { detail: "fromVersionId and toVersionId are required" },
      { status: 400 }
    );
  }

  const upstream = await fetch(
    `${API_URL}/api/v1/prompts/diff?fromVersionId=${encodeURIComponent(fromVersionId)}&toVersionId=${encodeURIComponent(toVersionId)}`,
    {
      cache: "no-store",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  const payload = await upstream.json();
  return NextResponse.json(payload, { status: upstream.status });
}
