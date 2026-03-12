# Codex Task
## Implement Screenshot Composition Audit

Goal

Create an automated audit that verifies all Reliai marketing screenshots follow the current screenshot composition standard.

This protects the marketing site, demo routes, and generated product visuals from silent drift.

The audit must report violations only. It must not modify images.

## Canonical Screenshot Standard

Use the repo's current retina standard:

- resolution: `3200 x 2000`
- aspect ratio: `16:10`
- capture viewport: `1600 x 1000`
- capture density: `deviceScaleFactor: 2`
- directory: `apps/web/public/screenshots/`

Approved filenames:

- `control-panel.png`
- `trace-graph.png`
- `incident.png`
- `deployment.png`
- `playground.png`

Each screenshot must map to a reproducible route under:

- `/marketing/screenshot/control-panel`
- `/marketing/screenshot/trace-graph`
- `/marketing/screenshot/incident`
- `/marketing/screenshot/deployment`
- `/marketing/screenshot/playground`

## Implementation

Create:

- `scripts/screenshot_audit.ts`

The script should:

1. scan `apps/web/public/screenshots`
2. inspect PNG metadata
3. verify dimensions are exactly `3200x2000`
4. verify filenames match the approved set
5. verify each screenshot maps to an implemented screenshot route
6. verify the screenshot generators use `1600x1000` viewport settings with `deviceScaleFactor: 2`

Generator scripts to inspect:

- `scripts/generate_screenshots.ts`
- `scripts/generate_marketing_screenshots.ts`
- `scripts/generate_playground_screenshots.ts`

## CLI

Add:

```json
"audit:screenshots": "pnpm exec tsx scripts/screenshot_audit.ts"
```

## CI

Run in CI:

```bash
pnpm audit:screenshots
```

The audit should return a non-zero exit code on violations.

## Expected Result

After implementation:

- screenshots remain centralized
- screenshot naming stays stable
- all assets remain reproducible from screenshot routes
- viewport/resolution drift is caught automatically
