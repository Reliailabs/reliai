import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { BellRing, RadioTower, ShieldCheck, Slash, Server, Users, Building2 } from "lucide-react";

import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { SectionLabel } from "@/components/ui/heading";
import {
  getOrganization,
  getOrganizationAlertTarget,
  listProjects,
  testOrganizationAlertTarget,
  updateOrganization,
  updateProject,
  upsertOrganizationAlertTarget,
  enableOrganizationAlertTarget,
  disableOrganizationAlertTarget,
} from "@/lib/api";
import { requireOperatorSession } from "@/lib/auth";

type Tab = "project" | "organization" | "alerts" | "system";

function normalizeTab(tab: string | undefined): Tab {
  if (tab === "organization" || tab === "alerts" || tab === "system") return tab;
  return "project";
}

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const session = await requireOperatorSession();

  const organizations = await Promise.all(
    session.memberships.map(async (membership) => {
      const organization = await getOrganization(membership.organization_id).catch(() => null);
      return organization;
    })
  );
  const availableOrganizations = organizations.filter(
    (org): org is NonNullable<typeof org> => org !== null
  );

  const requestedOrgId = typeof params.organizationId === "string" ? params.organizationId : undefined;
  const requestedTab = normalizeTab(typeof params.tab === "string" ? params.tab : undefined);
  const requestedProjectId = typeof params.projectId === "string" ? params.projectId : undefined;

  const selectedOrganization =
    availableOrganizations.find((org) => org.id === requestedOrgId) ??
    availableOrganizations[0] ??
    null;

  const projectList = selectedOrganization
    ? await listProjects({ organizationId: selectedOrganization.id, limit: 200 }).catch(() => null)
    : null;

  const selectedProject =
    projectList?.items.find((p) => p.id === requestedProjectId) ??
    projectList?.items[0] ??
    null;

  const currentTarget = selectedOrganization
    ? await getOrganizationAlertTarget(selectedOrganization.id).catch(() => null)
    : null;

  const testMessage = typeof params.testMessage === "string" ? decodeURIComponent(params.testMessage) : null;
  const testSuccess = params.testSuccess === "true";

  async function saveTargetAction(formData: FormData) {
    "use server";
    const organizationId = String(formData.get("organization_id") ?? "");
    const channelTarget = String(formData.get("channel_target") ?? "");
    const slackWebhookUrl = String(formData.get("slack_webhook_url") ?? "").trim();
    const isActive = formData.get("is_active") === "on";

    await upsertOrganizationAlertTarget(organizationId, {
      channel_target: channelTarget,
      ...(slackWebhookUrl ? { slack_webhook_url: slackWebhookUrl } : {}),
      is_active: isActive,
    });

    revalidatePath("/settings");
    redirect(`/settings?tab=alerts&organizationId=${encodeURIComponent(organizationId)}`);
  }

  async function enableTargetAction(formData: FormData) {
    "use server";
    const organizationId = String(formData.get("organization_id") ?? "");
    await enableOrganizationAlertTarget(organizationId);
    revalidatePath("/settings");
    redirect(`/settings?tab=alerts&organizationId=${encodeURIComponent(organizationId)}`);
  }

  async function disableTargetAction(formData: FormData) {
    "use server";
    const organizationId = String(formData.get("organization_id") ?? "");
    await disableOrganizationAlertTarget(organizationId);
    revalidatePath("/settings");
    redirect(`/settings?tab=alerts&organizationId=${encodeURIComponent(organizationId)}`);
  }

  async function testTargetAction(formData: FormData) {
    "use server";
    const organizationId = String(formData.get("organization_id") ?? "");
    const result = await testOrganizationAlertTarget(organizationId);
    revalidatePath("/settings");
    redirect(
      `/settings?tab=alerts&organizationId=${encodeURIComponent(organizationId)}&testSuccess=${String(result.success)}&testMessage=${encodeURIComponent(result.detail)}`
    );
  }

  async function updateOrganizationAction(formData: FormData) {
    "use server";
    const organizationId = String(formData.get("organization_id") ?? "");
    const name = String(formData.get("name") ?? "").trim();
    const slug = String(formData.get("slug") ?? "").trim();

    await updateOrganization(organizationId, {
      name: name || undefined,
      slug: slug || undefined,
    });

    revalidatePath("/settings");
    redirect(`/settings?tab=organization&organizationId=${encodeURIComponent(organizationId)}`);
  }

  async function updateProjectAction(formData: FormData) {
    "use server";
    const projectId = String(formData.get("project_id") ?? "");
    const name = String(formData.get("name") ?? "").trim();
    const slug = String(formData.get("slug") ?? "").trim();
    const description = String(formData.get("description") ?? "").trim();

    await updateProject(projectId, {
      name: name || undefined,
      slug: slug || undefined,
      description: description || null,
    });

    revalidatePath("/settings");
    revalidatePath(`/projects/${projectId}/settings`);
    redirect(`/settings?tab=project&projectId=${encodeURIComponent(projectId)}`);
  }

  const isSystemAdmin = session.operator.is_system_admin;

  const tabs: { label: string; value: Tab }[] = [
    { label: "Project settings", value: "project" },
    { label: "Organization settings", value: "organization" },
    { label: "Alert settings", value: "alerts" },
    ...(isSystemAdmin ? [{ label: "System", value: "system" } as const] : []),
  ];

  const systemLinks = [
    { href: "/system/pipeline", icon: Server, label: "Pipeline", description: "Ingestion pipeline health" },
    { href: "/system/extensions", icon: Server, label: "Extensions", description: "Processor extensions" },
    { href: "/system/customers", icon: Users, label: "Customers", description: "Customer expansion" },
    { href: "/system/growth", icon: Users, label: "Growth", description: "Tenant growth" },
    { href: "/system/expansion", icon: Users, label: "Expansion", description: "Expansion metrics" },
    { href: "/system/platform", icon: Server, label: "Platform", description: "Platform reliability" },
    { href: "/system/reliability-patterns", icon: Building2, label: "Reliability", description: "System-level patterns" },
    { href: "/system/intelligence", icon: Building2, label: "Intelligence", description: "Reliability intelligence" },
  ];

  return (
    <div className="min-h-full">
      <PageHeader
        title="Settings"
        description="Manage project and organization profile data alongside the org-level alert target."
        right={
          selectedOrganization ? (
            <div className="rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-3 text-sm text-zinc-400">
              Active org · {selectedOrganization.name}
            </div>
          ) : null
        }
      />

      <div className="p-6 space-y-6">
        {/* Tab navigation */}
        <div className="flex flex-wrap gap-2">
          {tabs.map((tab) => (
            <a
              key={tab.value}
              href={`/settings?tab=${tab.value}${
                tab.value === "project" && selectedProject
                  ? `&projectId=${encodeURIComponent(selectedProject.id)}`
                  : tab.value !== "project" && selectedOrganization
                  ? `&organizationId=${encodeURIComponent(selectedOrganization.id)}`
                  : ""
              }`}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
                requestedTab === tab.value
                  ? "bg-zinc-100 text-zinc-900"
                  : "border border-zinc-800 bg-zinc-900 text-zinc-400 hover:text-zinc-100"
              }`}
            >
              {tab.label}
            </a>
          ))}
        </div>

        {/* Test message */}
        {testMessage && (
          <Card className={`p-4 ${
            testSuccess ? "border-emerald-500/30 bg-emerald-500/10" : "border-red-500/30 bg-red-500/10"
          }`}>
            <p className="text-sm font-medium text-zinc-100">
              {testSuccess ? "Slack test succeeded" : "Slack test failed"}
            </p>
            <p className="mt-2 text-sm text-zinc-400">{testMessage}</p>
          </Card>
        )}

        {/* Project settings tab */}
        {requestedTab === "project" && (
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
            <Card className="p-6">
              <SectionLabel>Project settings</SectionLabel>
              <p className="mt-2 text-sm leading-6 text-zinc-400">
                Update project name, slug, and description for the active workspace.
              </p>

              {projectList && projectList.items.length > 1 && (
                <form action="/settings" className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <p className="text-sm font-medium text-zinc-100">Project</p>
                    <p className="mt-1 text-sm text-zinc-400">Choose a project to edit.</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <input type="hidden" name="tab" value="project" />
                    <select
                      name="projectId"
                      defaultValue={selectedProject?.id}
                      className="h-10 rounded-lg border border-zinc-700 bg-zinc-900 px-3 text-sm text-zinc-100"
                    >
                      {projectList.items.map((project) => (
                        <option key={project.id} value={project.id}>
                          {project.name}
                        </option>
                      ))}
                    </select>
                    <button
                      type="submit"
                      className="rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2 text-sm font-medium text-zinc-100 hover:bg-zinc-700"
                    >
                      Switch
                    </button>
                  </div>
                </form>
              )}

              {selectedProject ? (
                <form action={updateProjectAction} className="mt-6 space-y-4">
                  <input type="hidden" name="project_id" value={selectedProject.id} />
                  <label className="block space-y-2 text-sm text-zinc-400">
                    <span className="text-xs uppercase tracking-[0.2em] text-zinc-500">Name</span>
                    <input
                      name="name"
                      defaultValue={selectedProject.name}
                      className="h-11 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 text-sm text-zinc-100"
                    />
                  </label>
                  <label className="block space-y-2 text-sm text-zinc-400">
                    <span className="text-xs uppercase tracking-[0.2em] text-zinc-500">Slug</span>
                    <input
                      name="slug"
                      defaultValue={selectedProject.slug}
                      className="h-11 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 text-sm text-zinc-100"
                    />
                  </label>
                  <label className="block space-y-2 text-sm text-zinc-400">
                    <span className="text-xs uppercase tracking-[0.2em] text-zinc-500">Description</span>
                    <textarea
                      name="description"
                      defaultValue={selectedProject.description ?? ""}
                      rows={4}
                      className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
                    />
                  </label>
                  <button
                    type="submit"
                    className="rounded-lg bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-900 hover:bg-zinc-200"
                  >
                    Save project
                  </button>
                </form>
              ) : (
                <p className="mt-6 text-sm text-zinc-400">No projects are available for this organization yet.</p>
              )}
            </Card>

            {selectedProject && (
              <Card className="p-6">
                <SectionLabel>Project metadata</SectionLabel>
                <div className="mt-4 space-y-3 text-sm text-zinc-400">
                  <div className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-3">
                    <span className="text-xs uppercase tracking-[0.2em] text-zinc-500">Project ID</span>
                    <span className="text-sm font-medium text-zinc-100">{selectedProject.id}</span>
                  </div>
                  <div className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-3">
                    <span className="text-xs uppercase tracking-[0.2em] text-zinc-500">Environment</span>
                    <span className="text-sm font-medium text-zinc-100">{selectedProject.environment}</span>
                  </div>
                </div>
              </Card>
            )}
          </div>
        )}

        {/* Organization settings tab */}
        {requestedTab === "organization" && selectedOrganization && (
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
            <Card className="p-6">
              <SectionLabel>Organization settings</SectionLabel>
              <p className="mt-2 text-sm leading-6 text-zinc-400">
                Update the workspace profile used for billing and alert ownership.
              </p>

              {availableOrganizations.length > 1 && (
                <form action="/settings" className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <p className="text-sm font-medium text-zinc-100">Organization</p>
                    <p className="mt-1 text-sm text-zinc-400">Choose the organization to edit.</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <input type="hidden" name="tab" value="organization" />
                    <select
                      name="organizationId"
                      defaultValue={selectedOrganization.id}
                      className="h-10 rounded-lg border border-zinc-700 bg-zinc-900 px-3 text-sm text-zinc-100"
                    >
                      {availableOrganizations.map((org) => (
                        <option key={org.id} value={org.id}>
                          {org.name}
                        </option>
                      ))}
                    </select>
                    <button
                      type="submit"
                      className="rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2 text-sm font-medium text-zinc-100 hover:bg-zinc-700"
                    >
                      Switch
                    </button>
                  </div>
                </form>
              )}

              <form action={updateOrganizationAction} className="mt-6 space-y-4">
                <input type="hidden" name="organization_id" value={selectedOrganization.id} />
                <label className="block space-y-2 text-sm text-zinc-400">
                  <span className="text-xs uppercase tracking-[0.2em] text-zinc-500">Name</span>
                  <input
                    name="name"
                    defaultValue={selectedOrganization.name}
                    className="h-11 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 text-sm text-zinc-100"
                  />
                </label>
                <label className="block space-y-2 text-sm text-zinc-400">
                  <span className="text-xs uppercase tracking-[0.2em] text-zinc-500">Slug</span>
                  <input
                    name="slug"
                    defaultValue={selectedOrganization.slug}
                    className="h-11 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 text-sm text-zinc-100"
                  />
                </label>
                <button
                  type="submit"
                  className="rounded-lg bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-900 hover:bg-zinc-200"
                >
                  Save organization
                </button>
              </form>
            </Card>

            <Card className="p-6">
              <SectionLabel>Organization metadata</SectionLabel>
              <div className="mt-4 space-y-3 text-sm text-zinc-400">
                <div className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-3">
                  <span className="text-xs uppercase tracking-[0.2em] text-zinc-500">Organization ID</span>
                  <span className="text-sm font-medium text-zinc-100">{selectedOrganization.id}</span>
                </div>
                <div className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-3">
                  <span className="text-xs uppercase tracking-[0.2em] text-zinc-500">Plan</span>
                  <span className="text-sm font-medium text-zinc-100">{selectedOrganization.plan}</span>
                </div>
              </div>
            </Card>
          </div>
        )}

        {/* Alert settings tab */}
        {requestedTab === "alerts" && selectedOrganization && (
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
            <Card className="p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <SectionLabel>Slack target</SectionLabel>
                  <h2 className="mt-2 text-2xl font-semibold text-zinc-100">
                    {currentTarget ? currentTarget.channel_target : "No target configured"}
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-zinc-400">
                    Save one org-level Slack webhook. Leave the webhook field blank during update to keep the existing secret unchanged.
                  </p>
                </div>
                <BellRing className="h-5 w-5 text-zinc-400" />
              </div>

              {availableOrganizations.length > 1 && (
                <form action="/settings" className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <p className="text-sm font-medium text-zinc-100">Organization</p>
                    <p className="mt-1 text-sm text-zinc-400">Choose the org for alert settings.</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <input type="hidden" name="tab" value="alerts" />
                    <select
                      name="organizationId"
                      defaultValue={selectedOrganization.id}
                      className="h-10 rounded-lg border border-zinc-700 bg-zinc-900 px-3 text-sm text-zinc-100"
                    >
                      {availableOrganizations.map((org) => (
                        <option key={org.id} value={org.id}>
                          {org.name}
                        </option>
                      ))}
                    </select>
                    <button
                      type="submit"
                      className="rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2 text-sm font-medium text-zinc-100 hover:bg-zinc-700"
                    >
                      Switch
                    </button>
                  </div>
                </form>
              )}

              <form action={saveTargetAction} className="mt-6 space-y-4">
                <input type="hidden" name="organization_id" value={selectedOrganization.id} />
                <div className="grid gap-4 lg:grid-cols-2">
                  <label className="space-y-2">
                    <span className="text-sm font-medium text-zinc-100">Target label</span>
                    <input
                      name="channel_target"
                      required
                      defaultValue={currentTarget?.channel_target ?? "org:primary-slack"}
                      className="h-11 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 text-sm text-zinc-100"
                    />
                  </label>
                  <label className="space-y-2">
                    <span className="text-sm font-medium text-zinc-100">Webhook URL</span>
                    <input
                      name="slack_webhook_url"
                      type="url"
                      placeholder={currentTarget?.has_secret ? "Leave blank to keep current webhook" : "https://hooks.slack.com/..."}
                      className="h-11 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 text-sm text-zinc-100"
                    />
                  </label>
                </div>

                <label className="flex items-center gap-3 rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-zinc-100">
                  <input
                    type="checkbox"
                    name="is_active"
                    defaultChecked={currentTarget?.is_active ?? true}
                    className="h-4 w-4 rounded border-zinc-600"
                  />
                  Enable this org-level Slack target for incident alerts
                </label>

                <button
                  type="submit"
                  className="rounded-lg bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-900 hover:bg-zinc-200"
                >
                  Save target
                </button>
              </form>
            </Card>

            <div className="space-y-6">
              <Card className="p-6">
                <SectionLabel>Current state</SectionLabel>
                <div className="mt-4 space-y-4">
                  <div className="rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-3">
                    <p className="text-sm font-medium text-zinc-100">Delivery status</p>
                    <p className="mt-2 text-sm text-zinc-400">
                      {currentTarget
                        ? currentTarget.is_active
                          ? "Enabled for incident delivery"
                          : "Configured but disabled"
                        : "No Slack target configured"}
                    </p>
                  </div>
                  <div className="rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-3">
                    <p className="text-sm font-medium text-zinc-100">Stored secret</p>
                    <p className="mt-2 text-sm text-zinc-400">{currentTarget?.webhook_masked ?? "No webhook stored"}</p>
                  </div>
                </div>
              </Card>

              {currentTarget && (
                <Card className="p-6">
                  <SectionLabel>Quick actions</SectionLabel>
                  <div className="mt-4 flex flex-wrap gap-3">
                    <form action={currentTarget.is_active ? disableTargetAction : enableTargetAction}>
                      <input type="hidden" name="organization_id" value={selectedOrganization.id} />
                      <button
                        type="submit"
                        className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium ${
                          currentTarget.is_active
                            ? "border border-zinc-700 bg-zinc-800 text-zinc-100 hover:bg-zinc-700"
                            : "bg-zinc-100 text-zinc-900 hover:bg-zinc-200"
                        }`}
                      >
                        {currentTarget.is_active ? (
                          <>
                            <Slash className="h-4 w-4" />
                            Disable target
                          </>
                        ) : (
                          <>
                            <ShieldCheck className="h-4 w-4" />
                            Enable target
                          </>
                        )}
                      </button>
                    </form>
                    <form action={testTargetAction}>
                      <input type="hidden" name="organization_id" value={selectedOrganization.id} />
                      <button
                        type="submit"
                        className="flex items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2 text-sm font-medium text-zinc-100 hover:bg-zinc-700"
                      >
                        <RadioTower className="h-4 w-4" />
                        Send test
                      </button>
                    </form>
                  </div>
                </Card>
              )}
            </div>
          </div>
        )}

        {requestedTab === "alerts" && !selectedOrganization && (
          <Card className="p-6">
            <p className="text-sm text-zinc-400">No organization memberships were found for this operator.</p>
          </Card>
        )}

        {/* System Admin tab */}
        {requestedTab === "system" && isSystemAdmin && (
          <div className="grid gap-6 xl:grid-cols-2">
            <Card className="p-6">
              <SectionLabel>Platform Health</SectionLabel>
              <div className="mt-4 divide-y divide-zinc-800">
                {systemLinks.slice(0, 4).map((link) => (
                  <a
                    key={link.href}
                    href={link.href}
                    className="flex items-center gap-4 py-4 hover:bg-zinc-800/50 transition-colors"
                  >
                    <link.icon className="w-5 h-5 text-zinc-400" />
                    <div className="flex-1">
                      <div className="text-sm font-medium text-zinc-100">{link.label}</div>
                      <div className="text-xs text-zinc-400">{link.description}</div>
                    </div>
                  </a>
                ))}
              </div>
            </Card>

            <Card className="p-6">
              <SectionLabel>Intelligence</SectionLabel>
              <div className="mt-4 divide-y divide-zinc-800">
                {systemLinks.slice(4).map((link) => (
                  <a
                    key={link.href}
                    href={link.href}
                    className="flex items-center gap-4 py-4 hover:bg-zinc-800/50 transition-colors"
                  >
                    <link.icon className="w-5 h-5 text-zinc-400" />
                    <div className="flex-1">
                      <div className="text-sm font-medium text-zinc-100">{link.label}</div>
                      <div className="text-xs text-zinc-400">{link.description}</div>
                    </div>
                  </a>
                ))}
              </div>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
