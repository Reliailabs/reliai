"use client";

import { useEffect } from "react";

import { trackEvent } from "@/lib/analytics";

interface OnboardingPathTrackerProps {
  path: "choose" | "sdk" | "simulation";
}

export function OnboardingPathTracker({ path }: OnboardingPathTrackerProps) {
  useEffect(() => {
    trackEvent("onboarding_path_selected", { path });
  }, [path]);

  return null;
}
