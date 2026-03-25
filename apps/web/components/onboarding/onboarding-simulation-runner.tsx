"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { trackEvent } from "@/lib/analytics";

type RunnerState = "idle" | "creating" | "running" | "failed";

interface SimulationCreateResponse {
  simulation_id: string;
}

interface SimulationStatusResponse {
  simulation_id: string;
  status: string;
  progress: number;
  stage: string;
  incident_id: string | null;
  error: string | null;
  created_at: string;
}

interface OnboardingSimulationRunnerProps {
  defaultProjectName: string;
}

const MAX_POLLS = 120;
const POLL_INTERVAL_MS = 2500;

export function OnboardingSimulationRunner({ defaultProjectName }: OnboardingSimulationRunnerProps) {
  const router = useRouter();
  const [state, setState] = useState<RunnerState>("idle");
  const [simulationId, setSimulationId] = useState<string | null>(null);
  const [status, setStatus] = useState<SimulationStatusResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [projectName, setProjectName] = useState(defaultProjectName);
  const [modelName, setModelName] = useState("gpt-4.1-mini");
  const [promptType, setPromptType] = useState("support_triage");
  const hasNavigatedRef = useRef(false);

  const statusLabel = useMemo(() => {
    if (!status) return "Queued";
    const stage = status.stage.replaceAll("_", " ");
    return stage.charAt(0).toUpperCase() + stage.slice(1);
  }, [status]);

  useEffect(() => {
    if (!simulationId || state !== "running") {
      return;
    }

    let pollCount = 0;
    let cancelled = false;
    let inFlight = false;
    let timer: ReturnType<typeof window.setInterval> | null = null;

    const stopPolling = () => {
      if (timer !== null) {
        window.clearInterval(timer);
        timer = null;
      }
    };

    const poll = async () => {
      if (cancelled || inFlight || hasNavigatedRef.current) return;
      inFlight = true;
      pollCount += 1;
      if (pollCount > MAX_POLLS) {
        stopPolling();
        setError("Simulation timed out after 5 minutes. Retry to generate a new simulation run.");
        setState("failed");
        inFlight = false;
        return;
      }

      try {
        const response = await fetch(`/api/onboarding/simulations/${encodeURIComponent(simulationId)}/status`, {
          cache: "no-store",
        });
        const payload = (await response.json()) as SimulationStatusResponse | { detail?: string };
        if (!response.ok) {
          if (response.status === 401) {
            throw new Error("Your session expired. Refresh and sign in again.");
          }
          throw new Error((payload as { detail?: string }).detail || `Status check failed (${response.status})`);
        }
        const simulationStatus = payload as SimulationStatusResponse;
        setStatus(simulationStatus);

        if (simulationStatus.status === "completed" || simulationStatus.status === "complete") {
          stopPolling();
          if (simulationStatus.incident_id) {
            trackEvent("simulation_completed", {
              simulation_id: simulationStatus.simulation_id,
              incident_id: simulationStatus.incident_id,
              status: simulationStatus.status,
            });
            hasNavigatedRef.current = true;
            router.push(`/incidents/${simulationStatus.incident_id}/command`);
            inFlight = false;
            return;
          }
          setError("Simulation completed but no incident was created. Try running it again.");
          setState("failed");
          inFlight = false;
          return;
        }

        if (simulationStatus.status === "failed") {
          stopPolling();
          trackEvent("simulation_completed", {
            simulation_id: simulationStatus.simulation_id,
            incident_id: null,
            status: simulationStatus.status,
          });
          setError(
            simulationStatus.error ||
              "Simulation failed before incident creation. Retry, or switch to SDK onboarding if the issue persists."
          );
          setState("failed");
          inFlight = false;
          return;
        }

        if (simulationStatus.status !== "running" && simulationStatus.status !== "pending") {
          stopPolling();
          setError(`Unexpected simulation status: ${simulationStatus.status}`);
          setState("failed");
          inFlight = false;
          return;
        }
      } catch (pollError) {
        stopPolling();
        setError(pollError instanceof Error ? pollError.message : "Unable to poll simulation status");
        setState("failed");
      } finally {
        inFlight = false;
      }
    };

    poll();
    timer = window.setInterval(poll, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      stopPolling();
    };
  }, [simulationId, state, router]);

  async function startSimulation() {
    if (state === "creating" || state === "running") {
      return;
    }

    setState("creating");
    setError(null);
    setStatus(null);
    setSimulationId(null);
    hasNavigatedRef.current = false;

    trackEvent("simulation_started", {
      project_name: projectName,
      model_name: modelName,
      prompt_type: promptType,
      simulation_type: "refusal_spike",
    });

    try {
      const response = await fetch("/api/onboarding/simulations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectName,
          modelName,
          promptType,
          simulationType: "refusal_spike",
        }),
      });
      const payload = (await response.json()) as SimulationCreateResponse | { detail?: string };
      if (!response.ok) {
        throw new Error((payload as { detail?: string }).detail || `Simulation request failed (${response.status})`);
      }

      const nextSimulationId = (payload as SimulationCreateResponse).simulation_id;
      if (!nextSimulationId) {
        throw new Error("Simulation was created but no simulation_id was returned.");
      }
      setSimulationId(nextSimulationId);
      setState("running");
    } catch (startError) {
      setError(startError instanceof Error ? startError.message : "Failed to start simulation");
      setState("failed");
    }
  }

  function resetSimulation() {
    setState("idle");
    setSimulationId(null);
    setStatus(null);
    setError(null);
    hasNavigatedRef.current = false;
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
      <Card className="p-6">
        <p className="text-xs uppercase tracking-[0.24em] text-steel">Guided simulation</p>
        <h2 className="mt-3 text-2xl font-semibold text-ink">Generate a realistic incident walkthrough</h2>
        <p className="mt-3 text-sm leading-6 text-steel">
          We generate healthy traces, inject a failure pattern, run regression detection, and open an
          incident so you can investigate in command center.
        </p>

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <label className="block space-y-2 text-sm text-steel">
            <span className="text-xs uppercase tracking-[0.24em] text-steel">Project name</span>
            <input
              value={projectName}
              onChange={(event) => setProjectName(event.target.value)}
              className="h-11 w-full rounded-md border border-line bg-white px-3 text-sm text-ink"
            />
          </label>
          <label className="block space-y-2 text-sm text-steel">
            <span className="text-xs uppercase tracking-[0.24em] text-steel">Model</span>
            <input
              value={modelName}
              onChange={(event) => setModelName(event.target.value)}
              className="h-11 w-full rounded-md border border-line bg-white px-3 text-sm text-ink"
            />
          </label>
          <label className="block space-y-2 text-sm text-steel">
            <span className="text-xs uppercase tracking-[0.24em] text-steel">Prompt type</span>
            <input
              value={promptType}
              onChange={(event) => setPromptType(event.target.value)}
              className="h-11 w-full rounded-md border border-line bg-white px-3 text-sm text-ink"
            />
          </label>
        </div>

        <div className="mt-6 space-y-3 text-sm text-steel">
          <div className="rounded-xl border border-line bg-surface px-4 py-3">1. Creating healthy baseline traces</div>
          <div className="rounded-xl border border-line bg-surface px-4 py-3">2. Injecting regression pattern</div>
          <div className="rounded-xl border border-line bg-surface px-4 py-3">3. Running incident detection</div>
          <div className="rounded-xl border border-line bg-surface px-4 py-3">4. Preparing investigation workspace</div>
        </div>

        <div className="mt-6 flex flex-wrap gap-2">
          {state === "idle" || state === "failed" ? (
            <Button onClick={startSimulation} disabled={!projectName.trim() || !modelName.trim() || !promptType.trim()}>
              Start guided simulation
            </Button>
          ) : (
            <Button disabled>
              {state === "creating" ? "Creating simulation..." : "Simulation running..."}
            </Button>
          )}
          <Button asChild variant="outline">
            <Link href="/onboarding?path=sdk">Connect SDK instead</Link>
          </Button>
          {state === "failed" ? (
            <Button type="button" variant="ghost" onClick={resetSimulation}>
              Reset
            </Button>
          ) : null}
        </div>
        {error ? (
          <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
        ) : null}
      </Card>

      <Card className="p-6">
        <p className="text-xs uppercase tracking-[0.24em] text-steel">Simulation status</p>
        <div className="mt-4 rounded-xl border border-line bg-surface px-4 py-4">
          <p className="text-sm text-steel">State: <span className="font-medium text-ink">{state}</span></p>
          <p className="mt-2 text-sm text-steel">Stage: <span className="font-medium text-ink">{statusLabel}</span></p>
          <p className="mt-2 text-sm text-steel">
            Progress: <span className="font-medium text-ink">{status?.progress ?? (state === "idle" ? 0 : 5)}%</span>
          </p>
          {simulationId ? (
            <p className="mt-2 text-xs text-steel">Simulation ID: {simulationId}</p>
          ) : null}
        </div>

        <p className="mt-5 text-sm leading-6 text-steel">
          {state === "idle" && "Launch the simulation to create synthetic traces and trigger incident detection."}
          {state === "creating" && "Allocating project context and enqueuing synthetic trace jobs."}
          {state === "running" && "Generating traces and checking for a regression-triggered incident."}
          {state === "failed" && "Simulation stopped before incident handoff. Adjust input values and try again."}
        </p>
      </Card>
    </div>
  );
}
