import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cli = path.join(root, "bin", "action-parity.mjs");

function run(args) {
  return spawnSync(process.execPath, [cli, ...args], {
    cwd: root,
    encoding: "utf8",
    windowsHide: true
  });
}

test("--version preserves the plain toolchain version", () => {
  const result = run(["--version"]);

  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout.trim(), "0.6.1");
  assert.equal(result.stderr, "");
});

test("--version --json separates toolchain and Manifest specification versions", () => {
  const result = run(["--version", "--json"]);
  const envelope = JSON.parse(result.stdout);

  assert.equal(result.status, 0, result.stderr);
  assert.equal(envelope.ok, true);
  assert.equal(envelope.data.toolchain_version, "0.6.1");
  assert.equal(envelope.data.manifest_spec_version, "0.5.0");
  assert.deepEqual(envelope.data.supported_manifest_spec_versions, ["0.5.0"]);
  assert.equal(envelope.error, null);
});
