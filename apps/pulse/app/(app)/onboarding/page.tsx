import Link from "next/link";
import { redirect } from "next/navigation";
import type { Route } from "next";

import { OnboardingPathTracker } from "@/components/onboarding/onboarding-path-tracker";
import { OnboardingSimulationRunner } from "@/components/onboarding/onboarding-simulation-runner";
import { AppShellFrame } from "@/components/dashboard/app-shell-frame";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getOperatorSession, requireOperatorSession, switchOrganization } from "@/lib/auth";
import {
  createApiKey,
  createOrganization,
  createProject,
  defaultOrgName,
  listProjects,
  listProjectTraces,
  slugify,
} from "@/lib/onboarding-data";

type OnboardingPath = "choose" | "sdk" | "simulation";
type OnboardingErrorCode = "org_create_failed" | "project_create_failed" | "api_key_create_failed";

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
  const returnTo = "/onboarding?path=simulation&autostart=1";
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
  const selectedProject =
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
    if (!orgId) return;

    const nameInput = String(formData.get("project_name") ?? "").trim();
    const environmentInput = String(formData.get("environment") ?? "production").trim();
    const environment =
      environmentInput === "staging" || environmentInput === "development" ? environmentInput : "production";
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

  async function createApiKeyAction() {
    "use server";
    const session = await requireOperatorSession("/onboarding");
    const orgId = session.active_organization_id ?? session.memberships[0]?.organization_id ?? null;
    if (!orgId) return;

    const preferredProjectId = projectIdParam ?? null;
    const projectList = await listProjects(orgId).catch(() => null);
    const projectId =
      projectList?.items.find((project) => project.id === preferredProjectId)?.id ??
      projectList?.items
        .slice()
        .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))[0]?.id ??
      null;
    if (!projectId) return;

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
          <Button asChild size="sm" variant={selectedPath === "choose" ? "default" : "outline"}><Link href="/onboarding">Choose path</Link></Button>
          <Button asChild size="sm" variant={selectedPath === "sdk" ? "default" : "outline"}><Link href="/onboarding?path=sdk">Connect SDK</Link></Button>
          <Button asChild size="sm" variant={selectedPath === "simulation" ? "default" : "outline"}><Link href="/onboarding?path=simulation">Start simulation</Link></Button>
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
                  <option value="production">production</option>
                  <option value="staging">staging</option>
                  <option value="development">development</option>
                </select>
                <button type="submit" className="rounded-md border border-border px-3 py-2 text-sm hover:bg-muted">Create project</button>
              </form>
            ) : !apiKeyCreated ? (
              <form action={createApiKeyAction}>
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
          </article>

          <article className="rounded-xl border border-border bg-card p-5 text-sm text-muted-foreground space-y-2">
            <p>Organization: <span className="text-foreground">{hasOrganization ? "ready" : "pending"}</span></p>
            <p>Project: <span className="text-foreground">{hasProject ? "ready" : "pending"}</span></p>
            <p>API key: <span className="text-foreground">{apiKeyCreated ? "ready" : "pending"}</span></p>
            <p>First trace: <span className="text-foreground">{hasTrace ? "ready" : "pending"}</span></p>
            {primaryProject ? (
              <p>Selected project: <span className="text-foreground">{primaryProject.name}</span></p>
            ) : null}
          </article>
        </section>
      ) : null}
    </div>
    </AppShellFrame>
  );
}
