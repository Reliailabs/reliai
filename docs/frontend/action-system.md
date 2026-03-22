# Reliai ACTION System

ACTION is a semantic pattern for operator guidance when the system can make a **specific, timely, high‑confidence** recommendation. It is intentionally rare and must never be used as a generic highlight.

## When to use ACTION
- A clear next step is available.
- The recommendation is specific and time‑sensitive.
- Confidence is high or medium and backed by signal or rules.

## When NOT to use ACTION
- Passive observations or summaries.
- Low confidence or speculative suggestions.
- Marketing, onboarding tips, or promotional content.
- Status, warnings, or generic “important” notes.

## Component API

```tsx
<ActionCallout
  label="Action"
  directive="Inspect supporting traces and recent changes before taking action."
  supporting="Telemetry went stale shortly after a deployment change."
  cta={{ label: "Open related traces", href: "/traces?filter=related" }}
  confidence="high"
  source="root-cause engine"
/>
```

### Props
- `directive` (required): the primary instruction. **Never muted.**
- `supporting` (optional): concise context or evidence.
- `cta` (optional): a single link to the next step.
- `confidence` (optional): `high | medium` only.
- `source` (optional): short provenance label (e.g., `root-cause engine`).

## Usage rules
- Maximum **one ACTION per section** and **one dominant ACTION per page**.
- Do not render ACTION when confidence is low.
- ACTION should not appear in healthy/green states unless the directive is urgent.
- Do not stack multiple ACTIONs; use standard recommendation patterns instead.

## Visual contract
- Warm cream surface with strong dark text.
- Subtle warm border.
- Uppercase eyebrow label.
- No opacity reduction, no disabled appearance.

## Examples
**Good**
- Incident detail: “Roll back retriever version v2 → v1.”
- Command center: “Inspect supporting traces and recent changes.”

**Bad**
- “Consider reviewing logs.” (too vague)
- “Upgrade to Production.” (marketing CTA)
- “No issues detected.” (not an action)
