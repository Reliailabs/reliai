"use server"

import { revalidatePath } from "next/cache"
import { getApiAccessToken } from "@/lib/auth"
import { API_URL } from "@/lib/constants"
import type {
  AiIncidentSummaryResponse,
  AiRootCauseExplanationResponse,
  AiTicketDraftResponse,
} from "@reliai/types"

// ── Helpers ───────────────────────────────────────────────────────────────────

async function authHeaders() {
  const token = await getApiAccessToken()
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
}

async function incidentPost<T>(
  incidentId: string,
  action: string,
  body?: Record<string, unknown>,
): Promise<T> {
  const res = await fetch(`${API_URL}/api/v1/incidents/${incidentId}/${action}`, {
    method: "POST",
    headers: await authHeaders(),
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  })
  if (!res.ok) throw new Error(`Incident ${action} failed: ${res.status}`)
  return res.json() as Promise<T>
}

// ── Lifecycle mutations (return void, revalidate page) ────────────────────────

async function incidentMutate(incidentId: string, action: string): Promise<void> {
  await incidentPost(incidentId, action)
  revalidatePath(`/incidents/${incidentId}`)
  revalidatePath("/incidents")
}

export async function acknowledgeIncident(incidentId: string) {
  return incidentMutate(incidentId, "acknowledge")
}

export async function resolveIncident(incidentId: string) {
  return incidentMutate(incidentId, "resolve")
}

export async function reopenIncident(incidentId: string) {
  return incidentMutate(incidentId, "reopen")
}

// ── AI actions (return data, no revalidate needed) ────────────────────────────

export async function generateAiSummary(
  incidentId: string,
  regenerate = false,
): Promise<AiIncidentSummaryResponse> {
  return incidentPost<AiIncidentSummaryResponse>(incidentId, "ai-summary", { regenerate })
}

export async function generateAiRootCause(
  incidentId: string,
  regenerate = false,
): Promise<AiRootCauseExplanationResponse> {
  return incidentPost<AiRootCauseExplanationResponse>(incidentId, "ai-root-cause", { regenerate })
}

export async function generateAiTicketDraft(
  incidentId: string,
  destination: "jira" | "github" = "github",
  regenerate = false,
): Promise<AiTicketDraftResponse> {
  return incidentPost<AiTicketDraftResponse>(incidentId, "ai-ticket-draft", {
    destination,
    regenerate,
  })
}
