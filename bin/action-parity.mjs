#!/usr/bin/env node

import process from "node:process";
import { readManifest, validateManifestObject } from "../src/validator.mjs";

const VERSION = "0.3.0";

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
  const conformance = report.conformance ?? { targets: [], achieved: "none", blockers: [], notes: [] };
  const lines = [
    `${report.application?.name ?? "Unknown application"} ${report.application?.version ?? ""}`.trim(),
    `Specification\t${report.spec_version ?? "unknown"}`,
    `Actions\t${summary.actions}`,
    `Headless\t${summary.headless_actions}/${summary.actions}\t${summary.headless_evidenced_actions}/${summary.actions} with evidence`,
    `Externally reachable\t${summary.externally_reachable_actions}/${summary.actions}`,
    `Required bindings\t${summary.present_required_bindings}/${summary.total_required_bindings}`,
    `Declared parity\t${summary.declared_parity_percent}%`,
    `Evidenced parity\t${summary.evidenced_parity_percent}%\t${summary.evidenced_required_bindings}/${summary.total_required_bindings} with a test`,
    `Exceptions\t${summary.declared_exceptions}`,
    `Errors\t${summary.errors}`,
    `Warnings\t${summary.warnings}`,
    `Targets\t${conformance.targets.length > 0 ? conformance.targets.join(", ") : "none declared"}`,
    `Achieved\t${conformance.achieved}`
  ];

  if (mode === "validate") {
    lines.unshift(report.ok ? "VALID" : "INVALID");
  }

  for (const surface of report.surfaces) {
    lines.push(
      `Surface ${surface.id}\t${surface.kind}/${surface.reachability}\t${surface.mapped_actions}/${surface.total_actions}\t${surface.coverage_percent}%\tevidenced ${surface.evidenced_percent}%`
    );
  }

  for (const excluded of summary.excluded_machine_surfaces ?? []) {
    lines.push(
      `Excluded ${excluded.id}\t${excluded.kind}/${excluded.reachability}\tnot required for parity\t${
        excluded.reason ?? "NO REASON STATED"
      }`
    );
  }

  for (const blocker of conformance.blockers) {
    lines.push(`BLOCKER\t${blocker}`);
  }

  for (const note of conformance.notes) {
    lines.push(`NOTE\t${note}`);
  }

  if (report.issues.length > 0) {
    lines.push("");
    for (const item of report.issues) {
      lines.push(`${item.severity.toUpperCase()}\t${item.code}\t${item.path}\t${item.message}`);
    }
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

