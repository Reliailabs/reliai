import { NextResponse } from "next/server";

import { getApiAccessToken } from "@/lib/auth";
import { API_URL } from "@/lib/constants";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const token = await getApiAccessToken();
  if (!token) {
    return NextResponse.json({ detail: "unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const params = new URLSearchParams();
  const projectId = url.searchParams.get("project_id");
  if (projectId) params.set("project_id", projectId);

  const query = params.size ? `?${params.toString()}` : "";
  const upstream = await fetch(`${API_URL}/api/v1/system/limits${query}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
    cache: "no-store",
  });

  const payload = await upstream.json();
  return NextResponse.json(payload, { status: upstream.status });
}
