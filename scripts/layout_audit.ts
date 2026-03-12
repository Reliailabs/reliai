import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

type Violation = {
  file: string;
  line: number;
  detail: string;
};

type ReportCategory = {
  title: string;
  violations: Violation[];
};

const root = process.cwd();
const scanRoots = ["apps/web/app", "apps/web/components"];
const codeExtensions = new Set([".ts", ".tsx"]);

const disallowedContainers = ["max-w-5xl", "max-w-6xl", "max-w-7xl", "max-w-screen-xl"];
const allowedGridGaps = new Set(["gap-4", "gap-6", "gap-8"]);
const screenshotTargets = [
  path.join("apps", "web", "components", "marketing"),
  path.join("apps", "web", "app", "(marketing)"),
  path.join("apps", "web", "app", "marketing"),
];

async function walk(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walk(fullPath)));
      continue;
    }
    if (codeExtensions.has(path.extname(entry.name))) {
      files.push(fullPath);
    }
  }

  return files;
}

function lineNumberFor(content: string, index: number): number {
  return content.slice(0, index).split("\n").length;
}

function collectMatches(content: string, matcher: RegExp, file: string, detailFor: (match: RegExpExecArray) => string) {
  const violations: Violation[] = [];
  matcher.lastIndex = 0;

  for (let match = matcher.exec(content); match; match = matcher.exec(content)) {
    violations.push({
      file,
      line: lineNumberFor(content, match.index),
      detail: detailFor(match),
    });
  }

  return violations;
}

function relativeFile(file: string) {
  return path.relative(root, file);
}

function isScreenshotTarget(file: string) {
  const normalized = relativeFile(file);
  return screenshotTargets.some((target) => normalized.startsWith(target));
}

function screenshotViolations(content: string, file: string): Violation[] {
  const normalized = relativeFile(file);
  const likelyScreenshotFile =
    isScreenshotTarget(file) &&
    (content.includes("/screenshots/") || content.includes("<Image") || content.includes("<img"));

  if (!likelyScreenshotFile) {
    return [];
  }

  const requirements = ["aspect-video", "overflow-hidden", "object-top"];
  const violations: Violation[] = [];

  for (const requirement of requirements) {
    if (!content.includes(requirement)) {
      violations.push({
        file,
        line: 1,
        detail: `missing ${requirement}`,
      });
    }
  }

  return violations;
}

async function main() {
  const files = (
    await Promise.all(scanRoots.map((scanRoot) => walk(path.join(root, scanRoot))))
  ).flat();

  const containerViolations: Violation[] = [];
  const spacingViolations: Violation[] = [];
  const screenshotRuleViolations: Violation[] = [];
  const cardViolations: Violation[] = [];
  const gridGapViolations: Violation[] = [];

  for (const file of files) {
    const content = await readFile(file, "utf8");

    containerViolations.push(
      ...collectMatches(
        content,
        /\b(max-w-5xl|max-w-6xl|max-w-7xl|max-w-screen-xl)\b/g,
        file,
        (match) => `uses ${match[1]}`,
      ),
    );

    spacingViolations.push(
      ...collectMatches(
        content,
        /\b(?:m[trblxy]?|p[trblxy]?|gap|space-[xy]|top|right|bottom|left)-\[[^\]]+\]/g,
        file,
        (match) => `uses arbitrary spacing ${match[0]}`,
      ),
    );

    cardViolations.push(
      ...collectMatches(
        content,
        /\b(rounded-md|border-gray-700|bg-black)\b/g,
        file,
        (match) => `uses custom card token ${match[1]}`,
      ).filter((violation) => {
        const line = content.split("\n")[violation.line - 1] ?? "";
        return line.includes("<Card");
      }),
    );

    gridGapViolations.push(
      ...collectMatches(
        content,
        /\bgap-(\d+)\b/g,
        file,
        (match) => `uses non-standard grid gap gap-${match[1]}`,
      ).filter((violation) => {
        const token = violation.detail.split(" ").at(-1) ?? "";
        return !allowedGridGaps.has(token);
      }),
    );

    gridGapViolations.push(
      ...collectMatches(
        content,
        /\bgap-\[[^\]]+\]/g,
        file,
        (match) => `uses arbitrary grid gap ${match[0]}`,
      ),
    );

    screenshotRuleViolations.push(...screenshotViolations(content, file));
  }

  const categories: ReportCategory[] = [
    {
      title: "Container Width Violations",
      violations: containerViolations,
    },
    {
      title: "Spacing Violations",
      violations: spacingViolations,
    },
    {
      title: "Grid Gap Violations",
      violations: gridGapViolations,
    },
    {
      title: "Screenshot Violations",
      violations: screenshotRuleViolations,
    },
    {
      title: "Card Style Violations",
      violations: cardViolations,
    },
  ];

  const totalViolations = categories.reduce((sum, category) => sum + category.violations.length, 0);

  console.log("Layout Audit Report\n");

  for (const category of categories) {
    console.log(category.title);
    console.log("-".repeat(category.title.length));

    if (category.violations.length === 0) {
      console.log("None\n");
      continue;
    }

    for (const violation of category.violations) {
      console.log(`${relativeFile(violation.file)}:${violation.line}`);
      console.log(`  ${violation.detail}`);
    }
    console.log("");
  }

  console.log(
    totalViolations > 0
      ? `Layout audit completed with ${totalViolations} warning(s).`
      : "Layout audit completed with no warnings.",
  );
}

main().catch((error) => {
  console.error("Layout audit failed to run.");
  console.error(error);
  process.exitCode = 1;
});
