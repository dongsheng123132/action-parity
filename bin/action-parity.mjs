#!/usr/bin/env node

import process from "node:process";
import { readManifest, validateManifestObject } from "../src/validator.mjs";

const VERSION = "0.5.0";

function usage() {
  return `ActionParity ${VERSION}

Usage:
  action-parity validate <manifest> [--json] [--quiet]
  action-parity report <manifest> [--json] [--quiet]
  action-parity --version

Exit codes:
  0  valid / conformant
  1  runtime or conformance failure
  2  invalid usage`;
}

function jsonEnvelope(report, runtimeError = null) {
  return {
    ok: runtimeError === null && report?.ok === true,
    data: report,
    error: runtimeError ?? (report?.ok ? null : "manifest_not_conformant")
  };
}

function printHumanReport(report, mode) {
  const summary = report.summary;
  const audit = report.audit ?? { targets: [], achieved: "none", blockers: [], notes: [] };
  const violations = report.violations ?? [];
  const unproven = report.unproven ?? [];
  const lines = [
    `${report.application?.name ?? "Unknown application"} ${report.application?.version ?? ""}`.trim(),
    `Specification\t${report.spec_version ?? "unknown"}`,
    `Actions\t${summary.actions}`,
    ""
  ];

  if (mode === "validate") {
    lines.unshift(report.ok ? "VALID" : "INVALID");
  }

  // One core, many shadows: name the shadows before anything else.
  for (const shadow of report.shadows ?? []) {
    lines.push(
      `Shadow ${shadow.id}\t${shadow.kind}/${shadow.reachability}\t${shadow.actions} action(s)\t${
        shadow.proven_bindings
      } proven\t${shadow.checked ? "checked" : "NOT CHECKED"}`
    );
  }

  lines.push("", `Violations\t${violations.length}`);
  for (const item of violations) {
    lines.push(`  ${item.code}\t${item.path}\t${item.message}`);
  }

  lines.push("", `Unproven\t${unproven.length}`);
  for (const item of unproven) {
    lines.push(`  ${item.code}\t${item.path}\t${item.message}`);
  }

  for (const resource of summary.shared_external_resources ?? []) {
    lines.push(
      `Shared resource\t${resource.path}\t${resource.access}\t${
        resource.concurrency ?? "NO CONCURRENCY POLICY"
      }`
    );
  }

  for (const excluded of summary.excluded_machine_surfaces ?? []) {
    lines.push(
      `Excluded ${excluded.id}\t${excluded.kind}/${excluded.reachability}\tnot checked\t${
        excluded.reason ?? "NO REASON STATED"
      }`
    );
  }

  const otherIssues = report.issues.filter(
    (item) => !violations.includes(item) && !unproven.includes(item)
  );
  if (otherIssues.length > 0) {
    lines.push("");
    for (const item of otherIssues) {
      lines.push(`${item.severity.toUpperCase()}\t${item.code}\t${item.path}\t${item.message}`);
    }
  }

  // Optional audit profile — docs/AUDIT-PROFILE.md. Annotation, not headline.
  lines.push(
    "",
    `-- audit profile (optional) --`,
    `Declared parity\t${summary.declared_parity_percent}%`,
    `Evidenced parity\t${summary.evidenced_parity_percent}%\t${summary.evidenced_required_bindings}/${summary.total_required_bindings} with a test`,
    `Exceptions\t${summary.declared_exceptions}`,
    `Targets\t${audit.targets.length > 0 ? audit.targets.join(", ") : "none declared"}`,
    `Achieved\t${audit.achieved}`
  );

  for (const blocker of audit.blockers) {
    lines.push(`BLOCKER\t${blocker}`);
  }

  process.stdout.write(`${lines.join("\n")}\n`);
}

function failUsage(message, jsonMode) {
  if (jsonMode) {
    process.stdout.write(
      `${JSON.stringify({ ok: false, data: null, error: "invalid_usage", message })}\n`
    );
  } else {
    process.stderr.write(`${message}\n\n${usage()}\n`);
  }
  process.exitCode = 2;
}

async function main() {
  const args = process.argv.slice(2);
  const jsonMode = args.includes("--json");
  const quiet = args.includes("--quiet") || args.includes("-q");
  const positional = args.filter((arg) => !["--json", "--quiet", "-q"].includes(arg));

  if (positional.length === 1 && positional[0] === "--version") {
    process.stdout.write(`${VERSION}\n`);
    return;
  }

  if (positional.length !== 2 || !["validate", "report"].includes(positional[0])) {
    failUsage("Expected validate or report and a manifest path.", jsonMode);
    return;
  }

  const [mode, manifestPath] = positional;

  try {
    const manifest = await readManifest(manifestPath);
    const report = validateManifestObject(manifest);

    if (jsonMode) {
      process.stdout.write(`${JSON.stringify(jsonEnvelope(report))}\n`);
    } else if (!quiet || !report.ok) {
      printHumanReport(report, mode);
    }

    process.exitCode = report.ok ? 0 : 1;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (jsonMode) {
      process.stdout.write(
        `${JSON.stringify({
          ok: false,
          data: null,
          error: "manifest_read_failed",
          message
        })}\n`
      );
    } else {
      process.stderr.write(`Failed to read or validate manifest: ${message}\n`);
    }
    process.exitCode = 1;
  }
}

await main();

