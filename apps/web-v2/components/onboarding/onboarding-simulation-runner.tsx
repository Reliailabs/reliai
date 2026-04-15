"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

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
  created_at: string;
}

interface OnboardingSimulationRunnerProps {
  defaultProjectName?: string;
  autoStart?: boolean;
}

const MAX_POLLS = 120;
const POLL_INTERVAL_MS = 2500;

export function OnboardingSimulationRunner({ defaultProjectName = "simulation-project", autoStart }: OnboardingSimulationRunnerProps) {
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
    let timer: ReturnType<typeof setInterval> | null = null;

    const stopPolling = () => {
      if (timer !== null) {
        clearInterval(timer);
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
        const payload = await response.json() as SimulationStatusResponse | { detail?: string };
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
            hasNavigatedRef.current = true;
            setState("handoff");
            setTimeout(() => {
              router.push(`/incidents/${simulationStatus.incident_id}/command`);
            }, 1800);
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
      } catch {
        stopPolling();
        setError("Unable to poll simulation status");
        setState("failed");
      } finally {
        inFlight = false;
      }
    };

    poll();
    timer = setInterval(poll, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      stopPolling();
    };
  }, [simulationId, state, router]);

  const startSimulation = useCallback(async () => {
    if (state === "creating" || state === "running") {
      return;
    }

    setState("creating");
    setError(null);
    setStatus(null);
    setSimulationId(null);
    hasNavigatedRef.current = false;

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
      const payload = await response.json() as SimulationCreateResponse | { detail?: string };
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
  }, [modelName, projectName, promptType, state]);

  function resetSimulation() {
    setState("idle");
    setSimulationId(null);
    setStatus(null);
    setError(null);
    hasNavigatedRef.current = false;
  }

  useEffect(() => {
    if (!autoStart || state !== "idle") {
      return;
    }
    startSimulation();
  }, [autoStart, startSimulation, state]);

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-6">
        <p className="text-xs uppercase tracking-widest text-zinc-500">Guided simulation</p>
        <h2 className="mt-3 text-2xl font-semibold text-zinc-100">Generate a hallucination spike — then fix it</h2>
        <p className="mt-3 text-sm leading-6 text-zinc-400">
          We generate a healthy baseline, deploy prompt v42 to inject hallucinations, trigger incident detection,
          and open the incident so you can investigate root cause and verify the fix.
        </p>

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <label className="block space-y-2 text-sm text-zinc-400">
            <span className="text-xs uppercase tracking-wider text-zinc-500">Project name</span>
            <input
              value={projectName}
              onChange={(event) => setProjectName(event.target.value)}
              className="h-11 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 text-sm text-zinc-100"
            />
          </label>
          <label className="block space-y-2 text-sm text-zinc-400">
            <span className="text-xs uppercase tracking-wider text-zinc-500">Model</span>
            <input
              value={modelName}
              onChange={(event) => setModelName(event.target.value)}
              className="h-11 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 text-sm text-zinc-100"
            />
          </label>
          <label className="block space-y-2 text-sm text-zinc-400">
            <span className="text-xs uppercase tracking-wider text-zinc-500">Prompt type</span>
            <input
              value={promptType}
              onChange={(event) => setPromptType(event.target.value)}
              className="h-11 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 text-sm text-zinc-100"
            />
          </label>
        </div>

        <div className="mt-6 space-y-3 text-sm text-zinc-400">
          <div className="rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-3">1. Generating 4% baseline — healthy traces</div>
          <div className="rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-3">2. Deploying prompt v42 — injecting hallucination pattern</div>
          <div className="rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-3">3. Hallucination spike detected — opening incident (19% failure rate)</div>
          <div className="rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-3">4. Root cause scored — investigation ready (71% confidence)</div>
        </div>

        {state === "handoff" ? (
          <div className="mt-6 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-4 space-y-1">
            <p className="text-sm font-semibold text-emerald-400">
              Opening incident: Hallucination spike detected (19% failure rate)
            </p>
            <p className="text-xs text-emerald-500">
              Redirecting to incident command center...
            </p>
          </div>
        ) : null}

        <div className="mt-6 flex flex-wrap gap-2">
          {state === "idle" || state === "failed" ? (
            <button
              onClick={startSimulation}
              disabled={!projectName.trim() || !modelName.trim() || !promptType.trim()}
              className="rounded-lg bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-900 hover:bg-zinc-200 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              Start guided simulation
            </button>
          ) : (
            <button
              disabled
              className="rounded-lg bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-900 opacity-50 cursor-not-allowed"
            >
              {state === "creating" ? "Creating simulation..." : state === "handoff" ? "Opening incident..." : "Simulation running..."}
            </button>
          )}
          {state === "failed" ? (
            <button
              type="button"
              onClick={resetSimulation}
              className="rounded-lg border border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-300 hover:bg-zinc-800 transition"
            >
              Reset
            </button>
          ) : null}
        </div>
        {error ? (
          <div className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">{error}</div>
        ) : null}
      </div>

      <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-6">
        <p className="text-xs uppercase tracking-widest text-zinc-500">Simulation status</p>
        <div className="mt-4 rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-4">
          <p className="text-sm text-zinc-400">State: <span className="font-medium text-zinc-100">{state}</span></p>
          <p className="mt-2 text-sm text-zinc-400">Stage: <span className="font-medium text-zinc-100">{statusLabel}</span></p>
          <p className="mt-2 text-sm text-zinc-400">
            Progress: <span className="font-medium text-zinc-100">{status?.progress ?? (state === "idle" ? 0 : 5)}%</span>
          </p>
          {simulationId ? (
            <p className="mt-2 text-xs text-zinc-500">Simulation ID: {simulationId}</p>
          ) : null}
        </div>

        <p className="mt-5 text-sm leading-6 text-zinc-400">
          {state === "idle" && "Launch the simulation to generate a hallucination spike and open an incident automatically."}
          {state === "creating" && "Allocating project context and enqueuing synthetic trace jobs."}
          {state === "running" && "Generating traces — hallucination pattern injecting after prompt v42 deployment."}
          {state === "handoff" && "Incident opened. Taking you to command center to investigate."}
          {state === "failed" && "Simulation stopped before incident handoff. Adjust input values and try again."}
        </p>
      </div>
    </div>
  );
}