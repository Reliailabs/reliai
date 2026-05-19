import assert from "node:assert/strict";
import test from "node:test";

import { getEntrypointEvidenceStoreAdapter } from "@/lib/entrypoint-evidence-store";

const originalEnv = { ...process.env };

test.afterEach(() => {
  process.env = { ...originalEnv };
});

test("defaults to local_jsonl adapter outside production", () => {
  process.env = { ...originalEnv, NODE_ENV: "development" };
  delete process.env.RELIAI_ENTRYPOINT_EVIDENCE_STORE_MODE;
  const adapter = getEntrypointEvidenceStoreAdapter();
  assert.ok(adapter);
});

test("fails closed in production when mode is not configured", () => {
  process.env = { ...originalEnv, NODE_ENV: "production" };
  delete process.env.RELIAI_ENTRYPOINT_EVIDENCE_STORE_MODE;
  assert.throws(() => getEntrypointEvidenceStoreAdapter(), /production_persistence_not_configured/);
});

test("fails closed in production when mode is local_jsonl", () => {
  process.env = {
    ...originalEnv,
    NODE_ENV: "production",
    RELIAI_ENTRYPOINT_EVIDENCE_STORE_MODE: "local_jsonl",
  };
  assert.throws(() => getEntrypointEvidenceStoreAdapter(), /production_persistence_must_be_durable/);
});

test("fails when durable_http mode is selected but backend URLs are missing", () => {
  process.env = {
    ...originalEnv,
    NODE_ENV: "production",
    RELIAI_ENTRYPOINT_EVIDENCE_STORE_MODE: "durable_http",
  };
  delete process.env.RELIAI_ENTRYPOINT_EVIDENCE_DURABLE_WRITE_URL;
  delete process.env.RELIAI_ENTRYPOINT_EVIDENCE_DURABLE_READ_URL;

  assert.throws(() => getEntrypointEvidenceStoreAdapter(), /durable_store_not_configured/);
});

test("creates durable_http adapter when backend URLs are configured", () => {
  process.env = {
    ...originalEnv,
    NODE_ENV: "production",
    RELIAI_ENTRYPOINT_EVIDENCE_STORE_MODE: "durable_http",
    RELIAI_ENTRYPOINT_EVIDENCE_DURABLE_WRITE_URL: "https://example.com/write",
    RELIAI_ENTRYPOINT_EVIDENCE_DURABLE_READ_URL: "https://example.com/read",
  };

  const adapter = getEntrypointEvidenceStoreAdapter();
  assert.ok(adapter);
});
