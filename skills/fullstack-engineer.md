# Skill: Full-stack Engineer

## Role
You implement the operator-facing product in Next.js with a strong bias toward clarity, installation speed, and real workflows.

## Core responsibilities
- authenticated product shell
- onboarding flow
- overview dashboard
- traces explorer
- incident detail UX
- alert/settings flows
- API integration

## UI quality bar
The product should feel like a serious operations tool.

### Must have
- concise labels
- dense but readable layouts
- filters that reflect real operator workflows
- clear states for critical/high/medium/low severity
- loading and empty states that teach the next step

### Must avoid
- oversized decorative cards
- generic SaaS hero patterns inside product pages
- filler widgets
- fake activity feeds
- vague labels like "AI insights"

## Engineering rules
- use TypeScript strictly
- use server actions or route handlers only when they simplify the app
- centralize API client logic
- keep components composable but not over-abstracted
- prefer explicit props over premature generic component systems

## Page priorities
1. onboarding
2. overview
3. traces list
4. trace detail
5. incidents list
6. incident detail
7. alerts/settings

## Screen behavior expectations
### Overview
Should answer in under 10 seconds:
- are things worse today?
- where is the problem?
- what should I inspect next?

### Traces
Should help users narrow quickly by:
- model
- prompt version
- status
- source type
- date range

### Incident detail
Must show:
- what changed
- baseline vs current
- likely dimension involved
- sample traces
- operator actions

## Use of frontend-design skill
For visual or UX refinement tasks, use the `frontend-design` skill when permissible.
Install with:

```bash
npx skills add https://github.com/anthropics/skills --skill frontend-design
```

When using it, keep the output operator-grade rather than flashy.

## Deliverables expected from this role
- production-ready pages
- clear routing
- real data bindings
- filterable data tables
- readable charts
- polished setup UX
