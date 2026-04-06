"use client";

import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

interface PresenterScaleFrameProps {
  children: React.ReactNode;
  naturalWidth?: number;
  className?: string;
  innerClassName?: string;
}

/**
 * Scales a fixed-width presenter (e.g. 1600px screenshotMode) down to fit its
 * container without clipping or expanding the document scroll width.
 *
 * The outer div measures its available width via ResizeObserver, computes
 * scale = containerWidth / naturalWidth, applies transform: scale() to the
 * inner content div, and sets its own height to match the scaled result.
 */
export function PresenterScaleFrame({
  children,
  naturalWidth = 1600,
  className,
  innerClassName,
}: PresenterScaleFrameProps) {
  const outerRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [scaledHeight, setScaledHeight] = useState<number | undefined>(undefined);

  // Watch outer container width → recalculate scale
  useEffect(() => {
    const outer = outerRef.current;
    if (!outer) return;

    const updateScale = (width: number) => {
      setScale(width / naturalWidth);
    };

    // Initial measurement
    updateScale(outer.getBoundingClientRect().width);

    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        updateScale(entry.contentRect.width);
      }
    });

    ro.observe(outer);
    return () => ro.disconnect();
  }, [naturalWidth]);

  // Watch inner content height → compute scaled height for outer container
  useEffect(() => {
    const inner = innerRef.current;
    if (!inner) return;

    const updateHeight = () => {
      setScaledHeight(inner.getBoundingClientRect().height * scale);
    };

    updateHeight();

    const ro = new ResizeObserver(() => updateHeight());
    ro.observe(inner);
    return () => ro.disconnect();
  }, [scale]);

  return (
    <div
      ref={outerRef}
      className={cn("w-full overflow-hidden", className)}
      style={{ height: scaledHeight }}
    >
      <div
        ref={innerRef}
        className={innerClassName}
        style={{
          width: naturalWidth,
          transformOrigin: "top left",
          transform: `scale(${scale})`,
        }}
      >
        {children}
      </div>
    </div>
  );
}
