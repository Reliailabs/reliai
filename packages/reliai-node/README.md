# @reliai/sdk

Reliai SDK for trace ingestion and runtime instrumentation.

## Install

```bash
npm install @reliai/sdk
```

## Quick start

```ts
import { ReliaiClient } from "@reliai/sdk";

const client = new ReliaiClient({ apiKey: process.env.RELIAI_API_KEY });

await client.trace({
  model: "gpt-4.1-mini",
  input: "How do I reset my password?",
  output: "Go to Settings -> Security -> Reset password.",
  success: true,
  promptVersion: "v42",
  requestId: `req_${Date.now()}`,
  metadata: {
    environment: "production",
  },
});
```

## Docs

- Docs: https://reliai.ai/docs
- Getting started: https://reliai.ai/docs/getting-started
