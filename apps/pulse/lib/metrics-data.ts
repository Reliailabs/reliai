import "server-only";

import type { ErrorsSurfaceData } from "@/components/dashboard/pulse-types";
import { getErrorsSurfaceData } from "@/lib/errors-data";

export async function getMetricsSurfaceData(projectId?: string): Promise<ErrorsSurfaceData> {
  return getErrorsSurfaceData(projectId);
}
