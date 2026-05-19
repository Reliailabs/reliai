import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

import {
  filterEntrypointEvidenceByDays,
  toCSV,
  toJSONL,
} from "@/lib/entrypoint-evidence";
import { getEntrypointEvidenceStoreAdapter } from "@/lib/entrypoint-evidence-store";

function parseDaysArg(argv: string[]): number {
  const daysArg = argv.find((arg) => arg.startsWith("--days="));
  if (!daysArg) return 14;
  const value = Number(daysArg.slice("--days=".length));
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error("invalid_days_arg");
  }
  return value;
}

function parseFormatArg(argv: string[]): "jsonl" | "csv" {
  const formatArg = argv.find((arg) => arg.startsWith("--format="));
  if (!formatArg) return "jsonl";
  const value = formatArg.slice("--format=".length);
  if (value !== "jsonl" && value !== "csv") {
    throw new Error("invalid_format_arg");
  }
  return value;
}

function parseOutputArg(argv: string[]): string | null {
  const outputArg = argv.find((arg) => arg.startsWith("--out="));
  return outputArg ? outputArg.slice("--out=".length) : null;
}

async function main() {
  const argv = process.argv.slice(2);
  const days = parseDaysArg(argv);
  const format = parseFormatArg(argv);
  const outputArg = parseOutputArg(argv);

  const store = getEntrypointEvidenceStoreAdapter();
  const parsed = await store.readAll();

  const filtered = filterEntrypointEvidenceByDays(parsed, days);

  const now = new Date().toISOString().slice(0, 10);
  const defaultName = `entrypoint-events-${days}d-${now}.${format}`;
  const outputPath = outputArg
    ? path.resolve(process.cwd(), outputArg)
    : path.resolve(process.cwd(), "artifacts/phase16", defaultName);

  mkdirSync(path.dirname(outputPath), { recursive: true });
  const content = format === "csv" ? toCSV(filtered) : toJSONL(filtered);
  writeFileSync(outputPath, content, "utf8");

  process.stdout.write(
    JSON.stringify({
      ok: true,
      input: "entrypoint_evidence_store_adapter",
      output: outputPath,
      format,
      days,
      records_exported: filtered.length,
    }) + "\n",
  );
}

Promise.resolve(main()).catch((error) => {
  const message = error instanceof Error ? error.message : "export_failed";
  process.stderr.write(`${message}\n`);
  process.exit(1);
});
