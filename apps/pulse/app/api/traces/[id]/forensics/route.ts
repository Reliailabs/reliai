import { NextResponse } from "next/server";

import { getApiAccessToken } from "@/lib/auth";
import { API_URL } from "@/lib/constants";
import { mapTraceForensicsPresenter } from "@/lib/trace-forensics-mapper";

async function fetchJson<T>(token: string, path: string): Promise<T | null> {
  try {
    const response = await fetch(`${API_URL}${path}`, {
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      cache: "no-store",
    });
    if (!response.ok) return null;
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const token = await getApiAccessToken();
  if (!token) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const [detail, analysis, compare, graph] = await Promise.all([
    fetchJson(token, `/api/v1/traces/${id}`),
    fetchJson(token, `/api/v1/traces/${id}/analysis`),
    fetchJson(token, `/api/v1/traces/${id}/compare`),
    fetchJson(token, `/api/v1/traces/${id}/graph`),
  ]);

  if (!detail) {
    return NextResponse.json({ error: "trace not found" }, { status: 404 });
  }

  return NextResponse.json(
    mapTraceForensicsPresenter({
      detail: detail as Parameters<typeof mapTraceForensicsPresenter>[0]["detail"],
      analysis: analysis as Parameters<typeof mapTraceForensicsPresenter>[0]["analysis"],
      compare: compare as Parameters<typeof mapTraceForensicsPresenter>[0]["compare"],
      graph: graph as Parameters<typeof mapTraceForensicsPresenter>[0]["graph"],
    }),
  );
}
