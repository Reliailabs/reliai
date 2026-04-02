# @reliai/sdk

Reliai SDK for trace ingestion and runtime instrumentation.

## Install

```bash
pnpm add @reliai/sdk
# or
npm install @reliai/sdk
```

## Set your API key

Create an API key in **Settings -> API Keys**, then export it:

```bash
export RELIAI_API_KEY=reliai_your_key
```

## Hello trace (minimal)

```ts
import { ReliaiClient } from "@reliai/sdk";

const reliai = new ReliaiClient({ apiKey: process.env.RELIAI_API_KEY });

await reliai.trace({
  model: "gpt-4.1-mini",
  input: "User question",
  output: "Model response",
  success: true,
});
```

## Full example

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
