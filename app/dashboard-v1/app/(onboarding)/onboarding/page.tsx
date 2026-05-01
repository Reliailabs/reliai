import Link from "next/link";
import { redirect } from "next/navigation";
import { CheckCircle2, CircleDashed, KeyRound, Network, Radar } from "lucide-react";

import { PageHeader } from "@/components/ui/page-header";
import { SectionLabel } from "@/components/ui/heading";
import { OnboardingSimulationRunner } from "@/components/onboarding/onboarding-simulation-runner";
import { createApiKey, createOrganization, createProject, getProjects, getTraces } from "@/lib/api";
import { getOperatorSession, requireOperatorSession, switchOrganization } from "@/lib/auth";

function slugify(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)+/g, "");
}

function defaultOrgName(email?: string | null) {
  if (!email) return "Reliai Workspace";
  const domain = email.split("@")[1];
  if (!domain) return "Reliai Workspace";
  const label = domain.split(".")[0] || "Reliai";
  return `${label.charAt(0).toUpperCase()}${label.slice(1)} Workspace`;
}

const stepConfig = [
  { label: "Create organization", icon: Network },
  { label: "Create project", icon: CircleDashed },
  { label: "Generate API key", icon: KeyRound },
  { label: "Send first trace", icon: Radar },
] as const;

type OnboardingPath = "choose" | "sdk" | "simulation";

