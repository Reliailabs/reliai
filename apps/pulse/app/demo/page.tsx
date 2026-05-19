import { DemoScenarioSurface } from "@/components/demo/demo-scenario-surface";
import { EntrypointPageViewTracker } from "@/components/entrypoints/entrypoint-page-view-tracker";

export default function DemoPage() {
  return (
    <>
      <EntrypointPageViewTracker route="/demo" />
      <DemoScenarioSurface />
    </>
  );
}
