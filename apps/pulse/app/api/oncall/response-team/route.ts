import { NextResponse } from "next/server";

import { getApiAccessToken, getOperatorSession } from "@/lib/auth";
import { API_URL } from "@/lib/constants";
import { listProjectScopeOptions } from "@/lib/project-scope-data";
import { resolveScopedProjectId } from "@/lib/project-scope-utils";

type ResponseTeamMember = {
  id: string;
  name: string;
  role: "Primary On-Call" | "Secondary On-Call" | "Platform Lead" | "SRE Engineer";
  initials: string;
  status: "active" | "standby" | "available";
};

type ResponseTeamPayload = {
  items: ResponseTeamMember[];
};

function titleCase(segment: string): string {
  if (!segment) return "";
  return segment[0]!.toUpperCase() + segment.slice(1).toLowerCase();
}

function nameFromEmail(email: string | null): string {
  if (!email) return "Unknown Member";
  const localPart = email.split("@")[0] ?? "";
  const tokens = localPart.split(/[._-]+/).filter(Boolean).slice(0, 2);
  if (tokens.length === 0) return email;
  return tokens.map(titleCase).join(" ");
}

function initialsFromName(name: string): string {
  const parts = name.split(/\s+/).filter(Boolean).slice(0, 2);
  if (parts.length === 0) return "NA";
  return parts.map((part) => part[0]!.toUpperCase()).join("");
}

export async function GET(request: Request) {
  const [token, session] = await Promise.all([getApiAccessToken(), getOperatorSession()]);
  if (!token || !session?.active_organization_id) {
    return NextResponse.json({ items: [] } satisfies ResponseTeamPayload, { status: 200 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const projectIdParam = searchParams.get("project_id") ?? searchParams.get("projectId");
    const projects = await listProjectScopeOptions();
    const projectId = resolveScopedProjectId(projects, projectIdParam);
    if (!projectId) {
      return NextResponse.json({ items: [] } satisfies ResponseTeamPayload, { status: 200 });
    }
    const projectOncallResponse = await fetch(`${API_URL}/api/v1/projects/${projectId}/oncall`, {
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      cache: "no-store",
    });
    if (!projectOncallResponse.ok) {
      return NextResponse.json({ items: [] } satisfies ResponseTeamPayload, { status: 200 });
    }
    const projectOncall = (await projectOncallResponse.json()) as {
      assignments?: Array<{ user_id: string; role: string; name: string | null; email: string | null }>;
    };
    const roleOrder: Record<string, { label: ResponseTeamMember["role"]; status: ResponseTeamMember["status"] }> = {
      primary: { label: "Primary On-Call", status: "active" },
      secondary: { label: "Secondary On-Call", status: "standby" },
      lead: { label: "Platform Lead", status: "available" },
      sre: { label: "SRE Engineer", status: "available" },
    };
    const items: ResponseTeamMember[] = (projectOncall.assignments ?? [])
      .filter((item) => roleOrder[item.role] != null)
      .sort((a, b) => {
        const left = ["primary", "secondary", "lead", "sre"].indexOf(a.role);
        const right = ["primary", "secondary", "lead", "sre"].indexOf(b.role);
        return left - right;
      })
      .map((member) => {
      const name = (member.name && member.name.trim()) || nameFromEmail(member.email);
      const roleMeta = roleOrder[member.role]!;
      return {
        id: member.user_id,
        name,
        role: roleMeta.label,
        initials: initialsFromName(name),
        status: roleMeta.status,
      };
    });

    return NextResponse.json({ items } satisfies ResponseTeamPayload, { status: 200 });
  } catch {
    return NextResponse.json({ items: [] } satisfies ResponseTeamPayload, { status: 200 });
  }
}
