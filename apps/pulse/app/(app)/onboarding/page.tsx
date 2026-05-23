import Link from "next/link";
import { redirect } from "next/navigation";
import type { Route } from "next";

import { OnboardingPathTracker } from "@/components/onboarding/onboarding-path-tracker";
import { OnboardingSimulationRunner } from "@/components/onboarding/onboarding-simulation-runner";
import { OnboardingProjectScopeSelector } from "@/components/onboarding/onboarding-project-scope-selector";
import { AppShellFrame } from "@/components/dashboard/app-shell-frame";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getOperatorSession, requireOperatorSession, switchOrganization } from "@/lib/auth";
import {
  createApiKey,
  createOrganization,
  createProject,
  defaultOrgName,
  getProject,
  listProjects,
  listProjectTraces,
  slugify,
} from "@/lib/onboarding-data";

type OnboardingPath = "choose" | "sdk" | "simulation";
type OnboardingErrorCode =
  | "org_create_failed"
  | "project_create_failed"
  | "api_key_create_failed"
  | "org_context_missing"
  | "project_context_missing";

function normalizePath(value: string | undefined): OnboardingPath {
  if (value === "sdk" || value === "simulation") return value;
  return "choose";
}

function toErrorRedirect(path: OnboardingPath, error: OnboardingErrorCode): Route {
  return `/onboarding?path=${path}&error=${error}` as Route;
}