function normalizePath(value: string | undefined): OnboardingPath {
  if (value === "sdk" || value === "simulation") return value;
  return "choose";
}

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ path?: string; api_key?: string }>;
}) {
  const { path, api_key: apiKeyParam } = await searchParams;
  const selectedPath = normalizePath(path);
  const apiKeyValue = typeof apiKeyParam === "string" && apiKeyParam.length ? apiKeyParam : null;

  const session = await getOperatorSession();
  if (!session) {
    redirect("/sign-in");
  }

  const defaultName = defaultOrgName(session.operator.email);
  const defaultSlug = slugify(defaultName);
  const organizationId = session.active_organization_id ?? session.memberships[0]?.organization_id ?? null;
  const projectList = organizationId ? await getProjects().catch(() => ({ items: [] })) : { items: [] };
  const primaryProject = projectList.items[0] ?? null;
  const traceList = primaryProject ? await getTraces({ project_id: primaryProject.id, limit: 1 }).catch(() => ({ items: [] })) : { items: [] };
  const hasOrganization = Boolean(organizationId);
  const hasProject = Boolean(primaryProject);
  const hasTrace = Boolean(traceList.items?.length);
  const apiKeyCreated = Boolean(apiKeyValue) || hasTrace;

  const activeOrgName = organizationId 
    ? session.memberships.find(m => m.organization_id === organizationId)?.organization_name ?? "Organization"
    : "None";

  const steps = [
    { state: hasOrganization ? "done" : "current" },
    { state: hasOrganization ? (hasProject ? "done" : "current") : "next" },
    { state: hasOrganization && hasProject ? (apiKeyCreated ? "done" : "current") : "next" },
    { state: hasOrganization && hasProject && apiKeyCreated ? (hasTrace ? "done" : "current") : "next" },
  ] as const;

  async function createOrganizationAction(formData: FormData) {
    "use server";
    const session = await requireOperatorSession();
    const nameInput = String(formData.get("name") ?? "").trim();
    const slugInput = String(formData.get("slug") ?? "").trim();
    const finalName = nameInput || defaultOrgName(session.operator.email);
    const finalSlug = slugify(slugInput || finalName);
    if (!finalName || !finalSlug) return;
    const organization = await createOrganization({
      name: finalName,
      slug: finalSlug,
      plan: "free",
      owner_auth_user_id: session.operator.id,
      owner_role: "owner",
    });
    await switchOrganization(organization.id);
    redirect("/onboarding?path=sdk");
  }

  async function createProjectAction(formData: FormData) {
    "use server";
    const session = await requireOperatorSession();
    const orgId = session.active_organization_id ?? session.memberships[0]?.organization_id ?? null;
    if (!orgId) return;
    const nameInput = String(formData.get("project_name") ?? "").trim();
    const envInput = String(formData.get("environment") ?? "prod").trim();
    const environment = envInput === "staging" || envInput === "dev" ? envInput : "prod";
    const finalName = nameInput || "Production";
    await createProject(orgId, { name: finalName, slug: slugify(finalName), environment: environment as "prod" | "staging" | "dev", description: "Onboarding project" });
    redirect("/onboarding?path=sdk");
  }

  async function createApiKeyAction() {
    "use server";
    const session = await requireOperatorSession();
    const orgId = session.active_organization_id ?? session.memberships[0]?.organization_id ?? null;
    if (!orgId) return;
    const projList = await getProjects().catch(() => ({ items: [] }));
    const projId = projList.items[0]?.id ?? null;
    if (!projId) return;
    const apiKeyResponse = await createApiKey(projId, { label: "Onboarding ingest" });
    const apiKey = apiKeyResponse?.api_key;
    if (!apiKey) { redirect("/onboarding?path=sdk"); }
    redirect(`/onboarding?path=sdk&api_key=${encodeURIComponent(apiKey)}`);
  }

  return (
    <div className="min-h-full p-6 space-y-6">
      <PageHeader
        title="Quick start"
        description="Connect your live system or run a guided simulation to experience the incident workflow."
        right={
          <div className="flex gap-2">
            <Link href="/onboarding" className={`px-3 py-1.5 text-xs rounded-md transition ${selectedPath === "choose" ? "bg-zinc-100 text-zinc-900" : "text-zinc-400 hover:text-zinc-100"}`}>Choose</Link>
            <Link href="/onboarding?path=sdk" className={`px-3 py-1.5 text-xs rounded-md transition ${selectedPath === "sdk" ? "bg-zinc-100 text-zinc-900" : "text-zinc-400 hover:text-zinc-100"}`}>SDK</Link>
            <Link href="/onboarding?path=simulation" className={`px-3 py-1.5 text-xs rounded-md transition ${selectedPath === "simulation" ? "bg-zinc-100 text-zinc-900" : "text-zinc-400 hover:text-zinc-100"}`}>Simulation</Link>
            <Link href="/pulse" className="px-3 py-1.5 text-xs rounded-md text-zinc-400 hover:text-zinc-300 transition">Skip</Link>
          </div>
        }
      />

      {/* Step indicators */}
      <div className="grid gap-4 lg:grid-cols-4">
        {stepConfig.map((step, index) => {
          const stepState = steps[index].state;
          const Icon = step.icon;
          return (
            <div key={step.label} className={`rounded-lg border p-4 ${stepState === "done" ? "border-emerald-500/30 bg-emerald-500/10" : stepState === "current" ? "border-zinc-500 bg-zinc-900" : "border-zinc-800 bg-zinc-950"}`}>
              <div className="flex items-center gap-2">
                {stepState === "done" ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <Icon className="w-4 h-4 text-zinc-500" />}
                <span className={`text-xs font-medium ${stepState === "done" ? "text-emerald-400" : stepState === "current" ? "text-zinc-100" : "text-zinc-600"}`}>{index + 1}. {step.label}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Choose path */}
      {selectedPath === "choose" && (
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-6">
            <SectionLabel>Option 1</SectionLabel>
            <h2 className="mt-2 text-xl font-semibold text-zinc-100">Connect your SDK</h2>
            <p className="mt-2 text-sm text-zinc-400">Install the SDK and send traces from your own environment. This path is best when you already have traffic and want production signals immediately.</p>
            <Link href="/onboarding?path=sdk" className="mt-4 inline-flex rounded-lg bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-900 hover:bg-zinc-200 transition">Connect SDK</Link>
          </div>
          <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-6">
            <SectionLabel>Option 2</SectionLabel>
            <h2 className="mt-2 text-xl font-semibold text-zinc-100">Try a guided simulation</h2>
            <p className="mt-2 text-sm text-zinc-400">See a hallucination spike — detected at 19%, root-caused to prompt v42, and fixed in 6 minutes. The same incident you saw on the homepage, live in the product.</p>
            <Link href="/onboarding?path=simulation" className="mt-4 inline-flex rounded-lg bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-900 hover:bg-zinc-200 transition">Start simulation</Link>
          </div>
        </div>
      )}

      {/* SDK path */}
      {selectedPath === "sdk" && (
        <div className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-[1.2fr_380px]">
            <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-6">
              <SectionLabel>Connect your app</SectionLabel>
              <h2 className="mt-3 text-2xl font-semibold text-zinc-100">Install SDK and send first traces</h2>
              <p className="mt-2 text-sm text-zinc-400">Use this setup checklist to create a workspace, issue a key, and verify ingestion.</p>

              <div className="mt-8 space-y-4">
                {stepConfig.map((step, index) => {
                  const stepState = steps[index].state;
                  const Icon = step.icon;
                  const isDone = stepState === "done";
                  const isCurrent = stepState === "current";
                  return (
                    <div key={step.label} className={`grid gap-4 rounded-lg border px-4 py-4 md:grid-cols-[48px_1fr_auto] ${isDone ? "border-emerald-500/30 bg-emerald-500/10" : isCurrent ? "border-zinc-700 bg-zinc-950" : "border-zinc-800 bg-zinc-950 opacity-50"}`}>
                      <div className={`flex h-12 w-12 items-center justify-center rounded-lg ${isDone ? "bg-emerald-500/20" : isCurrent ? "bg-zinc-800" : "bg-zinc-900"}`}>
                        <Icon className={`h-5 w-5 ${isDone ? "text-emerald-400" : isCurrent ? "text-zinc-400" : "text-zinc-700"}`} />
                      </div>
                      <div>
                        <p className="text-sm text-zinc-400">Step {index + 1}</p>
                        <h3 className="mt-1 text-lg font-semibold text-zinc-100">{step.label}</h3>
                        {index === 0 && !hasOrganization && (
                          <form action={createOrganizationAction} className="mt-3 space-y-2">
                            <input name="name" defaultValue={defaultName} placeholder="Organization name" className="w-full rounded border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100" />
                            <input name="slug" defaultValue={defaultSlug} placeholder="Slug" className="w-full rounded border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100" />
                            <button type="submit" className="rounded bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-900">Create</button>
                          </form>
                        )}
                        {index === 1 && hasOrganization && !hasProject && (
                          <form action={createProjectAction} className="mt-3 space-y-2">
                            <input name="project_name" placeholder="Production" className="w-full rounded border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100" />
                            <select name="environment" defaultValue="prod" className="w-full rounded border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100">
                              <option value="prod">Production</option>
                              <option value="staging">Staging</option>
                              <option value="dev">Development</option>
                            </select>
                            <button type="submit" className="rounded bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-900">Create</button>
                          </form>
                        )}
                        {index === 2 && hasProject && !apiKeyCreated && (
                          <form action={createApiKeyAction} className="mt-3">
                            <button type="submit" className="rounded bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-900">Generate API key</button>
                          </form>
                        )}
                      </div>
                      <div className="flex items-center">
                        {isDone ? <span className="rounded-full bg-emerald-500/20 px-3 py-1 text-xs font-medium text-emerald-400">Complete</span> : isCurrent ? <span className="rounded-full bg-amber-500/20 px-3 py-1 text-xs font-medium text-amber-400">Current</span> : <span className="rounded-full border border-zinc-700 px-3 py-1 text-xs font-medium text-zinc-600">Pending</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="space-y-6">
              {apiKeyValue && (
                <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-6">
                  <SectionLabel className="text-emerald-400">API key generated</SectionLabel>
                  <h2 className="mt-2 text-lg font-semibold text-zinc-100">API key (copy once)</h2>
                  <div className="mt-2 rounded bg-zinc-950 px-3 py-2 text-sm text-zinc-100 font-mono break-all">{apiKeyValue}</div>
                </div>
              )}
              <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-6">
                <SectionLabel>Ingest example</SectionLabel>
                <h2 className="mt-2 text-lg font-semibold text-zinc-100">Send your first trace</h2>
                <pre className="mt-4 rounded bg-zinc-950 p-4 text-xs text-zinc-300 overflow-x-auto font-mono">{`curl -X POST http://localhost:8000/api/v1/ingest/traces \\
  -H "x-api-key: ${apiKeyValue ?? "reliai_..."}" \\
  -H "content-type: application/json" \\
  -d '{"timestamp":"2026-03-09T12:00:00Z","request_id":"req_123","model_name":"gpt-4.1-mini","success":true}'`}</pre>
              </div>
              {hasTrace && <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-400">First trace received for {primaryProject?.name}. You can now open incidents.</div>}
            </div>
          </div>

          {/* Organization section - always visible at bottom */}
          <div className="rounded-lg border border-zinc-800 bg-zinc-900 px-6 py-4">
            <SectionLabel>Organization</SectionLabel>
            <p className="mt-2 text-sm text-zinc-400">Active: <span className="font-medium text-zinc-100">{activeOrgName}</span></p>
            <p className="mt-2 text-sm text-zinc-400">{hasOrganization ? "You can create another organization at any time." : "Create your first organization to start."}</p>
            <form action={createOrganizationAction} className="mt-4 grid gap-3 md:grid-cols-2">
              <div>
                <label className="block text-xs text-zinc-500 mb-1">Organization name</label>
                <input name="name" defaultValue={defaultName} className="h-11 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 text-sm text-zinc-100" />
              </div>
              <div>
                <label className="block text-xs text-zinc-500 mb-1">Slug</label>
                <input name="slug" defaultValue={defaultSlug} className="h-11 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 text-sm text-zinc-100" />
              </div>
              <div className="md:col-span-2 flex flex-wrap gap-2">
                <button type="submit" className="rounded-lg bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-900 hover:bg-zinc-200 transition">{hasOrganization ? "Create another organization" : "Create organization"}</button>
                <Link href="/organization/settings" className="rounded-lg border border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-300 hover:bg-zinc-800 transition">Manage organizations</Link>
                {hasProject && (
                  <Link href={`/projects/${primaryProject?.id}/settings`} className="rounded-lg border border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-300 hover:bg-zinc-800 transition">Edit project</Link>
                )}
                {!hasProject && hasOrganization && (
                  <Link href="/projects" className="rounded-lg border border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-300 hover:bg-zinc-800 transition">View projects</Link>
                )}
                <Link href="/onboarding?path=simulation" className="rounded-lg border border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-300 hover:bg-zinc-800 transition">Run simulation instead</Link>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Simulation path */}
      {selectedPath === "simulation" && (
        hasOrganization && hasProject ? (
          <OnboardingSimulationRunner defaultProjectName="onboarding-simulation" autoStart />
        ) : (
          <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-6">
            <SectionLabel>Guided simulation</SectionLabel>
            <h2 className="mt-2 text-xl font-semibold text-zinc-100">See your first AI incident in under 2 minutes</h2>
            <p className="mt-2 text-sm text-zinc-400">We simulate a realistic failure, open an incident automatically, and walk you through root cause and resolution impact.</p>
            <div className="mt-4 grid gap-2 text-sm text-zinc-400">
              <p>1. Hallucination spike detected — 19% failure rate vs 4% baseline.</p>
              <p>2. Root cause scored — prompt v42 identified at 71% confidence.</p>
              <p>3. Fix verified — failure rate reduced from 19% to 5% after reverting.</p>
            </div>
            {!hasOrganization && <div className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-400">Please create an organization and project first using the SDK path.</div>}
          </div>
        )
      )}
    </div>
  );
}