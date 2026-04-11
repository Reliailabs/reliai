"use server"

import { revalidatePath } from "next/cache"
import { getApiAccessToken } from "@/lib/auth"
import { API_URL } from "@/lib/constants"

async function incidentPost(incidentId: string, action: string): Promise<void> {
  const token = await getApiAccessToken()
  const res = await fetch(`${API_URL}/api/v1/incidents/${incidentId}/${action}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    cache: "no-store",
  })
  if (!res.ok) {
    throw new Error(`Incident ${action} failed: ${res.status}`)
  }
  revalidatePath(`/incidents/${incidentId}`)
  revalidatePath("/incidents")
}

export async function acknowledgeIncident(incidentId: string) {
  return incidentPost(incidentId, "acknowledge")
}

export async function resolveIncident(incidentId: string) {
  return incidentPost(incidentId, "resolve")
}

export async function reopenIncident(incidentId: string) {
  return incidentPost(incidentId, "reopen")
}