function errorMessageForCode(errorCode: string | undefined): string | null {
  if (!errorCode) return null;
  switch (errorCode) {
    case "org_create_failed":
      return "Unable to create organization. Retry or adjust name/slug.";
    case "project_create_failed":
      return "Unable to create project. Retry or adjust project name.";
    case "api_key_create_failed":
      return "Unable to create API key. Retry in a moment.";
    case "org_context_missing":
      return "Active organization context is missing. Re-select an organization and retry onboarding.";
    case "project_context_missing":
      return "No project is available for API key creation. Create/select a project and retry.";
    default:
      return null;
  }
}

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ path?: string; autostart?: string; api_key?: string; project_id?: string; error?: string }>;
}) {
  const { path, autostart, api_key: apiKeyParam, project_id: projectIdParam, error } = await searchParams;
  const selectedPath = normalizePath(path);
  const autoStartSimulation = autostart === "1" || autostart === "true";
  const apiKeyValue = typeof apiKeyParam === "string" && apiKeyParam.length > 0 ? apiKeyParam : null;
  const onboardingError = errorMessageForCode(error);

  const maybeSession = await getOperatorSession();
  const returnTo = `/onboarding?path=simulation&autostart=1${projectIdParam ? `&project_id=${encodeURIComponent(projectIdParam)}` : ""}`;
  const signInHref = `/sign-in?return_to=${encodeURIComponent(returnTo)}` as Route;

  if (!maybeSession && autoStartSimulation) redirect(signInHref);

  if (!maybeSession) {
    return (
      <div className="mx-auto max-w-[980px] px-6 py-8 space-y-6">
        <Card className="p-6">
          <h1 className="text-3xl font-semibold text-primary">See your first AI incident in minutes</h1>
          <p className="mt-3 text-sm text-secondary">Run guided onboarding from Reliai and preserve sign-in return path continuity.</p>
          <div className="mt-6 flex gap-2">
            <Button asChild><Link href={signInHref}>Start guided simulation</Link></Button>
            <Button asChild variant="outline"><Link href="/sign-in">Sign in</Link></Button>
          </div>
        </Card>
      </div>
    );
  }

  const session = await requireOperatorSession("/onboarding");
  const defaultName = defaultOrgName(session.operator.email);
  const organizationId = session.active_organization_id ?? session.memberships[0]?.organization_id ?? null;
  const projects = organizationId ? await listProjects(organizationId).catch(() => null) : null;
  const explicitProject =
    projectIdParam && projectIdParam.length > 0 ? await getProject(projectIdParam).catch(() => null) : null;
  const selectedProject =
    explicitProject ??
    projects?.items.find((project) => project.id === projectIdParam) ??
    projects?.items
      .slice()
      .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))[0] ??
    null;
  const primaryProjectId = selectedProject?.id ?? null;
  const primaryProject = selectedProject;
  const traceList = primaryProjectId ? await listProjectTraces(primaryProjectId).catch(() => null) : null;

  const hasOrganization = Boolean(organizationId);
  const hasProject = Boolean(primaryProjectId);
  const hasTrace = Boolean(traceList?.items?.length);
  const apiKeyCreated = Boolean(apiKeyValue);
  const projectScopeQuery = primaryProjectId ? `&project_id=${encodeURIComponent(primaryProjectId)}` : "";

  async function createOrganizationAction(formData: FormData) {
    "use server";
    const session = await requireOperatorSession("/onboarding");

    const nameInput = String(formData.get("name") ?? "").trim();
    const slugInput = String(formData.get("slug") ?? "").trim();
    const finalName = nameInput || defaultOrgName(session.operator.email);
    const finalSlug = slugify(slugInput || finalName);
    if (!finalName || !finalSlug) return;

    try {
      const createdOrganization = await createOrganization({
        name: finalName,
        slug: finalSlug,
        plan: "free",
        owner_auth_user_id: session.operator.id,
        owner_role: "owner",
      });
      await switchOrganization(createdOrganization.id);
    } catch {
      redirect(toErrorRedirect("sdk", "org_create_failed"));
    }

    redirect("/onboarding?path=sdk");
  }

  async function createProjectAction(formData: FormData) {
    "use server";
    const session = await requireOperatorSession("/onboarding");
    const orgId = session.active_organization_id ?? session.memberships[0]?.organization_id ?? null;
    if (!orgId) {
      redirect(toErrorRedirect("sdk", "org_context_missing"));
    }

    const nameInput = String(formData.get("project_name") ?? "").trim();
    const environmentInput = String(formData.get("environment") ?? "prod").trim();
    const environment = environmentInput === "staging" || environmentInput === "dev" ? environmentInput : "prod";
    const finalName = nameInput || "Production";
    const baseSlug = slugify(finalName) || "project";
    const existingProjects = await listProjects(orgId).catch(() => null);
    const existingSlugs = new Set(existingProjects?.items.map((project) => project.slug) ?? []);
    const uniqueSlug = existingSlugs.has(baseSlug) ? `${baseSlug}-${Date.now().toString().slice(-6)}` : baseSlug;

    let createdProjectId = "";
    try {
      const createdProject = await createProject(orgId, {
        name: finalName,
        slug: uniqueSlug,
        environment,
        description: "Onboarding project",
      });
      createdProjectId = createdProject.id;
    } catch {
      redirect(toErrorRedirect("sdk", "project_create_failed"));
    }

    redirect(`/onboarding?path=sdk&project_id=${encodeURIComponent(createdProjectId)}`);
  }

  async function createApiKeyAction(formData: FormData) {
    "use server";
    const session = await requireOperatorSession("/onboarding");
    const orgId = session.active_organization_id ?? session.memberships[0]?.organization_id ?? null;
    if (!orgId) {
      redirect(toErrorRedirect("sdk", "org_context_missing"));
    }

    const preferredProjectId = String(formData.get("project_id") ?? "").trim() || projectIdParam || null;
    const explicitProject =
      preferredProjectId && preferredProjectId.length > 0
        ? await getProject(preferredProjectId).catch(() => null)
        : null;
    const projectList = await listProjects(orgId).catch(() => null);
    const projectId =
      explicitProject?.id ??
      projectList?.items.find((project) => project.id === preferredProjectId)?.id ??
      projectList?.items
        .slice()
        .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))[0]?.id ??
      null;
    if (!projectId) {
      redirect(toErrorRedirect("sdk", "project_context_missing"));
    }

    let apiKey = "";
    try {
      apiKey = (await createApiKey(projectId, { label: "Onboarding ingest" })).api_key;
    } catch {
      redirect(toErrorRedirect("sdk", "api_key_create_failed"));
    }
    redirect(`/onboarding?path=sdk&project_id=${encodeURIComponent(projectId)}&api_key=${encodeURIComponent(apiKey)}`);
  }

  return (
    <AppShellFrame activeSection="overview">
    <div className="mx-auto max-w-[1100px] px-6 py-6 space-y-6">
      <OnboardingPathTracker path={selectedPath} />
      <Card className="p-6">
        <p className="text-xs uppercase tracking-[0.24em] text-secondary">Quick start</p>
        <h1 className="mt-3 text-3xl font-semibold text-primary">Onboarding ownership in Reliai</h1>
        <div className="mt-5 flex flex-wrap gap-2">
          <Button asChild size="sm" variant={selectedPath === "choose" ? "default" : "outline"}><Link href={`/onboarding${primaryProjectId ? `?project_id=${encodeURIComponent(primaryProjectId)}` : ""}`}>Choose path</Link></Button>
          <Button asChild size="sm" variant={selectedPath === "sdk" ? "default" : "outline"}><Link href={`/onboarding?path=sdk${projectScopeQuery}`}>Connect SDK</Link></Button>
          <Button asChild size="sm" variant={selectedPath === "simulation" ? "default" : "outline"}><Link href={`/onboarding?path=simulation${projectScopeQuery}`}>Start simulation</Link></Button>
          <Button asChild size="sm" variant="subtle"><Link href="/pulse">Skip for now</Link></Button>
        </div>
      </Card>

      {onboardingError ? (
        <Card className="border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {onboardingError}
        </Card>
      ) : null}

      {selectedPath === "simulation" ? (
        <OnboardingSimulationRunner defaultProjectName={primaryProject?.name ?? "Reliability Onboarding"} autoStart={autoStartSimulation} />
      ) : null}

      {selectedPath !== "simulation" ? (
        <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
          <article className="rounded-xl border border-border bg-card p-5 space-y-3">
            <h2 className="text-base font-semibold text-foreground">SDK path checklist</h2>
            {!hasOrganization ? (
              <form action={createOrganizationAction} className="space-y-2">
                <input name="name" defaultValue={defaultName} className="h-10 w-full rounded-md border border-border px-3 text-sm" />
                <input name="slug" defaultValue={slugify(defaultName)} className="h-10 w-full rounded-md border border-border px-3 text-sm" />
                <button type="submit" className="rounded-md border border-border px-3 py-2 text-sm hover:bg-muted">Create organization</button>
              </form>
            ) : !hasProject ? (
              <form action={createProjectAction} className="space-y-2">
                <input name="project_name" defaultValue="Production" className="h-10 w-full rounded-md border border-border px-3 text-sm" />
                <select name="environment" className="h-10 w-full rounded-md border border-border px-3 text-sm">
                  <option value="prod">production</option>
                  <option value="staging">staging</option>
                  <option value="dev">development</option>
                </select>
                <button type="submit" className="rounded-md border border-border px-3 py-2 text-sm hover:bg-muted">Create project</button>
              </form>
            ) : !apiKeyCreated ? (
              <form action={createApiKeyAction}>
                {primaryProjectId ? <input type="hidden" name="project_id" value={primaryProjectId} /> : null}
                <button type="submit" className="rounded-md border border-border px-3 py-2 text-sm hover:bg-muted">Generate API key</button>
              </form>
            ) : (
              <div className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">API key created. Send a trace next to complete onboarding.</div>
            )}

            {apiKeyValue ? (
              <div className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm">
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Onboarding API key (shown once)</p>
                <code className="mt-1 block break-all text-foreground">{apiKeyValue}</code>
              </div>
            ) : null}

            <div className="rounded-lg border border-border bg-muted/20 px-3 py-3 text-sm space-y-3">
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Ingest verification</p>
              <p className="text-muted-foreground">
                Direct ingest (HTTP): send one trace with your project key to verify first-trace onboarding.
              </p>
              <pre className="overflow-x-auto whitespace-pre-wrap rounded-md border border-border bg-background p-3 text-xs text-foreground">{`export RELIAI_API_KEY="${apiKeyValue ?? "reliai_..."}"
curl -X POST http://localhost:8000/api/v1/ingest/traces \\
  -H "x-api-key: ${apiKeyValue ?? "reliai_..."}" \\
  -H "content-type: application/json" \\
  -d '{
    "timestamp":"2026-03-09T12:00:00Z",
    "request_id":"req_123",
    "model_name":"gpt-4.1-mini",
    "success":true
  }'`}</pre>
              <p className="text-muted-foreground">
                Reliai SDK / external app path: use <code>RELIAI_API_KEY</code> and initialize the SDK with
                <code> apiKey: process.env.RELIAI_API_KEY</code>.
              </p>
              <p className="text-muted-foreground">
                OTEL-compatible path: export through your OTEL collector into Reliai ingest endpoints using the same
                project-scoped key contract.
              </p>
            </div>
          </article>

          <article className="rounded-xl border border-border bg-card p-5 text-sm text-muted-foreground space-y-2">
            <p>Organization: <span className="text-foreground">{hasOrganization ? "ready" : "pending"}</span></p>
            <p>Project: <span className="text-foreground">{hasProject ? "ready" : "pending"}</span></p>
            <p>API key: <span className="text-foreground">{apiKeyCreated ? "ready" : "pending"}</span></p>
            <p>First trace: <span className="text-foreground">{hasTrace ? "ready" : "pending"}</span></p>
            {primaryProject ? (
              <p>Selected project: <span className="text-foreground">{primaryProject.name}</span></p>
            ) : null}
            <div className="space-y-1 pt-2">
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Project scope</p>
              <OnboardingProjectScopeSelector
                selectedPath={selectedPath}
                selectedProjectId={primaryProjectId}
                projects={
                  projects?.items
                    ?.slice()
                    .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))
                    .map((project) => ({ id: project.id, name: project.name })) ?? []
                }
              />
            </div>
          </article>
        </section>
      ) : null}
    </div>
    </AppShellFrame>
  );
}
