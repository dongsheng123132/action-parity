import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { validateManifestObject } from "../src/validator.mjs";

async function fixture(relativePath) {
  const url = new URL(relativePath, import.meta.url);
  return JSON.parse(await readFile(url, "utf8"));
}

test("minimal manifest is valid and has full parity", async () => {
  const manifest = await fixture("../examples/minimal/action-parity.json");
  const report = validateManifestObject(manifest);

  assert.equal(report.ok, true);
  assert.equal(report.summary.actions, 1);
  assert.equal(report.summary.declared_parity_percent, 100);
  assert.equal(report.summary.errors, 0);
});

test("U-King pilot manifest is valid and has full declared parity", async () => {
  const manifest = await fixture("../examples/u-king/action-parity.json");
  const report = validateManifestObject(manifest);

  assert.equal(report.ok, true);
  assert.equal(report.summary.actions, 6);
  assert.equal(report.summary.required_surfaces, 3);
  assert.equal(report.summary.present_required_bindings, 18);
  assert.equal(report.summary.declared_parity_percent, 100);
});

test("a non-POSIX ecosystem is not warned for its own JSON flag spelling", async () => {
  const spellings = [
    "notes note create --title <text> --json",
    "engine/cleaner.ps1 scan -Json",
    "open365.exe /json cleaner scan"
  ];

  for (const target of spellings) {
    const manifest = await fixture("../examples/minimal/action-parity.json");
    const binding = manifest.actions[0].bindings.find((item) => item.surface === "cli");
    binding.target = target;

    const report = validateManifestObject(manifest);

    assert.equal(
      report.issues.some((item) => item.code === "cli_binding_json_not_visible"),
      false,
      `${target} should count as a machine-readable mode`
    );
  }
});

test("a CLI binding with no visible JSON mode still warns", async () => {
  const manifest = await fixture("../examples/minimal/action-parity.json");
  const binding = manifest.actions[0].bindings.find((item) => item.surface === "cli");
  binding.target = "notes note create --title <text>";

  const report = validateManifestObject(manifest);

  assert.ok(report.issues.some((item) => item.code === "cli_binding_json_not_visible"));
});

test("missing required binding fails declared parity", async () => {
  const manifest = await fixture("../examples/minimal/action-parity.json");
  manifest.actions[0].bindings = manifest.actions[0].bindings.filter(
    (binding) => binding.surface !== "cli"
  );

  const report = validateManifestObject(manifest);

  assert.equal(report.ok, false);
  assert.equal(report.summary.declared_parity_percent, 50);
  assert.ok(report.issues.some((item) => item.code === "missing_required_binding"));
  assert.ok(report.issues.some((item) => item.code === "machine_surface_missing"));
});

test("high-risk action cannot silently skip confirmation", async () => {
  const manifest = await fixture("../examples/minimal/action-parity.json");
  manifest.actions[0].effects.risk = "high";
  manifest.actions[0].effects.confirmation = "never";

  const report = validateManifestObject(manifest);

  assert.equal(report.ok, false);
  assert.ok(report.issues.some((item) => item.code === "unsafe_confirmation_policy"));
});

test("rollback action must exist", async () => {
  const manifest = await fixture("../examples/minimal/action-parity.json");
  manifest.actions[0].effects.rollback_action = "note.delete";

  const report = validateManifestObject(manifest);

  assert.equal(report.ok, false);
  assert.ok(report.issues.some((item) => item.code === "unknown_rollback_action"));
});

// SPEC §5.2 violations are the primary output. A level is an optional
// annotation, so the report must be usable with the audit block ignored.
test("violations are separated from unproven claims", async () => {
  const manifest = await fixture("../examples/gui-only/action-parity.json");
  const report = validateManifestObject(manifest);

  const violationCodes = report.violations.map((item) => item.code);
  const unprovenCodes = report.unproven.map((item) => item.code);

  assert.ok(violationCodes.includes("machine_surface_in_process_only"));
  assert.ok(violationCodes.includes("shared_resource_concurrency_undeclared"));
  assert.ok(unprovenCodes.includes("headless_evidence_missing"));
  assert.equal(
    violationCodes.filter((code) => unprovenCodes.includes(code)).length,
    0,
    "a finding belongs to exactly one list"
  );
  for (const item of report.violations) {
    assert.ok(item.path.startsWith("/"), "every violation names a location");
  }
});

test("a conforming manifest reports zero violations", async () => {
  const manifest = await fixture("../examples/u-king/action-parity.json");
  const report = validateManifestObject(manifest);

  assert.deepEqual(report.violations, []);
  assert.deepEqual(report.unproven, []);
});

