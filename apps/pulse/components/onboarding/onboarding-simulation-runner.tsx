"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { trackEvent } from "@/lib/analytics";

type RunnerState = "idle" | "creating" | "running" | "handoff" | "failed";

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
}

interface OnboardingSimulationRunnerProps {
  defaultProjectName: string;
  autoStart?: boolean;
}

const MAX_POLLS = 120;
const POLL_INTERVAL_MS = 2500;

export function OnboardingSimulationRunner({ defaultProjectName, autoStart }: OnboardingSimulationRunnerProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [state, setState] = useState<RunnerState>("idle");
  const [simulationId, setSimulationId] = useState<string | null>(null);
  const [status, setStatus] = useState<SimulationStatusResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [projectName, setProjectName] = useState(defaultProjectName);
  const [modelName, setModelName] = useState("gpt-4.1-mini");
  const [promptType, setPromptType] = useState("support_triage");
  const hasNavigatedRef = useRef(false);
  const scopedProjectId = searchParams.get("project_id");
  const withScopedProject = useCallback(
    (path: string) => {
      if (!scopedProjectId) return path;
      const separator = path.includes("?") ? "&" : "?";
      return `${path}${separator}project_id=${encodeURIComponent(scopedProjectId)}`;
    },
    [scopedProjectId],
  );

  const statusLabel = useMemo(() => {
    if (!status) return "Queued";
    const stage = status.stage.replaceAll("_", " ");
    return stage.charAt(0).toUpperCase() + stage.slice(1);
  }, [status]);

  useEffect(() => {
    if (!simulationId || state !== "running") return;

    let pollCount = 0;
    let cancelled = false;
    let inFlight = false;
    let timer: number | null = null;

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
        if (!response.ok) throw new Error((payload as { detail?: string }).detail || `Status check failed (${response.status})`);

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
            setState("handoff");
            const scopeQuery = scopedProjectId ? `?project_id=${encodeURIComponent(scopedProjectId)}` : "";
            window.setTimeout(() => router.push(`/incidents/${simulationStatus.incident_id}/command${scopeQuery}`), 1500);
            inFlight = false;
            return;
          }
          setError("Simulation completed but no incident was created.");
          setState("failed");
          inFlight = false;
          return;
        }

        if (simulationStatus.status === "failed") {
          stopPolling();
          setError(simulationStatus.error || "Simulation failed before incident creation.");
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
  }, [simulationId, state, router, scopedProjectId]);

  const startSimulation = useCallback(async () => {
    if (state === "creating" || state === "running") return;

    setState("creating");
    setError(null);
    setStatus(null);
    setSimulationId(null);
    hasNavigatedRef.current = false;

    trackEvent("simulation_started", { project_name: projectName, model_name: modelName, prompt_type: promptType });

    try {
      const response = await fetch("/api/onboarding/simulations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectName, modelName, promptType, simulationType: "refusal_spike" }),
      });
      const payload = (await response.json()) as SimulationCreateResponse | { detail?: string };
      if (!response.ok) throw new Error((payload as { detail?: string }).detail || `Simulation request failed (${response.status})`);

      const nextSimulationId = (payload as SimulationCreateResponse).simulation_id;
      if (!nextSimulationId) throw new Error("Simulation created but no simulation_id returned.");
      setSimulationId(nextSimulationId);
      setState("running");
    } catch (startError) {
      setError(startError instanceof Error ? startError.message : "Failed to start simulation");
      setState("failed");
    }
  }, [modelName, projectName, promptType, state]);

  useEffect(() => {
    if (!autoStart || state !== "idle") return;
    startSimulation();
  }, [autoStart, startSimulation, state]);

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
      <Card className="p-6">
        <h2 className="text-2xl font-semibold text-primary">Guided simulation</h2>
        <p className="mt-2 text-sm text-secondary">Generate a failure pattern and open an incident automatically.</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <input value={projectName} onChange={(e) => setProjectName(e.target.value)} className="h-10 rounded-md border border-line px-3 text-sm" />
          <input value={modelName} onChange={(e) => setModelName(e.target.value)} className="h-10 rounded-md border border-line px-3 text-sm" />
          <input value={promptType} onChange={(e) => setPromptType(e.target.value)} className="h-10 rounded-md border border-line px-3 text-sm" />
        </div>
        <div className="mt-5 flex gap-2">
          <Button onClick={startSimulation} disabled={!projectName.trim() || !modelName.trim() || !promptType.trim() || state === "creating" || state === "running"}>
            {state === "creating" ? "Creating simulation..." : state === "running" ? "Simulation running..." : "Start guided simulation"}
          </Button>
          <Button asChild variant="outline"><Link href={withScopedProject("/onboarding?path=sdk")}>Connect SDK instead</Link></Button>
        </div>
        {error ? <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}
      </Card>

      <Card className="p-6">
        <p className="text-sm text-secondary">State: <span className="font-medium text-primary">{state}</span></p>
        <p className="mt-2 text-sm text-secondary">Stage: <span className="font-medium text-primary">{statusLabel}</span></p>
        <p className="mt-2 text-sm text-secondary">Progress: <span className="font-medium text-primary">{status?.progress ?? 0}%</span></p>
      </Card>
    </div>
  );
}
