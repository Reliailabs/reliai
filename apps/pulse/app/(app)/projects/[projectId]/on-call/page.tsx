import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { AppShellFrame } from "@/components/dashboard/app-shell-frame";
import { API_URL } from "@/lib/constants";
import { getApiAccessToken, getOperatorSession, requireOperatorSession } from "@/lib/auth";

type ProjectOncallAssignment = {
  role: string;
  user_id: string;
  name: string | null;
  email: string | null;
};

type ProjectOncallPolicyStep = {
  step_order: number;
  target_role: string;
  wait_minutes: number;
  channel: string;
};

type ProjectOncallRead = {
  project_id: string;
  rotation_id: string;
  rotation_name: string;
  timezone: string;
  is_active: boolean;
  assignments: ProjectOncallAssignment[];
  escalation_policy: ProjectOncallPolicyStep[];
};

type TeamMember = {
  user_id: string;
  display_name: string | null;
  email: string | null;
  role: string;
};

type ProjectOncallPageProps = {
  params: Promise<{ projectId: string }>;
};

async function apiRequest<T>(path: string): Promise<T | null> {
  const token = await getApiAccessToken();
  if (!token) return null;
  const response = await fetch(`${API_URL}${path}`, {
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    cache: "no-store",
  });
  if (!response.ok) return null;
  return (await response.json()) as T;
}

function byRole(assignments: ProjectOncallAssignment[], role: string): ProjectOncallAssignment | null {
  return assignments.find((assignment) => assignment.role === role) ?? null;
}

function byStep(steps: ProjectOncallPolicyStep[], step: number): ProjectOncallPolicyStep | null {
  return steps.find((item) => item.step_order === step) ?? null;
}

export default async function ProjectOncallPage({ params }: ProjectOncallPageProps) {
  const { projectId } = await params;
  await requireOperatorSession();

  const session = await getOperatorSession();
  const orgId = session?.active_organization_id;

  const [oncallData, memberData] = await Promise.all([
    apiRequest<ProjectOncallRead>(`/api/v1/projects/${projectId}/oncall`),
    orgId ? apiRequest<{ items: TeamMember[] }>(`/api/v1/organizations/${orgId}/members`) : Promise.resolve(null),
  ]);
  const members = memberData?.items ?? [];
  const assignments = oncallData?.assignments ?? [];
  const policy = oncallData?.escalation_policy ?? [];

  async function saveAssignmentsAction(formData: FormData) {
    "use server";
    const token = await getApiAccessToken();
    if (!token) return;

    const roleKeys = ["primary", "secondary", "lead", "sre"] as const;
    const items = roleKeys
      .map((role) => ({
        role,
        user_id: String(formData.get(role) ?? "").trim(),
      }))
      .filter((item) => item.user_id.length > 0);

    const response = await fetch(`${API_URL}/api/v1/projects/${projectId}/oncall/assignments`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ items }),
      cache: "no-store",
    });
    if (!response.ok) return;
    revalidatePath(`/projects/${projectId}/on-call`);
    revalidatePath(`/projects/${projectId}/reliability`);
    redirect(`/projects/${projectId}/on-call`);
  }

  async function saveEscalationPolicyAction(formData: FormData) {
    "use server";
    const token = await getApiAccessToken();
    if (!token) return;

    const steps = [1, 2, 3, 4]
      .map((stepOrder) => ({
        step_order: stepOrder,
        target_role: String(formData.get(`target_role_${stepOrder}`) ?? "").trim(),
        wait_minutes: Number(formData.get(`wait_minutes_${stepOrder}`) ?? "0"),
        channel: String(formData.get(`channel_${stepOrder}`) ?? "").trim(),
      }))
      .filter((step) => step.target_role.length > 0 && step.channel.length > 0);

    const response = await fetch(`${API_URL}/api/v1/projects/${projectId}/oncall/escalation-policy`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ items: steps }),
      cache: "no-store",
    });
    if (!response.ok) return;
    revalidatePath(`/projects/${projectId}/on-call`);
    redirect(`/projects/${projectId}/on-call`);
  }

  return (
    <AppShellFrame activeSection="oncall">
      <div className="mx-auto w-full max-w-[1200px] px-6 py-6 space-y-6">
      <header className="rounded-2xl border border-border bg-card p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Project On-Call</p>
            <h1 className="mt-2 text-2xl font-semibold text-foreground">Response Team Assignments</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Assign Team Members to on-call roles and define escalation policy steps.
            </p>
          </div>
          <Link href={`/projects/${projectId}/reliability`} className="rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-muted">
            Back to reliability
          </Link>
        </div>
      </header>

      <section className="grid gap-6 xl:grid-cols-2">
        <article className="rounded-xl border border-border bg-card p-5">
          <h2 className="text-base font-semibold text-foreground">Role Assignments</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Only members from Settings → Team can be assigned. These are response duty roles, not access roles.
          </p>
          <form action={saveAssignmentsAction} className="mt-4 space-y-3">
            {[
              ["primary", "Primary On-Call"],
              ["secondary", "Secondary On-Call"],
              ["lead", "Platform Lead"],
              ["sre", "SRE Engineer"],
            ].map(([role, label]) => (
              <label key={role} className="block text-xs text-muted-foreground">
                {label}
                <select
                  name={role}
                  defaultValue={byRole(assignments, role)?.user_id ?? ""}
                  className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground"
                >
                  <option value="">Unassigned</option>
                  {members.map((member) => (
                    <option key={member.user_id} value={member.user_id}>
                        {member.display_name ?? member.email ?? member.user_id}
                      </option>
                  ))}
                </select>
              </label>
            ))}
            <button type="submit" className="rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-muted">
              Save assignments
            </button>
          </form>
        </article>

        <article className="rounded-xl border border-border bg-card p-5">
          <h2 className="text-base font-semibold text-foreground">Escalation Policy</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Configure ordered escalation behavior by role and notification channel.
          </p>
          <form action={saveEscalationPolicyAction} className="mt-4 space-y-4">
            {[1, 2, 3, 4].map((step) => (
              <div key={step} className="rounded-lg border border-border p-3">
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Step {step}</p>
                <div className="mt-2 grid gap-2 md:grid-cols-3">
                  <select
                    name={`target_role_${step}`}
                    defaultValue={byStep(policy, step)?.target_role ?? ""}
                    className="rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground"
                  >
                    <option value="">Select role</option>
                    <option value="primary">primary</option>
                    <option value="secondary">secondary</option>
                    <option value="lead">lead</option>
                    <option value="sre">sre</option>
                  </select>
                  <input
                    name={`wait_minutes_${step}`}
                    type="number"
                    min={0}
                    max={1440}
                    defaultValue={byStep(policy, step)?.wait_minutes ?? 5}
                    className="rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground"
                  />
                  <select
                    name={`channel_${step}`}
                    defaultValue={byStep(policy, step)?.channel ?? "slack"}
                    className="rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground"
                  >
                    <option value="slack">slack</option>
                    <option value="phone">phone</option>
                    <option value="email">email</option>
                  </select>
                </div>
              </div>
            ))}
            <button type="submit" className="rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-muted">
              Save escalation policy
            </button>
          </form>
        </article>
      </section>

      <section className="rounded-xl border border-border bg-card p-5">
        <h2 className="text-base font-semibold text-foreground">Current Snapshot</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Rotation: {oncallData?.rotation_name ?? "not configured"} · Timezone: {oncallData?.timezone ?? "UTC"} · Active:{" "}
          {oncallData?.is_active ? "yes" : "no"}
        </p>
      </section>
      </div>
    </AppShellFrame>
  );
}
