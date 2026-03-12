import { readdir, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import process from "node:process";

type Violation = {
  file: string;
  detail: string;
};

const root = process.cwd();
const screenshotDir = path.join(root, "apps/web/public/screenshots");
const screenshotRouteDir = path.join(root, "apps/web/app/marketing/screenshot");
const expectedFiles = [
  "control-panel.png",
  "trace-graph.png",
  "incident.png",
  "deployment.png",
  "playground.png",
] as const;
const generatorScripts = [
  "scripts/generate_screenshots.ts",
  "scripts/generate_marketing_screenshots.ts",
  "scripts/generate_playground_screenshots.ts",
];

const report = {
  invalidLocation: [] as Violation[],
  invalidDimensions: [] as Violation[],
  invalidNames: [] as Violation[],
  missingRoutes: [] as Violation[],
  generatorViewport: [] as Violation[],
};

function parsePngDimensions(buffer: Buffer) {
  const pngSignature = "89504e470d0a1a0a";
  if (buffer.subarray(0, 8).toString("hex") !== pngSignature) {
    throw new Error("Not a PNG file");
  }

  const width = buffer.readUInt32BE(16);
  const height = buffer.readUInt32BE(20);
  return { width, height };
}

async function readScreenshotFiles() {
  const entries = await readdir(screenshotDir, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && !entry.name.startsWith("."))
    .map((entry) => entry.name)
    .sort();
}

async function readRouteNames() {
  if (!existsSync(screenshotRouteDir)) return new Set<string>();

  const entries = await readdir(screenshotRouteDir, { withFileTypes: true });
  return new Set(
    entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort(),
  );
}

async function auditScreenshots() {
  const files = await readScreenshotFiles();
  const routes = await readRouteNames();

  for (const file of files) {
    if (!expectedFiles.includes(file as (typeof expectedFiles)[number])) {
      report.invalidNames.push({
        file,
        detail: `filename must be one of: ${expectedFiles.join(", ")}`,
      });
    }

    const fullPath = path.join(screenshotDir, file);
    if (!fullPath.startsWith(screenshotDir)) {
      report.invalidLocation.push({
        file,
        detail: "screenshot must live inside apps/web/public/screenshots",
      });
    }

    const dimensions = parsePngDimensions(await readFile(fullPath));
    if (dimensions.width !== 3200 || dimensions.height !== 2000) {
      report.invalidDimensions.push({
        file,
        detail: `expected 3200x2000, found ${dimensions.width}x${dimensions.height}`,
      });
    }

    const routeName = file.replace(/\.png$/, "");
    if (!routes.has(routeName)) {
      report.missingRoutes.push({
        file,
        detail: `missing matching route in apps/web/app/marketing/screenshot/${routeName}`,
      });
    }
  }

  for (const expected of expectedFiles) {
    if (!files.includes(expected)) {
      report.invalidNames.push({
        file: expected,
        detail: "expected marketing screenshot is missing",
      });
    }
  }
}

async function auditGeneratorScripts() {
  for (const script of generatorScripts) {
    const fullPath = path.join(root, script);
    const contents = await readFile(fullPath, "utf8");
    const hasWidth = /width:\s*1600/.test(contents);
    const hasHeight = /height:\s*1000/.test(contents);
    const hasRetinaScale = /deviceScaleFactor:\s*2/.test(contents);

    if (!hasWidth || !hasHeight || !hasRetinaScale) {
      report.generatorViewport.push({
        file: script,
        detail: "expected viewport width 1600, height 1000, and deviceScaleFactor 2",
      });
    }
  }
}

function printSection(title: string, violations: Violation[]) {
  console.log(title);
  console.log("-".repeat(title.length));

  if (violations.length === 0) {
    console.log("None");
    console.log("");
    return;
  }

  for (const violation of violations) {
    console.log(violation.file);
    console.log(`  ${violation.detail}`);
  }
  console.log("");
}

async function main() {
  await auditScreenshots();
  await auditGeneratorScripts();

  console.log("Screenshot Audit Report");
  console.log("");

  printSection("Invalid Dimensions", report.invalidDimensions);
  printSection("Invalid Filename", report.invalidNames);
  printSection("Missing Route", report.missingRoutes);
  printSection("Generator Viewport Drift", report.generatorViewport);
  printSection("Invalid Screenshot Location", report.invalidLocation);

  const totalViolations = Object.values(report).reduce((count, violations) => count + violations.length, 0);
  if (totalViolations > 0) {
    console.error(`Screenshot audit failed with ${totalViolations} violation(s).`);
    process.exitCode = 1;
    return;
  }

  console.log("Screenshot audit passed.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
