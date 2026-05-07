import "server-only";

import type { ErrorsSurfaceData } from "@/components/dashboard/pulse-types";
import { getErrorsSurfaceData } from "@/lib/errors-data";

export async function getMetricsSurfaceData(): Promise<ErrorsSurfaceData> {
  return getErrorsSurfaceData();
}
