import Link from "next/link";
import { redirect } from "next/navigation";
import { CheckCircle2, CircleDashed, KeyRound, Network, Radar } from "lucide-react";
import type { Route } from "next";

import { OnboardingPathTracker } from "@/components/onboarding/onboarding-path-tracker";
import { OnboardingSimulationRunner } from "@/components/onboarding/onboarding-simulation-runner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { createApiKey, createOrganization, createProject, listProjects, listTraces } from "@/lib/api";
import { getOperatorSession, requireOperatorSession, switchOrganization } from "@/lib/auth";

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
}

function defaultOrgName(email?: string | null) {
  if (!email) return "Reliai Workspace";
  const domain = email.split("@")[1];
  if (!domain) return "Reliai Workspace";
  const label = domain.split(".")[0] || "Reliai";
  return `${label.charAt(0).toUpperCase()}${label.slice(1)} Workspace`;
}

const stepConfig = [
  {
    label: "Create organization",
    icon: Network,
    detail: "Register the tenant root used to scope projects, members, and onboarding.",
  },
  {
    label: "Create project",
    icon: CircleDashed,
    detail: "Provision a production, staging, or development project inside the organization.",
  },
  {
    label: "Generate API key",
    icon: KeyRound,
    detail: "Issue a project-scoped ingest key. The secret is revealed once.",
  },
  {
    label: "Send first trace",
    icon: Radar,
    detail: "POST a minimal trace payload to the ingestion endpoint and verify acceptance.",
  },
] as const;

type OnboardingPath = "choose" | "sdk" | "simulation";

