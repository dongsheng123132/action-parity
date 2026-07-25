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

  assert.deepEqual(report.conformance.targets, ["AP-1", "AP-2", "AP-3"]);
  assert.equal(report.conformance.achieved, "AP-1");
  assert.ok(report.conformance.blockers.some((item) => item.includes("evidenced parity")));
});

// AP-2 is the ceiling for static analysis. Awarding AP-3 from declared fields
// would be the same category error as reporting declared parity as if it were
// evidence.
test("a fully evidenced manifest reaches AP-2 and never claims AP-3", async () => {
  const manifest = await fixture("../examples/u-king/action-parity.json");
  const report = validateManifestObject(manifest);

  assert.equal(report.summary.evidenced_parity_percent, 100);
  assert.equal(report.conformance.achieved, "AP-2");
  assert.deepEqual(report.conformance.blockers, []);
  assert.ok(report.conformance.notes.some((item) => item.includes("AP-3 and AP-4")));
});

test("declaring AP-3 as a target does not raise the achieved level", async () => {
  const manifest = await fixture("../examples/u-king/action-parity.json");
  manifest.conformance_targets = ["AP-1", "AP-2", "AP-3", "AP-4"];

  const report = validateManifestObject(manifest);

  assert.equal(report.conformance.achieved, "AP-2");
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

