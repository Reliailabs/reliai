import { TraceGraphView } from "@/components/presenters/trace-graph-view";
import { demoTraceAnalysis, demoTraceGraph } from "@/lib/demoData";

export default function MarketingTraceGraphScreenshotPage() {
  return <TraceGraphView graph={demoTraceGraph} analysis={demoTraceAnalysis} screenshotMode />;
}
