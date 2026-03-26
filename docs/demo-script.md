# Reliai 2‑Minute Demo Script

Goal: show the full loop — **detect → understand → act → prove impact** — without improvisation.

## Setup (before the demo)
1. Open the homepage: `/`.
2. Keep a second tab ready at `/incidents`.
3. If using local data, ensure the onboarding simulation can run.

## Script (live flow)

1. **Homepage → Onboarding**
   - Say: “Reliai opens incidents automatically when behavior drifts.”
   - Click **“See your first incident in under 2 minutes.”**

2. **Run the onboarding simulation**
   - Say: “This simulates a regression the platform would detect in production.”
   - Wait for the incident to appear.

3. **Open the incident**
   - Click into the new incident.
   - Say: “Incidents are grouped by fingerprint so we don’t create noise.”

4. **Incident command center**
   - Call out the **root cause** section.
   - Say: “Six causes scored, one recommendation surfaced with evidence.”
   - Point to **recommendation reason** and **evidence**.

5. **Compare or Prompt Diff**
   - Open **cohort diff** or **prompt diff**.
   - Say: “Current window vs baseline, pre‑assembled.”

6. **Apply a fix (or reference a previous fix)**
   - If the demo allows: click **Apply fix** from the trace graph or incident context.
   - If not: say “In production, this action is logged as part of the incident timeline.”

7. **Resolution impact**
   - Return to the command center.
   - Point to **Resolution impact**:
     - “Refusal rate dropped from X% to Y% after the prompt update.”

## Key lines (use these verbatim)
- “Reliai detects regressions and opens incidents without manual triage.”
- “The command center scores root causes and surfaces the most likely fix.”
- “Every fix is recorded against the incident.”
- “We show whether the metric improved after the action.”

## Close
“This is the full operator loop: detect, understand, act, and prove the fix worked.”
