"use client";

import { useEffect } from "react";

import {
  type EntrypointRoute,
  type EntrypointSourceAttribution,
  trackEntrypointPageViewed,
} from "@/lib/entrypoint-analytics";

type EntrypointPageViewTrackerProps = {
  route: EntrypointRoute;
  sourceAttribution?: EntrypointSourceAttribution;
};

export function EntrypointPageViewTracker({ route, sourceAttribution }: EntrypointPageViewTrackerProps) {
  useEffect(() => {
    trackEntrypointPageViewed(route, sourceAttribution);
  }, [route, sourceAttribution]);

  return null;
}
