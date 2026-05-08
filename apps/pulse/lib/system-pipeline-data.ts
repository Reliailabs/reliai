import "server-only";

import { API_URL } from "@/lib/constants";
import { getApiAccessToken } from "@/lib/auth";

type EventPipelineConsumerRead = {
  consumer_name: string;
  topic: string;
  health: string;
  processing_rate_per_minute: number;
  lag: number;
  processed_events_total: number;
  processed_events_recent: number;
  error_count_total: number;
  error_count_recent: number;
  average_processing_latency_ms: number | null;
  last_processed_at: string | null;
  last_error_at: string | null;
};

type EventPipelineRead = {
  topic: string;
  dead_letter_topic: string | null;
  total_events_published: number;
  recent_events_published: number;
  window_minutes: number;
  consumers: EventPipelineConsumerRead[];
};

export type SystemPipelineSurfaceData = {
  pipeline: EventPipelineRead | null;
  sourceErrors: string[];
};

export async function getSystemPipelineSurfaceData(): Promise<SystemPipelineSurfaceData> {
  const token = await getApiAccessToken();
  if (!token) {
    return { pipeline: null, sourceErrors: ["session"] };
  }

  try {
    const response = await fetch(`${API_URL}/api/v1/system/event-pipeline`, {
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      cache: "no-store",
    });
    if (!response.ok) {
      return { pipeline: null, sourceErrors: ["system-pipeline"] };
    }
    const payload = (await response.json()) as { pipeline: EventPipelineRead };
    return { pipeline: payload.pipeline, sourceErrors: [] };
  } catch {
    return { pipeline: null, sourceErrors: ["system-pipeline"] };
  }
}