function normalizePath(value: string | undefined): OnboardingPath {
  if (value === "sdk" || value === "simulation") return value;
  return "choose";
}

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ path?: string; autostart?: string; api_key?: string }>;
}) {
  const { path, autostart, api_key: apiKeyParam } = await searchParams;
  const selectedPath = normalizePath(path);
  const autoStartSimulation = autostart === "1" || autostart === "true";
  const apiKeyValue = typeof apiKeyParam === "string" && apiKeyParam.length ? apiKeyParam : null;

  const maybeSession = await getOperatorSession();
  const returnTo = "/onboarding?path=simulation&autostart=1";
  const signInHref = `/sign-in?return_to=${encodeURIComponent(returnTo)}` as Route;
  if (!maybeSession && autoStartSimulation) {
    redirect(signInHref);
  }
  if (!maybeSession) {
    return (
      <div className="space-y-6">
        <Card className="p-6">
          <p className="text-xs uppercase tracking-[0.24em] text-secondary">Guided simulation</p>
          <h1 className="mt-3 text-3xl font-semibold text-primary">See your first AI incident in under 2 minutes</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-secondary">
            We simulate a realistic failure, open an incident automatically, and walk you through
            root cause and resolution impact. No SDK required.
          </p>
          <div className="mt-4 grid gap-2 text-sm text-secondary">
            <p>1. Hallucination spike detected — 19% failure rate vs 4% baseline.</p>
            <p>2. Root cause scored — prompt v42 identified at 71% confidence.</p>
            <p>3. Fix verified — failure rate reduced from 19% → 5% after reverting.</p>
          </div>
          <div className="mt-6 flex flex-wrap gap-2">
            <Button asChild>
              <Link href={signInHref}>Start guided simulation</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/sign-in">Sign in</Link>
            </Button>
          </div>
        </Card>

        <Card className="p-5">
          <p className="text-xs uppercase tracking-[0.24em] text-secondary">What you will see</p>
          <div className="mt-3 grid gap-4 md:grid-cols-3">
            <div>
              <p className="text-sm font-semibold text-primary">Trigger</p>
              <p className="mt-1 text-sm text-secondary">A hallucination spike triggers an incident automatically when behavior deviates.</p>
            </div>
            <div>
              <p className="text-sm font-semibold text-amber-700">Root Cause</p>
              <p className="mt-1 text-sm text-secondary">Prompt rollout identified as primary driver — 71% confidence, 82 minutes before incident.</p>
            </div>
            <div>
              <p className="text-sm font-semibold text-green-700">Impact</p>
              <p className="mt-1 text-sm text-secondary">Failure rate reduced from <span className="font-semibold text-danger">19%</span> → <span className="font-semibold text-success">5%</span> after reverting prompt v42.</p>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  const session = await requireOperatorSession();
  const defaultName = defaultOrgName(session.operator.email);
  const defaultSlug = slugify(defaultName);
  const organizationId = session.active_organization_id ?? session.memberships[0]?.organization_id ?? null;
  const activeMembership =
    session.memberships.find((membership) => membership.organization_id === organizationId) ?? null;
  const activeOrganizationLabel =
    activeMembership?.organization_name ?? organizationId ?? "Active organization";
  const projectList = organizationId
    ? await listProjects({ organizationId, limit: 1 }).catch(() => null)
    : null;
  const primaryProjectId = projectList?.items[0]?.id ?? null;
  const primaryProject = projectList?.items[0] ?? null;
  const traceList = primaryProjectId
    ? await listTraces({ projectId: primaryProjectId, limit: 1 }).catch(() => null)
    : null;
  const hasOrganization = Boolean(organizationId);
  const hasProject = Boolean(primaryProjectId);
  const hasTrace = Boolean(traceList?.items?.length);
  const apiKeyCreated = Boolean(apiKeyValue) || hasTrace;

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
    const fallbackName = defaultOrgName(session.operator.email);
    const finalName = nameInput || fallbackName;
    const finalSlug = slugify(slugInput || finalName);

    if (!finalName || !finalSlug) {
      return;
    }

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
    const organizationId = session.active_organization_id ?? session.memberships[0]?.organization_id ?? null;
    if (!organizationId) return;

    const nameInput = String(formData.get("project_name") ?? "").trim();
    const environmentInput = String(formData.get("environment") ?? "prod").trim();
    const environment =
      environmentInput === "staging" || environmentInput === "dev" ? environmentInput : "prod";
    const fallbackName = "Production";
    const finalName = nameInput || fallbackName;
    const finalSlug = slugify(finalName);

    await createProject(organizationId, {
      name: finalName,
      slug: finalSlug,
      environment,
      description: "Onboarding project",
    });

    redirect("/onboarding?path=sdk");
  }

  async function createApiKeyAction() {
    "use server";

    const session = await requireOperatorSession();
    const organizationId = session.active_organization_id ?? session.memberships[0]?.organization_id ?? null;
    if (!organizationId) return;

    const projectList = await listProjects({ organizationId, limit: 1 }).catch(() => null);
    const projectId = projectList?.items[0]?.id ?? null;
    if (!projectId) return;

    const apiKeyResponse = await createApiKey(projectId, { label: "Onboarding ingest" });
    const apiKey = apiKeyResponse?.api_key;
    if (!apiKey) {
      redirect("/onboarding?path=sdk");
    }

    redirect(`/onboarding?path=sdk&api_key=${encodeURIComponent(apiKey)}`);
  }

  return (
    <div className="space-y-6">
      <OnboardingPathTracker path={selectedPath} />

      <Card className="p-6">
        <p className="text-xs uppercase tracking-[0.24em] text-secondary">Quick start</p>
        <h1 className="mt-3 text-3xl font-semibold text-primary">See your first AI incident in minutes</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-secondary">
          Connect your live system or run a guided simulation to experience the incident workflow.
          The goal is to get to actionable investigation quickly.
        </p>

        <div className="mt-5 flex flex-wrap gap-2">
          <Button asChild size="sm" variant={selectedPath === "choose" ? "default" : "outline"}>
            <Link href="/onboarding">Choose path</Link>
          </Button>
          <Button asChild size="sm" variant={selectedPath === "sdk" ? "default" : "outline"}>
            <Link href="/onboarding?path=sdk">Connect SDK</Link>
          </Button>
          <Button asChild size="sm" variant={selectedPath === "simulation" ? "default" : "outline"}>
            <Link href="/onboarding?path=simulation">Start simulation</Link>
          </Button>
          <Button asChild size="sm" variant="subtle">
            <Link href="/dashboard">Skip for now</Link>
          </Button>
        </div>
      </Card>

      {selectedPath === "choose" ? (
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card className="p-6">
              <p className="text-xs uppercase tracking-[0.24em] text-secondary">Option 1</p>
              <h2 className="mt-2 text-xl font-semibold text-primary">Connect your app</h2>
              <p className="mt-2 text-sm leading-6 text-secondary">
                Install the SDK and send traces from your own environment. This path is best when you
                already have traffic and want production signals immediately.
              </p>
              <div className="mt-5">
                <Button asChild>
                  <Link href="/onboarding?path=sdk">Connect SDK</Link>
                </Button>
              </div>
            </Card>

            <Card className="p-6">
              <p className="text-xs uppercase tracking-[0.24em] text-secondary">Option 2</p>
              <h2 className="mt-2 text-xl font-semibold text-primary">Try a guided simulation</h2>
              <p className="mt-2 text-sm leading-6 text-secondary">
                See a hallucination spike — detected at 19%, root-caused to prompt v42, and fixed in 6 minutes.
                The same incident you saw on the homepage, live in the product.
              </p>
              <div className="mt-5">
                <Button asChild>
                  <Link href="/onboarding?path=simulation">Start simulation</Link>
                </Button>
              </div>
            </Card>
          </div>
          <p className="text-center text-xs text-secondary">
            After setup, navigate to any project to define{" "}
            <Link href="/dashboard" className="underline hover:text-primary">
              custom behavioral signals
            </Link>{" "}
            — like refusal language, policy violations, or hallucination markers.
          </p>
          {primaryProjectId ? (
            <Card className="p-5">
              <p className="text-xs uppercase tracking-[0.24em] text-secondary">Behavioral signals</p>
              <h3 className="mt-2 text-xl font-semibold text-primary">Create a refusal metric</h3>
              <p className="mt-2 text-sm text-secondary">
                Turn refusal spikes into a persistent metric you can track in Reliability and incidents.
              </p>
              <div className="mt-4">
                <Button asChild>
                  <Link href={`/projects/${primaryProjectId}/metrics?template=refusal_language&source=onboarding`}>
                    Create a refusal metric
                  </Link>
                </Button>
              </div>
            </Card>
          ) : null}
        </div>
      ) : null}

      {selectedPath === "sdk" ? (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_380px]">
          <Card className="p-6">
            <p className="text-xs uppercase tracking-[0.24em] text-secondary">Connect your app</p>
            <h2 className="mt-3 text-2xl font-semibold text-primary">Install SDK and send first traces</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-secondary">
              Use this setup checklist to create a workspace, issue a key, and verify ingestion.
              If your traffic is quiet, switch to simulation and return later.
            </p>

            <div className="mt-8 space-y-4">
              {stepConfig.map((step, index) => {
                const state = steps[index]?.state ?? "next";
                const Icon = step.icon;
                const isCurrent = state === "current";
                const isDone = state === "done";
                return (
                  <div
                    key={step.label}
                    className="grid gap-4 rounded-xl border border-line bg-surface px-4 py-4 md:grid-cols-[48px_minmax(0,1fr)_auto]"
                  >
                    <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-white">
                      <Icon className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm text-secondary">Step {index + 1}</p>
                      <h3 className="mt-1 text-lg font-semibold text-primary">{step.label}</h3>
                      <p className="mt-2 text-sm leading-6 text-secondary">{step.detail}</p>
                    </div>
                    <div className="flex items-center">
                      {isDone ? (
                        <span className="rounded-full bg-green-50 px-3 py-1 text-xs font-medium text-green-700">
                          Complete
                        </span>
                      ) : isCurrent ? (
                        <span className="rounded-full bg-accentSoft px-3 py-1 text-xs font-medium text-accent">
                          Current
                        </span>
                      ) : (
                        <span className="rounded-full border border-line bg-white px-3 py-1 text-xs font-medium text-secondary">
                          Pending
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-6 rounded-xl border border-line bg-surface px-4 py-4">
              <p className="text-xs uppercase tracking-[0.24em] text-secondary">Organization</p>
              <p className="mt-2 text-sm text-secondary">
                Active: <span className="font-medium text-primary">{activeOrganizationLabel}</span>
              </p>
              <p className="mt-2 text-sm text-secondary">
                {hasOrganization
                  ? "You can create another organization at any time. The new organization becomes active immediately."
                  : "Create your first organization to start ingesting traces."}
              </p>

              <form action={createOrganizationAction} className="mt-4 grid gap-3 md:grid-cols-2">
                <label className="block space-y-2 text-sm text-secondary">
                  <span className="text-xs uppercase tracking-[0.24em] text-secondary">Organization name</span>
                  <input
                    name="name"
                    defaultValue={defaultName}
                    className="h-11 w-full rounded-md border border-line bg-white px-3 text-sm text-primary"
                  />
                </label>

                <label className="block space-y-2 text-sm text-secondary">
                  <span className="text-xs uppercase tracking-[0.24em] text-secondary">Slug</span>
                  <input
                    name="slug"
                    defaultValue={defaultSlug}
                    className="h-11 w-full rounded-md border border-line bg-white px-3 text-sm text-primary"
                  />
                </label>

                <div className="md:col-span-2 flex flex-wrap gap-2">
                  <Button type="submit">{hasOrganization ? "Create another organization" : "Create organization"}</Button>
                  <Button asChild variant="outline" type="button">
                    <Link href="/settings">Manage organizations</Link>
                  </Button>
                  <Button asChild variant="outline" type="button">
                    <Link href="/onboarding?path=simulation">Run simulation instead</Link>
                  </Button>
                </div>
              </form>
            </div>

            {hasOrganization && !hasProject ? (
              <form action={createProjectAction} className="mt-6 grid gap-3 md:grid-cols-2">
                <label className="block space-y-2 text-sm text-secondary">
                  <span className="text-xs uppercase tracking-[0.24em] text-secondary">Project name</span>
                  <input
                    name="project_name"
                    defaultValue="Production"
                    className="h-11 w-full rounded-md border border-line bg-white px-3 text-sm text-primary"
                  />
                </label>
                <label className="block space-y-2 text-sm text-secondary">
                  <span className="text-xs uppercase tracking-[0.24em] text-secondary">Environment</span>
                  <select
                    name="environment"
                    defaultValue="prod"
                    className="h-11 w-full rounded-md border border-line bg-white px-3 text-sm text-primary"
                  >
                    <option value="prod">Production</option>
                    <option value="staging">Staging</option>
                    <option value="dev">Development</option>
                  </select>
                </label>
                <div className="md:col-span-2 flex flex-wrap gap-2">
                  <Button type="submit">Create project</Button>
                </div>
              </form>
            ) : null}

            {hasOrganization && hasProject && !apiKeyCreated ? (
              <form action={createApiKeyAction} className="mt-6 flex flex-wrap gap-2">
                <Button type="submit">Generate API key</Button>
              </form>
            ) : null}

            {hasOrganization && hasProject && apiKeyValue ? (
              <div className="mt-6 rounded-xl border border-line bg-surface px-4 py-4">
                <p className="text-xs uppercase tracking-[0.24em] text-secondary">API key (copy once)</p>
                <p className="mt-2 break-all rounded-md bg-white px-3 py-2 text-sm text-primary">{apiKeyValue}</p>
              </div>
            ) : null}
          </Card>

          <Card className="h-fit p-6">
            <p className="text-xs uppercase tracking-[0.24em] text-secondary">Ingest example</p>
            <div className="mt-4 rounded-xl border border-code bg-code p-4 text-sm text-code">
              <pre className="overflow-x-auto whitespace-pre-wrap font-mono">{`curl -X POST http://localhost:8000/api/v1/ingest/traces \\
  -H "x-api-key: ${apiKeyValue ?? "reliai_..."}" \\
  -H "content-type: application/json" \\
  -d '{
    "timestamp":"2026-03-09T12:00:00Z",
    "request_id":"req_123",
    "model_name":"gpt-4.1-mini",
    "success":true
  }'`}</pre>
            </div>
            <div className="mt-5 rounded-xl border border-line bg-surface px-4 py-4">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="mt-0.5 h-5 w-5 text-primary" />
                <p className="text-sm leading-6 text-secondary">
                  After first accepted traces, open incidents and command center to investigate live
                  failures with cohort and prompt evidence.
                </p>
              </div>
            </div>
            {hasTrace ? (
              <div className="mt-4 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
                First trace received for {primaryProject?.name ?? "your project"}. You can now open incidents and verify ingestion.
              </div>
            ) : null}
          </Card>
        </div>
      ) : null}

      {selectedPath === "simulation" ? (
        hasOrganization ? (
          <OnboardingSimulationRunner
            defaultProjectName={`${defaultSlug}-simulation`}
            autoStart={autoStartSimulation}
          />
        ) : (
          <Card className="p-6">
            <p className="text-xs uppercase tracking-[0.24em] text-secondary">Simulation blocked</p>
            <h2 className="mt-3 text-2xl font-semibold text-primary">Create your organization to start the simulation</h2>
            <p className="mt-2 text-sm leading-6 text-secondary">
              We need a workspace to scope the simulation data. Create your organization first, then return here to
              run the guided incident.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <Button asChild>
                <Link href="/onboarding?path=sdk">Create organization</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/onboarding">Choose path</Link>
              </Button>
            </div>
          </Card>
        )
      ) : null}
    </div>
  );
}
