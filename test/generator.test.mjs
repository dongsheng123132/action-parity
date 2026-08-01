import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  checkRegistryBundle,
  materializeRegistryBundle
} from "../src/generator.mjs";

test("generated artifact check is read-only and detects drift", async () => {
  const output = await mkdtemp(path.join(os.tmpdir(), "action-parity-generate-"));
  const bundle = registryBundleFixture();
  await materializeRegistryBundle(bundle, output);

  const current = await checkRegistryBundle(bundle, output);
  assert.equal(current.ok, true);
  assert.ok(current.files.every((file) => file.status === "current"));

  await writeFile(path.join(output, "cli-help.json"), "{}\n", "utf8");
  const drifted = await checkRegistryBundle(bundle, output);
  assert.equal(drifted.ok, false);
  assert.equal(
    drifted.files.find((file) => file.path.endsWith("cli-help.json")).status,
    "drifted"
  );
});

test("TypeScript client is opt-in and participates in drift checks", async () => {
  const output = await mkdtemp(path.join(os.tmpdir(), "action-parity-typescript-"));
  const bundle = registryBundleFixture();

  await materializeRegistryBundle(bundle, output, { typescript: true });
  const generated = await readFile(path.join(output, "action-client.ts"), "utf8");
  assert.match(generated, /NOTE_LIST: "note\.list"/);
  assert.match(generated, /"note\.list": Record<string, unknown>;/);
  assert.match(generated, /createTauriActionClient/);

  const current = await checkRegistryBundle(bundle, output, { typescript: true });
  assert.equal(current.ok, true);

  await writeFile(path.join(output, "action-client.ts"), "// hand edited\n", "utf8");
  const drifted = await checkRegistryBundle(bundle, output, { typescript: true });
  assert.equal(drifted.ok, false);
  assert.equal(
    drifted.files.find((file) => file.path.endsWith("action-client.ts")).status,
    "drifted"
  );
});

function registryBundleFixture() {
  return {
    format: "action-parity.registry-bundle/v1",
    manifest: {
      spec_version: "0.5.0",
      application: { id: "org.example.notes", name: "Notes", version: "1.0.0" },
      conformance_targets: ["AP-1"],
      surfaces: [
        {
          id: "cli",
          kind: "cli",
          reachability: "external",
          required_for_parity: true,
          description: "Non-interactive command-line interface."
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
          bindings: [
            { surface: "cli", target: "notes call note.list --json", test: "test.mjs" }
          ]
        }
      ],
      state: { queries: ["note.list"], events: [] }
    },
    cli_help: { commands: [] },
    mcp_tools: { tools: [] }
  };
}
