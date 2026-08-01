import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { verifyManifest } from "../src/verifier.mjs";

const sourceManifest = new URL("../examples/minimal/action-parity.json", import.meta.url);

async function fixture() {
  const directory = await mkdtemp(path.join(os.tmpdir(), "action-parity-verify-"));
  const manifest = JSON.parse(await readFile(sourceManifest, "utf8"));
  for (const binding of manifest.actions[0].bindings) binding.test = "checks/parity.test.mjs";
  const manifestPath = path.join(directory, "action-parity.json");
  await writeFile(manifestPath, JSON.stringify(manifest), "utf8");
  return { directory, manifest, manifestPath };
}

function observations(manifest) {
  return manifest.actions.flatMap((action) =>
    action.bindings.map((binding) => ({
      action_id: action.id,
      surface: binding.surface,
      request_execution_id: `${action.id}-${binding.surface}`,
      core_execution_id: `${action.id}-${binding.surface}`
    }))
  );
}

test("verify executes declared tests and hashes a reproducible report", async () => {
  const { directory, manifest, manifestPath } = await fixture();
  await writeFile(path.join(directory, "pass.mjs"), "process.exit(0);\n", "utf8");
  await writeFile(path.join(directory, "observations.json"), JSON.stringify(observations(manifest)), "utf8");
  await writeFile(
    path.join(directory, "action-parity.verify.json"),
    JSON.stringify({
      version: 1,
      tests: [{
        ref: "checks/parity.test.mjs",
        command: [process.execPath, "pass.mjs"],
        observations: "observations.json"
      }]
    }),
    "utf8"
  );

  const outputPath = path.join(directory, "artifacts", "nested", "evidence.json");
  const report = await verifyManifest(manifestPath, { outputPath });
  const persisted = JSON.parse(await readFile(outputPath, "utf8"));

  assert.equal(report.verified, true);
  assert.equal(persisted.report_sha256, report.report_sha256);
  assert.equal(report.bindings.verified, 2);
  assert.equal(report.audit.achieved, "AP-2");
  assert.equal(report.tests[0].exit_code, 0);
  assert.deepEqual(report.tests[0].command, [process.execPath, "pass.mjs"]);
  assert.match(report.report_sha256, /^[a-f0-9]{64}$/);
});

test("a failed command never becomes verified evidence", async () => {
  const { directory, manifest, manifestPath } = await fixture();
  await writeFile(path.join(directory, "fail.mjs"), "process.exit(9);\n", "utf8");
  await writeFile(path.join(directory, "observations.json"), JSON.stringify(observations(manifest)), "utf8");
  await writeFile(
    path.join(directory, "action-parity.verify.json"),
    JSON.stringify({
      version: 1,
      tests: [{
        ref: "checks/parity.test.mjs",
        command: [process.execPath, "fail.mjs"],
        observations: "observations.json"
      }]
    }),
    "utf8"
  );

  const report = await verifyManifest(manifestPath);

  assert.equal(report.verified, false);
  assert.equal(report.tests[0].exit_code, 9);
  assert.equal(report.bindings.verified, 0);
});

test("a passing suite cannot verify a Binding it did not observe", async () => {
  const { directory, manifest, manifestPath } = await fixture();
  await writeFile(path.join(directory, "pass.mjs"), "process.exit(0);\n", "utf8");
  const incomplete = observations(manifest).slice(1);
  await writeFile(path.join(directory, "observations.json"), JSON.stringify(incomplete), "utf8");
  await writeFile(
    path.join(directory, "action-parity.verify.json"),
    JSON.stringify({
      version: 1,
      tests: [{
        ref: "checks/parity.test.mjs",
        command: [process.execPath, "pass.mjs"],
        observations: "observations.json"
      }]
    }),
    "utf8"
  );

  const report = await verifyManifest(manifestPath);

  assert.equal(report.tests[0].passed, true);
  assert.equal(report.bindings.verified, 1);
  assert.equal(report.bindings.entries.filter((binding) => binding.status === "unverified").length, 1);
  assert.equal(report.verified, false);
});

test("a missing executable is captured as failed evidence instead of aborting the report", async () => {
  const { directory, manifest, manifestPath } = await fixture();
  await writeFile(path.join(directory, "observations.json"), JSON.stringify(observations(manifest)), "utf8");
  await writeFile(
    path.join(directory, "action-parity.verify.json"),
    JSON.stringify({
      version: 1,
      tests: [{
        ref: "checks/parity.test.mjs",
        command: ["action-parity-command-that-does-not-exist"],
        observations: "observations.json"
      }]
    }),
    "utf8"
  );

  const report = await verifyManifest(manifestPath);

  assert.equal(report.verified, false);
  assert.equal(report.tests[0].exit_code, null);
  assert.match(report.tests[0].spawn_error, /ENOENT/);
});

test("regenerating catches a hand-edited GUI binding", async () => {
  const { directory, manifest, manifestPath } = await fixture();
  const original = structuredClone(manifest);
  const guiSurface = manifest.surfaces.find((surface) => surface.kind === "gui").id;
  manifest.actions[0].bindings.find((binding) => binding.surface === guiSurface).target =
    "data-action-id=wrong.action";
  await writeFile(manifestPath, JSON.stringify(manifest), "utf8");
  const bundle = {
    format: "action-parity.registry-bundle/v1",
    manifest: original,
    cli_help: { actions: [] },
    mcp_tools: { tools: [] }
  };
  await writeFile(path.join(directory, "bundle.json"), JSON.stringify(bundle), "utf8");
  await writeFile(
    path.join(directory, "emit-bundle.mjs"),
    "import {readFileSync} from 'node:fs'; process.stdout.write(readFileSync(new URL('./bundle.json', import.meta.url)));\n",
    "utf8"
  );
  await writeFile(path.join(directory, "pass.mjs"), "process.exit(0);\n", "utf8");
  await writeFile(path.join(directory, "observations.json"), JSON.stringify(observations(original)), "utf8");
  await writeFile(
    path.join(directory, "action-parity.verify.json"),
    JSON.stringify({
      version: 1,
      generator: { command: [process.execPath, "emit-bundle.mjs"] },
      tests: [{
        ref: "checks/parity.test.mjs",
        command: [process.execPath, "pass.mjs"],
        observations: "observations.json"
      }]
    }),
    "utf8"
  );

  const report = await verifyManifest(manifestPath);

  assert.equal(report.static_validation.ok, true, "the hand edit is schema-valid");
  assert.equal(report.generator.manifest_matches, false);
  assert.equal(report.generator.passed, false);
  assert.equal(report.verified, false);
});
