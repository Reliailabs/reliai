import { NextResponse } from "next/server";

import { getApiAccessToken } from "@/lib/auth";
import { API_URL } from "@/lib/constants";

export async function POST(request: Request) {
  const token = await getApiAccessToken();
  if (!token) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const payload = await request.json();
  const response = await fetch(`${API_URL}/api/v1/config/apply`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  const json = await response.json().catch(() => ({}));
  return NextResponse.json(json, { status: response.status });
}
