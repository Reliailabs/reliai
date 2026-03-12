import Image from "next/image";

import { cn } from "@/lib/utils";

export const marketingContainerClass = "mx-auto w-full max-w-[1200px] px-6";
export const marketingSectionClass = "mt-24";
export const marketingSectionLargeClass = "mt-32";
export const marketingCardClass = "rounded-xl border border-zinc-200 bg-white p-6 shadow-sm";
export const marketingMetricClass = "font-mono tracking-[-0.03em]";

interface MarketingScreenshotCardProps {
  alt: string;
  src: string;
  className?: string;
  viewportClassName?: string;
  imageClassName?: string;
  priority?: boolean;
}

export function MarketingScreenshotCard({
  alt,
  src,
  className,
  viewportClassName,
  imageClassName,
  priority = false,
}: MarketingScreenshotCardProps) {
  return (
    <div className={cn("w-full overflow-hidden rounded-xl border border-zinc-200 bg-zinc-100 shadow-sm", className)}>
      <div className={cn("aspect-video w-full overflow-hidden", viewportClassName)}>
        <Image
          src={src}
          alt={alt}
          width={3200}
          height={2000}
          priority={priority}
          className={cn("h-full w-full object-cover object-top", imageClassName)}
        />
      </div>
    </div>
  );
}
