import { readFileSync } from "node:fs";

import {
  appendEntrypointEvidenceRecord,
  getEntrypointEvidenceStorePath,
  parseEntrypointEvidenceLine,
  type EntrypointEvidenceRecord,
} from "@/lib/entrypoint-evidence";

export type EntrypointEvidenceStoreMode = "local_jsonl" | "durable_http";

export interface EntrypointEvidenceStoreAdapter {
  append(record: EntrypointEvidenceRecord): Promise<void>;
  readAll(): Promise<EntrypointEvidenceRecord[]>;
}

class LocalJSONLEntrypointEvidenceStoreAdapter implements EntrypointEvidenceStoreAdapter {
  constructor(private readonly storePath = getEntrypointEvidenceStorePath()) {}

  async append(record: EntrypointEvidenceRecord): Promise<void> {
    appendEntrypointEvidenceRecord(record, this.storePath);
  }

  async readAll(): Promise<EntrypointEvidenceRecord[]> {
    let raw = "";
    try {
      raw = readFileSync(this.storePath, "utf8");
    } catch {
      throw new Error(`missing_store:${this.storePath}`);
    }
    const lines = raw.split("\n").map((line) => line.trim()).filter(Boolean);
    return lines.map((line, index) => {
      try {
        return parseEntrypointEvidenceLine(line);
      } catch (error) {
        const message = error instanceof Error ? error.message : "invalid_line";
        throw new Error(`invalid_record_at_line_${index + 1}:${message}`);
      }
    });
  }
}

class DurableHTTPEntrypointEvidenceStoreAdapter implements EntrypointEvidenceStoreAdapter {
  constructor(
    private readonly writeURL: string,
    private readonly readURL: string,
    private readonly token?: string,
  ) {}

  private headers() {
    const headers: Record<string, string> = {
      "content-type": "application/json",
    };
    if (this.token) {
      headers.authorization = `Bearer ${this.token}`;
    }
    return headers;
  }

  async append(record: EntrypointEvidenceRecord): Promise<void> {
    const response = await fetch(this.writeURL, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({ record }),
    });
    if (!response.ok) {
      throw new Error(`durable_write_failed:${response.status}`);
    }
  }

  async readAll(): Promise<EntrypointEvidenceRecord[]> {
    const response = await fetch(this.readURL, {
      method: "GET",
      headers: this.headers(),
    });
    if (!response.ok) {
      throw new Error(`durable_read_failed:${response.status}`);
    }
    const body = (await response.json()) as { records?: unknown };
    if (!body || !Array.isArray(body.records)) {
      throw new Error("durable_read_invalid_payload");
    }
    return body.records.map((value, index) => {
      try {
        return parseEntrypointEvidenceLine(JSON.stringify(value));
      } catch (error) {
        const message = error instanceof Error ? error.message : "invalid_record";
        throw new Error(`durable_invalid_record_at_${index}:${message}`);
      }
    });
  }
}

function getConfiguredMode(): EntrypointEvidenceStoreMode {
  const raw = process.env.RELIAI_ENTRYPOINT_EVIDENCE_STORE_MODE?.trim();
  if (!raw) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("production_persistence_not_configured");
    }
    return "local_jsonl";
  }
  if (raw !== "local_jsonl" && raw !== "durable_http") {
    throw new Error(`invalid_store_mode:${raw}`);
  }
  if (process.env.NODE_ENV === "production" && raw !== "durable_http") {
    throw new Error("production_persistence_must_be_durable");
  }
  return raw;
}

function createDurableHTTPAdapter(): DurableHTTPEntrypointEvidenceStoreAdapter {
  const writeURL = process.env.RELIAI_ENTRYPOINT_EVIDENCE_DURABLE_WRITE_URL?.trim();
  const readURL = process.env.RELIAI_ENTRYPOINT_EVIDENCE_DURABLE_READ_URL?.trim();
  if (!writeURL || !readURL) {
    throw new Error("durable_store_not_configured");
  }
  const token = process.env.RELIAI_ENTRYPOINT_EVIDENCE_DURABLE_TOKEN?.trim();
  return new DurableHTTPEntrypointEvidenceStoreAdapter(writeURL, readURL, token || undefined);
}

export function getEntrypointEvidenceStoreAdapter(): EntrypointEvidenceStoreAdapter {
  const mode = getConfiguredMode();
  if (mode === "local_jsonl") {
    return new LocalJSONLEntrypointEvidenceStoreAdapter();
  }
  return createDurableHTTPAdapter();
}