// The shadow list must not assert what static analysis cannot see. Whether a
// Surface holds its own implementation is a property of code.
test("the shadow list reports reachability and proof, and claims nothing more", async () => {
  const manifest = await fixture("../examples/u-king/action-parity.json");
  const report = validateManifestObject(manifest);

  const cli = report.shadows.find((shadow) => shadow.kind === "cli");
  assert.equal(cli.reachability, "external");
  assert.equal(cli.actions, 6);
  assert.equal(cli.proven_bindings, 6);
  assert.equal(cli.checked, true);
  assert.equal(Object.hasOwn(cli, "violations"), false);
});

test("an unchecked shadow says so instead of disappearing", async () => {
  const manifest = await fixture("../examples/u-king/action-parity.json");
  const mcp = manifest.surfaces.find((surface) => surface.kind === "mcp");
  mcp.required_for_parity = false;
  mcp.exclusion_reason = "The MCP adapter ships one release behind the Action Core.";

  const report = validateManifestObject(manifest);

  assert.equal(report.shadows.find((shadow) => shadow.kind === "mcp").checked, false);
});

// The cc-switch pilot passed AP-2 validation with zero re-runnable evidence.
// Declared and evidenced parity must not be the same number, or a manifest
// written entirely by hand reads as a passing grade.
test("a declaration-only manifest scores full declared parity but zero evidenced parity", async () => {
  const manifest = await fixture("../examples/u-king/action-parity.json");
  for (const action of manifest.actions) {
    for (const binding of action.bindings) {
      delete binding.test;
    }
  }

  const report = validateManifestObject(manifest);

  assert.equal(report.ok, true, "declaration-only manifests still validate");
  assert.equal(report.summary.declared_parity_percent, 100);
  assert.equal(report.summary.evidenced_parity_percent, 0);
  assert.equal(report.summary.evidenced_required_bindings, 0);
});

test("achieved level ignores self-declared targets when evidence is absent", async () => {
  const manifest = await fixture("../examples/u-king/action-parity.json");
  manifest.conformance_targets = ["AP-1", "AP-2", "AP-3"];
  for (const action of manifest.actions) {
    for (const binding of action.bindings) {
      delete binding.test;
    }
  }

  const report = validateManifestObject(manifest);

  assert.deepEqual(report.audit.targets, ["AP-1", "AP-2", "AP-3"]);
  assert.equal(report.audit.achieved, "AP-1");
  assert.ok(report.audit.blockers.some((item) => item.includes("evidenced parity")));
});

// AP-2 is the ceiling for static analysis. Awarding AP-3 from declared fields
// would be the same category error as reporting declared parity as if it were
// evidence.
test("a fully evidenced manifest reaches AP-2 and never claims AP-3", async () => {
  const manifest = await fixture("../examples/u-king/action-parity.json");
  const report = validateManifestObject(manifest);

  assert.equal(report.summary.evidenced_parity_percent, 100);
  assert.equal(report.audit.achieved, "AP-2");
  assert.deepEqual(report.audit.blockers, []);
  assert.ok(report.audit.notes.some((item) => item.includes("AP-3 and AP-4")));
});

// The regression that motivated 0.3.0: this manifest shape passed AP-2 in
// 0.2.0 while no external process could invoke a single Action.
test("a GUI-only app whose only machine Surface is in-process fails AP-2", async () => {
  const manifest = await fixture("../examples/gui-only/action-parity.json");
  const report = validateManifestObject(manifest);

  assert.equal(report.ok, false);
  assert.equal(report.summary.externally_reachable_actions, 0);
  assert.equal(report.audit.achieved, "none");
  assert.ok(report.issues.some((item) => item.code === "machine_surface_in_process_only"));
});

test("stating external reachability explicitly is what lifts an ipc Surface", async () => {
  const manifest = await fixture("../examples/gui-only/action-parity.json");
  manifest.surfaces.find((surface) => surface.id === "ipc").reachability = "local-ipc";

  const report = validateManifestObject(manifest);

  assert.equal(report.summary.externally_reachable_actions, 1);
  assert.ok(!report.issues.some((item) => item.code === "machine_surface_in_process_only"));
});

// Reported by the cc-switch pilot after 0.2.0 landed: the cheapest way to lift
// evidenced parity is to demote the Surface you cannot prove, and that is
// usually the one whose proof carries the architectural invariant.
test("demoting an unprovable machine Surface is reported, never silent", async () => {
  const manifest = await fixture("../examples/u-king/action-parity.json");
  const mcp = manifest.surfaces.find((surface) => surface.kind === "mcp");
  mcp.required_for_parity = false;
  for (const action of manifest.actions) {
    action.bindings = action.bindings.filter((binding) => binding.surface !== mcp.id);
  }

  const report = validateManifestObject(manifest);

  assert.equal(report.summary.declared_parity_percent, 100, "the denominator did shrink");
  assert.equal(report.summary.excluded_machine_surfaces.length, 1);
  assert.equal(report.summary.excluded_machine_surfaces[0].reason, null);
  assert.ok(report.issues.some((item) => item.code === "machine_surface_excluded_without_reason"));
});

