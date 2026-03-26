import Link from "next/link";
import { redirect } from "next/navigation";
import { CheckCircle2, CircleDashed, KeyRound, Network, Radar } from "lucide-react";

import { OnboardingPathTracker } from "@/components/onboarding/onboarding-path-tracker";
import { OnboardingSimulationRunner } from "@/components/onboarding/onboarding-simulation-runner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { createOrganization, listProjects } from "@/lib/api";
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

const steps = [
  {
    label: "Create organization",
    state: "current",
    icon: Network,
    detail: "Register the tenant root used to scope projects, members, and onboarding.",
  },
  {
    label: "Create project",
    state: "next",
    icon: CircleDashed,
    detail: "Provision a production, staging, or development project inside the organization.",
  },
  {
    label: "Generate API key",
    state: "next",
    icon: KeyRound,
    detail: "Issue a project-scoped ingest key. The secret is revealed once.",
  },
  {
    label: "Send first trace",
    state: "next",
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
  searchParams: Promise<{ path?: string; autostart?: string }>;
}) {
  const { path, autostart } = await searchParams;
  const selectedPath = normalizePath(path);
  const autoStartSimulation = autostart === "1" || autostart === "true";

  const maybeSession = await getOperatorSession();
  if (!maybeSession) {
    const returnTo = "/onboarding?path=simulation&autostart=1";
    const signInHref = { pathname: "/sign-in", query: { return_to: returnTo } };
    if (autoStartSimulation) {
      redirect(`/sign-in?return_to=${encodeURIComponent(returnTo)}`);
    }
    return (
      <div className="space-y-6">
        <Card className="p-6">
          <p className="text-xs uppercase tracking-[0.24em] text-steel">Guided simulation</p>
          <h1 className="mt-3 text-3xl font-semibold text-ink">See your first AI incident in under 2 minutes</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-steel">
            We simulate a realistic failure, open an incident automatically, and walk you through
            root cause and resolution impact. No SDK required.
          </p>
          <div className="mt-4 grid gap-2 text-sm text-steel">
            <p>1. Generate a realistic regression and incident.</p>
            <p>2. Review command center evidence and prompt diff.</p>
            <p>3. Apply a fix and see the impact summary.</p>
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
          <p className="text-xs uppercase tracking-[0.24em] text-steel">What you will see</p>
          <div className="mt-3 grid gap-4 md:grid-cols-3">
            <div>
              <p className="text-sm font-semibold text-ink">Incident opens</p>
              <p className="mt-1 text-sm text-steel">A refusal spike triggers an incident automatically.</p>
            </div>
            <div>
              <p className="text-sm font-semibold text-ink">Evidence + diff</p>
              <p className="mt-1 text-sm text-steel">Command center shows prompt diff and root-cause scoring.</p>
            </div>
            <div>
              <p className="text-sm font-semibold text-ink">Impact proof</p>
              <p className="mt-1 text-sm text-steel">Resolution impact shows the metric change after a fix.</p>
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
  const projectList = organizationId
    ? await listProjects({ organizationId, limit: 1 }).catch(() => null)
    : null;
  const primaryProjectId = projectList?.items[0]?.id ?? null;

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
    redirect("/dashboard");
  }

  return (
    <div className="space-y-6">
      <OnboardingPathTracker path={selectedPath} />

      <Card className="p-6">
        <p className="text-xs uppercase tracking-[0.24em] text-steel">Quick start</p>
        <h1 className="mt-3 text-3xl font-semibold text-ink">See your first AI incident in minutes</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-steel">
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
              <p className="text-xs uppercase tracking-[0.24em] text-steel">Option 1</p>
              <h2 className="mt-2 text-xl font-semibold text-ink">Connect your app</h2>
              <p className="mt-2 text-sm leading-6 text-steel">
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
              <p className="text-xs uppercase tracking-[0.24em] text-steel">Option 2</p>
              <h2 className="mt-2 text-xl font-semibold text-ink">Try a guided simulation</h2>
              <p className="mt-2 text-sm leading-6 text-steel">
                Generate synthetic traces and walk through incident detection, comparison, and root-cause
                confirmation with realistic operator screens.
              </p>
              <div className="mt-5">
                <Button asChild>
                  <Link href="/onboarding?path=simulation">Start simulation</Link>
                </Button>
              </div>
            </Card>
          </div>
          <p className="text-center text-xs text-steel">
            After setup, navigate to any project to define{" "}
            <Link href="/dashboard" className="underline hover:text-ink">
              custom behavioral signals
            </Link>{" "}
            — like refusal language, policy violations, or hallucination markers.
          </p>
          {primaryProjectId ? (
            <Card className="p-5">
              <p className="text-xs uppercase tracking-[0.24em] text-steel">Behavioral signals</p>
              <h3 className="mt-2 text-xl font-semibold text-ink">Create a refusal metric</h3>
              <p className="mt-2 text-sm text-steel">
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
            <p className="text-xs uppercase tracking-[0.24em] text-steel">Connect your app</p>
            <h2 className="mt-3 text-2xl font-semibold text-ink">Install SDK and send first traces</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-steel">
              Use this setup checklist to create a workspace, issue a key, and verify ingestion.
              If your traffic is quiet, switch to simulation and return later.
            </p>

            <div className="mt-8 space-y-4">
              {steps.map((step, index) => {
                const Icon = step.icon;
                const isCurrent = step.state === "current";
                return (
                  <div
                    key={step.label}
                    className="grid gap-4 rounded-xl border border-line bg-surface px-4 py-4 md:grid-cols-[48px_minmax(0,1fr)_auto]"
                  >
                    <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-white">
                      <Icon className="h-5 w-5 text-ink" />
                    </div>
                    <div>
                      <p className="text-sm text-steel">Step {index + 1}</p>
                      <h3 className="mt-1 text-lg font-semibold text-ink">{step.label}</h3>
                      <p className="mt-2 text-sm leading-6 text-steel">{step.detail}</p>
                    </div>
                    <div className="flex items-center">
                      {isCurrent ? (
                        <span className="rounded-full bg-accentSoft px-3 py-1 text-xs font-medium text-accent">
                          Current
                        </span>
                      ) : (
                        <span className="rounded-full border border-line bg-white px-3 py-1 text-xs font-medium text-steel">
                          Pending
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <form action={createOrganizationAction} className="mt-6 grid gap-3 md:grid-cols-2">
              <label className="block space-y-2 text-sm text-steel">
                <span className="text-xs uppercase tracking-[0.24em] text-steel">Organization name</span>
                <input
                  name="name"
                  defaultValue={defaultName}
                  className="h-11 w-full rounded-md border border-line bg-white px-3 text-sm text-ink"
                />
              </label>

              <label className="block space-y-2 text-sm text-steel">
                <span className="text-xs uppercase tracking-[0.24em] text-steel">Slug</span>
                <input
                  name="slug"
                  defaultValue={defaultSlug}
                  className="h-11 w-full rounded-md border border-line bg-white px-3 text-sm text-ink"
                />
              </label>

              <div className="md:col-span-2 flex flex-wrap gap-2">
                <Button type="submit">Create organization</Button>
                <Button asChild variant="outline" type="button">
                  <Link href="/onboarding?path=simulation">Run simulation instead</Link>
                </Button>
              </div>
            </form>
          </Card>

          <Card className="h-fit p-6">
            <p className="text-xs uppercase tracking-[0.24em] text-steel">Ingest example</p>
            <div className="mt-4 rounded-xl bg-[#111827] p-4 text-sm text-zinc-100">
              <pre className="overflow-x-auto whitespace-pre-wrap font-mono">{`curl -X POST http://localhost:8000/api/v1/ingest/traces \\
  -H "x-api-key: reliai_..." \\
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
                <CheckCircle2 className="mt-0.5 h-5 w-5 text-ink" />
                <p className="text-sm leading-6 text-steel">
                  After first accepted traces, open incidents and command center to investigate live
                  failures with cohort and prompt evidence.
                </p>
              </div>
            </div>
          </Card>
        </div>
      ) : null}

      {selectedPath === "simulation" ? (
        <OnboardingSimulationRunner
          defaultProjectName={`${defaultSlug}-simulation`}
          autoStart={autoStartSimulation}
        />
      ) : null}
    </div>
  );
}
