import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { validateManifestObject } from "../src/validator.mjs";
import { auditPublicPilot } from "../scripts/check-public-u-king-pilot.mjs";

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
  assert.equal(report.summary.actions, 6);
  assert.equal(report.summary.required_surfaces, 2);
  assert.equal(report.summary.present_required_bindings, 12);
  assert.equal(report.summary.strict_parity_percent, 100);
  assert.equal(report.summary.warnings, 0);
});

test("U-King public manifest does not expose a credential-shaped property", async () => {
  const manifest = await fixture("../examples/u-king/action-parity.json");
  const serialized = JSON.stringify(manifest);

  assert.doesNotMatch(serialized, /\"api_key\"\s*:/i);
});

test("public pilot disclosure gate rejects private paths and credential fields", () => {
  const failures = auditPublicPilot(
    { output_schema: { properties: { api_key: { type: "string" } } } },
    [{ name: "report.md", text: "Evidence is in src-tauri/src/actions.rs." }]
  );

  assert.ok(failures.some((failure) => failure.includes("internal source path")));
  assert.ok(failures.some((failure) => failure.includes("forbidden credential property")));
});

test("public pilot disclosure gate permits semantic evidence", () => {
  const failures = auditPublicPilot(
    { output_schema: { properties: { has_saved_key: { type: "boolean" } } } },
    [{ name: "report.md", text: "The release gate proved a redacted provider catalogue." }]
  );

  assert.deepEqual(failures, []);
});

function cliJsonModeManifest(target) {
  return {
    spec_version: "0.1.0",
    application: { id: "org.example.shell", name: "Shell", version: "1.0.0" },
    surfaces: [{ id: "cli", kind: "cli", required_for_parity: true }],
    actions: [
      {
        id: "thing.check",
        title: "Check",
        description: "Read state.",
        input_schema: { type: "object" },
        output_schema: { type: "object" },
        effects: {
          class: "read",
          risk: "low",
          reversible: true,
          confirmation: "never",
          audit_required: false
        },
        execution: {
          headless: true,
          idempotent: true,
          cancellable: false,
          timeout_ms: 1000
        },
        bindings: [{ surface: "cli", target }]
      }
    ]
  };
}

test("a machine-readable CLI mode may use POSIX, PowerShell, or Windows syntax", () => {
  for (const target of [
    "cli:shell thing check --json",
    "cli:shell.ps1 action run thing.check -Json",
    "cli:shell.exe thing check /json"
  ]) {
    const report = validateManifestObject(cliJsonModeManifest(target));
    assert.ok(
      !report.issues.some((item) => item.code === "cli_binding_json_not_visible"),
      `${target} should count as a machine-readable mode`
    );
  }
});

test("a CLI binding with no machine-readable mode still warns", () => {
  const report = validateManifestObject(cliJsonModeManifest("cli:shell thing check"));

  assert.ok(
    report.issues.some((item) => item.code === "cli_binding_json_not_visible")
  );
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
