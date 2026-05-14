import { NextResponse } from "next/server";

import { getApiAccessToken } from "@/lib/auth";
import { API_URL } from "@/lib/constants";
import { resolveAuditActionPath, type AuditActionKind } from "@/lib/audits-action-contract";

type ActionPayload = {
  action: AuditActionKind;
  runId?: string | null;
  stageKey?: string | null;
};

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const token = await getApiAccessToken();
  if (!token) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const payload = (await request.json()) as ActionPayload;
  const path = resolveAuditActionPath({
    auditId: id,
    action: payload.action,
    runId: payload.runId ?? null,
    stageKey: payload.stageKey ?? null,
  });

  if (!path) {
    return NextResponse.json({ error: "invalid action payload" }, { status: 400 });
  }

  try {
    const response = await fetch(`${API_URL}${path}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      cache: "no-store",
    });
    if (!response.ok) {
      return NextResponse.json({ error: "audit action failed" }, { status: response.status });
    }
    const body = await response.json();
    return NextResponse.json(body);
  } catch {
    return NextResponse.json({ error: "audit action failed" }, { status: 500 });
  }
}
