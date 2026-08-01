import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test, { after } from "node:test";
import { fileURLToPath } from "node:url";

const example = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifest = JSON.parse(
  await readFile(path.join(example, "generated", "action-parity.json"), "utf8")
);
const observations = [];

after(async () => {
  await import("node:fs/promises").then(({ writeFile }) =>
    writeFile(
      path.join(example, "generated", "parity-observations.json"),
      `${JSON.stringify(observations, null, 2)}\n`,
      "utf8"
    )
  );
});

test("generated bindings match the registry templates", () => {
  const create = manifest.actions.find((action) => action.id === "note.create");
  assert.equal(
    create.bindings.find((binding) => binding.surface === "gui").target,
    "data-action-id=note.create"
  );
  assert.equal(
    create.bindings.find((binding) => binding.surface === "cli").target,
    "notes-registry call cli note.create <input-json> --json"
  );
  assert.equal(
    create.bindings.find((binding) => binding.surface === "mcp").target,
    "tool:note.create"
  );
});

for (const surface of ["gui", "cli", "mcp"]) {
  for (const actionId of ["note.create", "note.list"]) {
    test(`${surface}/${actionId} forwards execution_id into the Action Core`, () => {
      const executionId = `evidence-${surface}-${actionId}`;
      const input = actionId === "note.create" ? { title: surface } : {};
    const result = spawnSync(
      "cargo",
      [
        "run",
        "--quiet",
        "--manifest-path",
        path.join(example, "Cargo.toml"),
        "--",
        "call",
        surface,
          actionId,
          JSON.stringify(input),
        executionId
      ],
      { cwd: example, shell: false, windowsHide: true, encoding: "utf8" }
    );
    assert.equal(result.status, 0, result.stderr);
    const envelope = JSON.parse(result.stdout);
    assert.equal(envelope.ok, true);
      assert.equal(envelope.action_id, actionId);
    assert.equal(envelope.execution_id, executionId);
    assert.equal(envelope.result.core_execution_id, executionId);
      observations.push({
        action_id: actionId,
        surface,
        request_execution_id: executionId,
        core_execution_id: envelope.result.core_execution_id
      });
    });
  }
}
