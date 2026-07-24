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
  assert.equal(report.summary.strict_parity_percent, 100);
  assert.equal(report.summary.errors, 0);
});

test("U-King production pilot has full desktop and CLI parity", async () => {
  const manifest = await fixture("../examples/u-king/action-parity.json");
  const report = validateManifestObject(manifest);

  assert.equal(report.ok, true);
  assert.equal(report.summary.actions, 3);
  assert.equal(report.summary.required_surfaces, 2);
  assert.equal(report.summary.present_required_bindings, 6);
  assert.equal(report.summary.strict_parity_percent, 100);
  assert.equal(report.summary.warnings, 0);
});

test("T-King implementation binds desktop, generic CLI, and legacy CLI", async () => {
  const manifest = await fixture("../examples/t-king/action-parity.json");
  const report = validateManifestObject(manifest);

  assert.equal(report.ok, true);
  assert.equal(report.summary.actions, 3);
  assert.equal(report.summary.required_surfaces, 3);
  assert.equal(report.summary.present_required_bindings, 9);
  assert.equal(report.summary.strict_parity_percent, 100);
  assert.ok(
    !report.issues.some((item) => item.code === "cli_binding_json_not_visible")
  );
});

test("U-Model implementation has full Python/Web parity", async () => {
  const manifest = await fixture("../examples/u-model/action-parity.json");
  const report = validateManifestObject(manifest);

  assert.equal(report.ok, true);
  assert.equal(report.summary.actions, 2);
  assert.equal(report.summary.required_surfaces, 3);
  assert.equal(report.summary.present_required_bindings, 6);
  assert.equal(report.summary.strict_parity_percent, 100);
  assert.equal(report.summary.warnings, 0);
});

test("missing required binding fails strict parity", async () => {
  const manifest = await fixture("../examples/minimal/action-parity.json");
  manifest.actions[0].bindings = manifest.actions[0].bindings.filter(
    (binding) => binding.surface !== "cli"
  );

  const report = validateManifestObject(manifest);

  assert.equal(report.ok, false);
  assert.equal(report.summary.strict_parity_percent, 50);
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
