import { NextResponse } from "next/server";
import { getApiAccessToken } from "@/lib/auth";
import { API_URL } from "@/lib/constants";

type IncidentItem = {
  id: string;
  title: string;
  severity: string;
  status: string;
  started_at: string;
};

export type AlertInboxItem = {
  id: string;
  title: string;
  severity: "critical" | "high" | "medium" | "low";
  href: string;
  meta: string;
};

export type AlertInboxResponse = {
  items: AlertInboxItem[];
  count: number;
};

function severityLabel(s: string): AlertInboxItem["severity"] {
  if (s === "critical" || s === "high" || s === "medium" || s === "low") return s;
  return "medium";
}

function timeAgo(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (diff < 60) return `${diff}m ago`;
  if (diff < 1440) return `${Math.floor(diff / 60)}h ago`;
  return `${Math.floor(diff / 1440)}d ago`;
}

export async function GET() {
  const token = await getApiAccessToken();
  if (!token) {
    return NextResponse.json({ items: [], count: 0 }, { status: 200 });
  }

  try {
    const response = await fetch(`${API_URL}/api/v1/incidents?status=open&limit=5`, {
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      cache: "no-store",
    });

    if (!response.ok) {
      return NextResponse.json({ items: [], count: 0 }, { status: 200 });
    }

    const data = (await response.json()) as { items: IncidentItem[] };
    const items: AlertInboxItem[] = (data.items ?? []).map((inc) => ({
      id: inc.id,
      title: inc.title,
      severity: severityLabel(inc.severity),
      href: "/incidents",
      meta: `${timeAgo(inc.started_at)} · ${inc.severity}`,
    }));

    return NextResponse.json({ items, count: items.length }, { status: 200 });
  } catch {
    return NextResponse.json({ items: [], count: 0 }, { status: 200 });
  }
}
