import { cn } from "@/lib/utils";

type StatusDotProps = {
  status?: "critical" | "success" | "neutral";
  className?: string;
};

export function StatusDot({ status = "neutral", className }: StatusDotProps) {
  const tone =
    status === "critical"
      ? "bg-error shadow-[0_0_0_3px_rgba(239,68,68,0.18)] animate-pulse"
      : status === "success"
        ? "bg-success shadow-[0_0_0_3px_rgba(34,197,94,0.16)]"
        : "bg-textSecondary shadow-[0_0_0_3px_rgba(154,164,178,0.2)]";

  return <span className={cn("inline-flex h-2 w-2 rounded-full", tone, className)} />;
}
