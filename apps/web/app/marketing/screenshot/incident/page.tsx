import { IncidentCommandCenterView } from "@/components/presenters/incident-command-center-view";
import { demoIncidentCommand, demoSuggestedFix } from "@/lib/demoData";

export default function MarketingIncidentScreenshotPage() {
  return (
    <IncidentCommandCenterView
      incidentId={demoIncidentCommand.incident.id}
      command={demoIncidentCommand}
      suggestedFix={demoSuggestedFix}
      screenshotMode
    />
  );
}