test("a stated exclusion reason clears the warning but stays in the report", async () => {
  const manifest = await fixture("../examples/u-king/action-parity.json");
  const mcp = manifest.surfaces.find((surface) => surface.kind === "mcp");
  mcp.required_for_parity = false;
  mcp.exclusion_reason = "The MCP adapter ships one release behind the Action Core.";
  for (const action of manifest.actions) {
    action.bindings = action.bindings.filter((binding) => binding.surface !== mcp.id);
  }

  const report = validateManifestObject(manifest);

  assert.ok(!report.issues.some((item) => item.code === "machine_surface_excluded_without_reason"));
  assert.equal(report.summary.excluded_machine_surfaces.length, 1);
  assert.match(report.summary.excluded_machine_surfaces[0].reason, /one release behind/);
});

// Case F5: two products writing the same config file is where drift actually
// happens, and neither manifest used to mention the other.
test("a shared written resource without a concurrency policy is an error", async () => {
  const manifest = await fixture("../examples/gui-only/action-parity.json");
  const report = validateManifestObject(manifest);

  assert.ok(report.issues.some((item) => item.code === "shared_resource_concurrency_undeclared"));
  assert.equal(report.summary.shared_external_resources[0].concurrency, null);
});

test("last-writer-wins is allowed but never silent", async () => {
  const manifest = await fixture("../examples/gui-only/action-parity.json");
  manifest.state.external_resources[0].concurrency = "last-writer-wins";

  const report = validateManifestObject(manifest);

  assert.ok(!report.issues.some((item) => item.code === "shared_resource_concurrency_undeclared"));
  assert.ok(report.issues.some((item) => item.code === "shared_resource_last_writer_wins"));
});

test("an exclusively owned resource needs no concurrency policy", async () => {
  const manifest = await fixture("../examples/gui-only/action-parity.json");
  manifest.state.external_resources[0].exclusive = true;

  const report = validateManifestObject(manifest);

  assert.ok(!report.issues.some((item) => item.code?.startsWith("shared_resource")));
  assert.deepEqual(report.summary.shared_external_resources, []);
});

test("a test adapter is evidence, not a machine Surface", async () => {
  const manifest = await fixture("../examples/minimal/action-parity.json");
  for (const surface of manifest.surfaces) {
    if (surface.kind === "cli") surface.kind = "test";
  }

  const report = validateManifestObject(manifest);

  assert.equal(report.ok, false);
  assert.ok(report.issues.some((item) => item.code === "machine_surface_missing"));
});

test("declaring AP-3 as a target does not raise the achieved level", async () => {
  const manifest = await fixture("../examples/u-king/action-parity.json");
  manifest.conformance_targets = ["AP-1", "AP-2", "AP-3", "AP-4"];

  const report = validateManifestObject(manifest);

  assert.equal(report.audit.achieved, "AP-2");
});

test("overdue parity exceptions are reported instead of hidden", async () => {
  const manifest = await fixture("../examples/minimal/action-parity.json");
  manifest.actions[0].bindings = manifest.actions[0].bindings.filter(
    (binding) => binding.surface !== "cli"
  );
  manifest.actions[0].parity_exceptions = [
    {
      surface: "cli",
      reason: "The CLI adapter is not implemented yet.",
      owner: "platform-team",
      review_by: "2020-01-01"
    }
  ];

  const report = validateManifestObject(manifest);

  assert.equal(report.summary.declared_exceptions, 1);
  assert.ok(report.issues.some((item) => item.code === "parity_exception_overdue"));
});

test("a parity exception inside its review window does not warn", async () => {
  const manifest = await fixture("../examples/minimal/action-parity.json");
  manifest.actions[0].bindings = manifest.actions[0].bindings.filter(
    (binding) => binding.surface !== "cli"
  );
  manifest.actions[0].parity_exceptions = [
    {
      surface: "cli",
      reason: "The CLI adapter is not implemented yet.",
      owner: "platform-team",
      review_by: "2999-01-01"
    }
  ];

  const report = validateManifestObject(manifest);

  assert.equal(report.summary.declared_exceptions, 1);
  assert.ok(!report.issues.some((item) => item.code === "parity_exception_overdue"));
});

