import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { DOCTOR_FORMAT, doctorProject } from "../src/doctor.mjs";

test("doctor gives an agent a read-only Tauri migration inventory", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "action-parity-doctor-"));
  await mkdir(path.join(root, "src-tauri", "src"), { recursive: true });
  await mkdir(path.join(root, "src"), { recursive: true });
  await mkdir(path.join(root, "profiles"), { recursive: true });
  await mkdir(path.join(root, "node_modules", "ignored"), { recursive: true });

  await writeFile(
    path.join(root, "src-tauri", "src", "actions.rs"),
    `pub const NOTE_LIST: &str = "note.list";\n#[test]\nfn registry_works() {}\n`
  );
  await writeFile(
    path.join(root, "src-tauri", "src", "lib.rs"),
    `#[tauri::command]\nasync fn list_notes() {}\n`
  );
  await writeFile(
    path.join(root, "src", "core.ts"),
    `export const ACTION = { list: "note.list" };\ninvoke("list_notes");\ninvoke("plugin:dialog|confirm");\n`
  );
  await writeFile(
    path.join(root, "src", "App.tsx"),
    `<button data-action-id="note.list">List</button>\n`
  );
  await writeFile(
    path.join(root, "profiles", "legacy.action-profile.json"),
    `${JSON.stringify({
      profile_id: "legacy.notes",
      actions: {
        "note.create": { steps: [{ id: "click" }], success_evidence: [{ kind: "file.exists" }] }
      }
    }, null, 2)}\n`
  );
  await writeFile(path.join(root, "AGENTS.md"), "# Agent instructions\nUse the registry.\n");
  await writeFile(
    path.join(root, "action-parity.json"),
    `${JSON.stringify(guiOnlyManifest(), null, 2)}\n`
  );
  await writeFile(
    path.join(root, "pyproject.toml"),
    `[project]\nname = "notes"\n\n[project.scripts]\nnotes = "notes.cli:main"\n\n[tool.example]\nenabled = true\n`
  );
  await writeFile(path.join(root, "node_modules", "ignored", "bad.ts"), `invoke("must_not_appear");\n`);

  const report = await doctorProject(root);

  assert.equal(report.ok, true);
  assert.equal(report.format, DOCTOR_FORMAT);
  assert.equal(report.observations.tauri.summary.command_definitions, 1);
  assert.equal(report.observations.tauri.summary.invoke_call_sites, 2);
  assert.deepEqual(report.observations.tauri.summary.invoked_without_detected_definition, [
    "plugin:dialog|confirm"
  ]);
  assert.equal(report.observations.compatibility_summary.actions, 1);
  assert.equal(report.observations.tests.by_language.rust, 1);
  assert.equal(report.observations.agent_instructions.length, 1);
  assert.equal(report.observations.manifests[0].valid, true);
  assert.equal(report.observations.manifests[0].conforms, false);
  assert.deepEqual(report.observations.entrypoints.python_scripts.map((item) => item.name), ["notes"]);
  assert.ok(report.findings.some((finding) => finding.code === "action_id_drift_risk"));
  assert.ok(report.findings.some((finding) => finding.code === "manifest_nonconforming"));
  assert.ok(report.next_steps.some((step) => step.code === "generate_surface_bindings"));
});

function guiOnlyManifest() {
  return {
    spec_version: "0.5.0",
    application: { id: "org.example.notes", name: "Notes", version: "1.0.0" },
    surfaces: [
      {
        id: "desktop",
        kind: "gui",
        reachability: "in-process",
        required_for_parity: true,
        description: "GUI only."
      }
    ],
    actions: [
      {
        id: "note.list",
        title: "List notes",
        description: "List notes.",
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
          timeout_ms: 1000,
          headless_evidence: "test.mjs"
        },
        bindings: [{ surface: "desktop", target: "button#notes", test: "test.mjs" }]
      }
    ],
    state: { queries: ["note.list"], events: [] }
  };
}
