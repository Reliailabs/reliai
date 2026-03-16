"use client";

import { useEffect, useRef, useState } from "react";

interface ControlPanelHeaderTelemetryProps {
  tracesPerSecond: number;
  screenshotMode?: boolean;
}

function formatTracesPerSecond(value: number) {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: value < 10 ? 1 : 0,
    maximumFractionDigits: 1,
  }).format(value);
}

export function ControlPanelHeaderTelemetry({
  tracesPerSecond,
  screenshotMode = false,
}: ControlPanelHeaderTelemetryProps) {
  const mountedAt = useRef(Date.now());
  const [updatedSeconds, setUpdatedSeconds] = useState(screenshotMode ? 5 : 0);

  useEffect(() => {
    if (screenshotMode) {
      setUpdatedSeconds(5);
      return;
    }

    const interval = window.setInterval(() => {
      setUpdatedSeconds(Math.floor((Date.now() - mountedAt.current) / 1000));
    }, 1000);

    return () => window.clearInterval(interval);
  }, [screenshotMode]);

  const seconds = screenshotMode ? Math.min(updatedSeconds, 9) : updatedSeconds;

  return (
    <div className="hidden font-mono text-xs text-zinc-500 sm:block">
      {formatTracesPerSecond(tracesPerSecond)} traces/sec · 1m avg · updated {seconds}s ago
    </div>
  );
}
