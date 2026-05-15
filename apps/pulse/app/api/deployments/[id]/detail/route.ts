import { NextResponse } from "next/server";

import { getApiAccessToken } from "@/lib/auth";
import { API_URL } from "@/lib/constants";
import { mapDeploymentDetailPresenter } from "@/lib/deployment-detail-mapper";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const token = await getApiAccessToken();
  if (!token) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  try {
    const response = await fetch(`${API_URL}/api/v1/deployments/${id}`, {
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      cache: "no-store",
    });
    if (!response.ok) {
      return NextResponse.json({ error: "deployment detail unavailable" }, { status: response.status });
    }
    const payload = await response.json();
    return NextResponse.json(mapDeploymentDetailPresenter(payload));
  } catch {
    return NextResponse.json({ error: "deployment detail unavailable" }, { status: 500 });
  }
}
