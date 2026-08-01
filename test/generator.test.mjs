import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  checkGenerationSource,
  checkRegistryBundle,
  materializeGenerationSource,
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

test("an existing Manifest generates only a TypeScript client and detects drift", async () => {
  const output = await mkdtemp(path.join(os.tmpdir(), "action-parity-manifest-client-"));
  const manifest = registryBundleFixture().manifest;

  const files = await materializeGenerationSource(manifest, output, { typescript: true });
  assert.deepEqual(files.map((file) => path.basename(file)), ["action-client.ts"]);
  const generated = await readFile(path.join(output, "action-client.ts"), "utf8");
  assert.match(generated, /NOTE_LIST: "note\.list"/);

  const current = await checkGenerationSource(manifest, output, { typescript: true });
  assert.equal(current.ok, true);

  await writeFile(path.join(output, "action-client.ts"), "// hand edited\n", "utf8");
  const drifted = await checkGenerationSource(manifest, output, { typescript: true });
  assert.equal(drifted.ok, false);
  assert.equal(drifted.files[0].status, "drifted");
  assert.ok(!files.some((file) => file.endsWith("cli-help.json")));
  assert.ok(!files.some((file) => file.endsWith("mcp-tools.json")));
});

test("generated checks accept CRLF files from a Windows checkout", async () => {
  const bundleOutput = await mkdtemp(path.join(os.tmpdir(), "action-parity-crlf-bundle-"));
  const bundle = registryBundleFixture();
  await materializeRegistryBundle(bundle, bundleOutput, { typescript: true });

  for (const filename of ["action-parity.json", "cli-help.json", "mcp-tools.json", "action-client.ts"]) {
    const target = path.join(bundleOutput, filename);
    const generated = await readFile(target, "utf8");
    await writeFile(target, generated.replace(/\n/g, "\r\n"), "utf8");
  }

  const bundleCheck = await checkRegistryBundle(bundle, bundleOutput, { typescript: true });
  assert.equal(bundleCheck.ok, true);
  assert.ok(bundleCheck.files.every((file) => file.status === "current"));

  const manifestOutput = await mkdtemp(path.join(os.tmpdir(), "action-parity-crlf-manifest-"));
  await materializeGenerationSource(bundle.manifest, manifestOutput, { typescript: true });
  const clientPath = path.join(manifestOutput, "action-client.ts");
  const client = await readFile(clientPath, "utf8");
  await writeFile(clientPath, client.replace(/\n/g, "\r\n"), "utf8");

  const manifestCheck = await checkGenerationSource(bundle.manifest, manifestOutput, { typescript: true });
  assert.equal(manifestCheck.ok, true);
  assert.equal(manifestCheck.files[0].status, "current");
});

test("a Manifest source refuses to invent CLI or MCP artifacts", async () => {
  const output = await mkdtemp(path.join(os.tmpdir(), "action-parity-manifest-honesty-"));
  await assert.rejects(
    () => materializeGenerationSource(registryBundleFixture().manifest, output),
    /pass --typescript/
  );
});

test("CLI --check exits nonzero after a generated Manifest client drifts", async () => {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const temporary = await mkdtemp(path.join(os.tmpdir(), "action-parity-cli-check-"));
  const manifestPath = path.join(temporary, "action-parity.json");
  const output = path.join(temporary, "generated");
  await writeFile(manifestPath, `${JSON.stringify(registryBundleFixture().manifest)}\n`, "utf8");

  const args = [
    path.join(root, "bin", "action-parity.mjs"),
    "generate",
    manifestPath,
    "--out-dir",
    output,
    "--typescript",
    "--json"
  ];
  const generated = spawnSync(process.execPath, args, { encoding: "utf8", windowsHide: true });
  assert.equal(generated.status, 0, generated.stderr);
  assert.equal(JSON.parse(generated.stdout).ok, true);

  const current = spawnSync(process.execPath, [...args, "--check"], {
    encoding: "utf8",
    windowsHide: true
  });
  assert.equal(current.status, 0, current.stderr);
  assert.equal(JSON.parse(current.stdout).data.files[0].status, "current");

  await writeFile(path.join(output, "action-client.ts"), "// hand edited\n", "utf8");
  const drifted = spawnSync(process.execPath, [...args, "--check"], {
    encoding: "utf8",
    windowsHide: true
  });
  assert.equal(drifted.status, 1);
  assert.equal(JSON.parse(drifted.stdout).data.files[0].status, "drifted");
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
