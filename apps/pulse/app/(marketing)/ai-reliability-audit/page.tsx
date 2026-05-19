import { AuditPage } from "@/components/marketing-linear/audit-page"
import { EntrypointPageViewTracker } from "@/components/entrypoints/entrypoint-page-view-tracker";

export default function AIReliabilityAudit() {
  return (
    <>
      <EntrypointPageViewTracker route="/ai-reliability-audit" />
      <AuditPage />
    </>
  );
}
