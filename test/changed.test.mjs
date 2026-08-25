import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { resolveChangedScope, globToRegExp } from "../src/changed.mjs";
import { runCommand } from "../src/exec.mjs";
import { verifyManifest } from "../src/verifier.mjs";

/**
 * These tests exist to attack one property: a scoped run must never skip work
 * it cannot prove is unaffected. Narrowing correctly is useful; narrowing
 * wrongly turns a quick check into a false claim of coverage.
 */

const action = (id, testRef) => ({
  id,
  title: id,
  description: `Fixture Action ${id} for change-scope tests.`,
  effects: {
    class: "write",
    risk: "low",
    reversible: true,
    confirmation: "never",
    audit_required: true
  },
  execution: { headless: true, idempotent: true, cancellable: false, timeout_ms: 5000 },
  input_schema: { type: "object", additionalProperties: false, properties: {} },
  output_schema: { type: "object", additionalProperties: false, properties: {} },
  bindings: [
    { surface: "cli", target: `demo ${id}`, test: testRef },
    { surface: "gui", target: `data-action-id=${id}`, test: testRef }
  ]
});

const MANIFEST = {
  spec_version: "0.5.0",
  application: { id: "demo", name: "Demo", version: "1.0.0" },
  surfaces: [
    { id: "cli", kind: "cli", required_for_parity: true },
    { id: "gui", kind: "gui", required_for_parity: true }
  ],
  actions: [
    action("task.create", "tests/create.test.mjs"),
    action("task.delete", "tests/delete.test.mjs")
  ]
};

const PLAN = {
  version: 1,
  tests: [
    { ref: "tests/create.test.mjs", command: ["node", "x"], observations: "o.json" },
    { ref: "tests/delete.test.mjs", command: ["node", "x"], observations: "o.json" }
  ],
  sources: {
    "task.create": ["src/create.mjs"],
    "task.delete": ["src/delete.mjs"]
  },
  scope_ignore: ["docs/**", "*.md"]
};

async function makeRepo() {
  const root = await mkdtemp(path.join(os.tmpdir(), "ap-changed-"));
  await mkdir(path.join(root, "src"), { recursive: true });
  await mkdir(path.join(root, "tests"), { recursive: true });
  await mkdir(path.join(root, "docs"), { recursive: true });
  const write = (relative, content) => writeFile(path.join(root, relative), content, "utf8");
  await write("src/create.mjs", "export const create = 1;\n");
  await write("src/delete.mjs", "export const remove = 1;\n");
  await write("tests/create.test.mjs", "// create\n");
  await write("tests/delete.test.mjs", "// delete\n");
  await write("docs/guide.md", "# guide\n");
  await write("README.md", "# readme\n");
  await write("action-parity.json", `${JSON.stringify(MANIFEST, null, 2)}\n`);

  const git = (args) => runCommand(["git", ...args], { cwd: root, timeoutMs: 20_000 });
  await git(["init", "-q"]);
  await git(["config", "user.email", "test@example.com"]);
  await git(["config", "user.name", "Test"]);
  await git(["add", "-A"]);
  await git(["commit", "-q", "-m", "base"]);
  return { root, write, git };
}

function scopeFor(root) {
  return resolveChangedScope(MANIFEST, PLAN, {
    planDirectory: root,
    manifestPath: path.join(root, "action-parity.json"),
    base: "HEAD"
  });
}

test("a declared source narrows the run to the Action it implements", async () => {
  const { root, write } = await makeRepo();
  try {
    await write("src/create.mjs", "export const create = 2;\n");
    const scope = await scopeFor(root);
    assert.equal(scope.full, false);
    assert.deepEqual(scope.affected_action_ids, ["task.create"]);
    assert.deepEqual(scope.skipped_action_ids, ["task.delete"]);
    assert.deepEqual(scope.tests, ["tests/create.test.mjs"]);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("an unattributable change runs everything instead of guessing", async () => {
  const { root, write } = await makeRepo();
  try {
    await write("src/mystery.mjs", "export const surprise = 1;\n");
    const scope = await scopeFor(root);
    assert.equal(scope.full, true);
    assert.match(scope.full_reason, /could not be attributed/);
    assert.deepEqual(scope.affected_action_ids, ["task.create", "task.delete"]);
    assert.deepEqual(scope.unattributed_files, ["src/mystery.mjs"]);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("one unattributable file widens a run that would otherwise have narrowed", async () => {
  const { root, write } = await makeRepo();
  try {
    await write("src/create.mjs", "export const create = 2;\n");
    await write("src/mystery.mjs", "export const surprise = 1;\n");
    const scope = await scopeFor(root);
    assert.equal(scope.full, true);
    assert.deepEqual(scope.affected_action_ids, ["task.create", "task.delete"]);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("an ignored path reaches no Action and leaves nothing to run", async () => {
  const { root, write } = await makeRepo();
  try {
    await write("docs/guide.md", "# guide changed\n");
    await write("README.md", "# readme changed\n");
    const scope = await scopeFor(root);
    assert.equal(scope.full, false);
    assert.deepEqual(scope.affected_action_ids, []);
    assert.deepEqual(scope.tests, []);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("changing a declared test selects the Actions bound to it", async () => {
  const { root, write } = await makeRepo();
  try {
    await write("tests/delete.test.mjs", "// delete changed\n");
    const scope = await scopeFor(root);
    assert.equal(scope.full, false);
    assert.deepEqual(scope.affected_action_ids, ["task.delete"]);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("editing one Action in the Manifest selects only that Action", async () => {
  const { root, write } = await makeRepo();
  try {
    const edited = structuredClone(MANIFEST);
    edited.actions[1].bindings[0].target = "demo remove";
    await write("action-parity.json", `${JSON.stringify(edited, null, 2)}\n`);
    const scope = await resolveChangedScope(edited, PLAN, {
      planDirectory: root,
      manifestPath: path.join(root, "action-parity.json"),
      base: "HEAD"
    });
    assert.equal(scope.full, false);
    assert.deepEqual(scope.affected_action_ids, ["task.delete"]);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("changing a Surface widens to a full run because every Binding is remeasured", async () => {
  const { root, write } = await makeRepo();
  try {
    const edited = structuredClone(MANIFEST);
    edited.surfaces.push({ id: "mcp", required_for_parity: true });
    await write("action-parity.json", `${JSON.stringify(edited, null, 2)}\n`);
    const scope = await resolveChangedScope(edited, PLAN, {
      planDirectory: root,
      manifestPath: path.join(root, "action-parity.json"),
      base: "HEAD"
    });
    assert.equal(scope.full, true);
    assert.match(scope.full_reason, /surfaces, spec version, or application identity/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("removing an Action widens to a full run", async () => {
  const { root, write } = await makeRepo();
  try {
    const edited = structuredClone(MANIFEST);
    edited.actions = [MANIFEST.actions[0]];
    await write("action-parity.json", `${JSON.stringify(edited, null, 2)}\n`);
    const scope = await resolveChangedScope(edited, PLAN, {
      planDirectory: root,
      manifestPath: path.join(root, "action-parity.json"),
      base: "HEAD"
    });
    assert.equal(scope.full, true);
    assert.match(scope.full_reason, /was removed/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("a staged change counts, not just an unstaged one", async () => {
  const { root, write, git } = await makeRepo();
  try {
    await write("src/create.mjs", "export const create = 3;\n");
    await git(["add", "src/create.mjs"]);
    const scope = await scopeFor(root);
    assert.deepEqual(scope.affected_action_ids, ["task.create"]);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("outside a git repository the scope refuses to narrow", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "ap-nogit-"));
  try {
    const scope = await resolveChangedScope(MANIFEST, PLAN, {
      planDirectory: root,
      manifestPath: path.join(root, "action-parity.json"),
      base: "HEAD"
    });
    assert.equal(scope.full, true);
    assert.ok(scope.error);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("a plan with no declared sources can never narrow a source edit", async () => {
  const { root, write } = await makeRepo();
  try {
    await write("src/create.mjs", "export const create = 4;\n");
    const scope = await resolveChangedScope(MANIFEST, { ...PLAN, sources: undefined }, {
      planDirectory: root,
      manifestPath: path.join(root, "action-parity.json"),
      base: "HEAD"
    });
    assert.equal(scope.full, true);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("a scoped run is reported in a format nothing can mistake for evidence", async () => {
  const { root, write, git } = await makeRepo();
  try {
    // A test that passes and records the observation the verifier looks for.
    await write(
      "tests/create.test.mjs",
      `import { writeFileSync } from "node:fs";
writeFileSync(new URL("./o.json", import.meta.url), JSON.stringify([
  { action_id: "task.create", surface: "cli", request_execution_id: "e1", core_execution_id: "e1" },
  { action_id: "task.create", surface: "gui", request_execution_id: "e2", core_execution_id: "e2" }
]));
`
    );
    const plan = {
      version: 1,
      tests: [
        {
          ref: "tests/create.test.mjs",
          command: ["node", "tests/create.test.mjs"],
          observations: "tests/o.json"
        }
      ],
      sources: { "task.create": ["src/create.mjs"], "task.delete": ["src/delete.mjs"] }
    };
    await write("action-parity.verify.json", `${JSON.stringify(plan, null, 2)}\n`);
    // The plan and the test belong to the baseline; only the source edit is the
    // change under test, or the run would widen and prove nothing about scoping.
    await git(["add", "-A"]);
    await git(["commit", "-q", "-m", "plan"]);
    await write("src/create.mjs", "export const create = 9;\n");

    const report = await verifyManifest(path.join(root, "action-parity.json"), {
      planPath: path.join(root, "action-parity.verify.json"),
      changed: true,
      base: "HEAD"
    });

    assert.equal(report.format, "action-parity.scoped-check/v1");
    assert.equal(report.verified, false, "a partial run must never claim full evidence");
    assert.equal(report.scope.passed, true);
    assert.equal(report.scope.actions_executed, 1);
    assert.equal(report.scope.actions_total, 2);
    assert.notEqual(report.audit.achieved, "AP-2", "a partial run must not reach AP-2");
    assert.equal(report.audit.verified_at_runtime, false);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("globs stay inside a path segment unless they say otherwise", () => {
  assert.ok(globToRegExp("src/*.mjs").test("src/core.mjs"));
  assert.ok(!globToRegExp("src/*.mjs").test("src/nested/core.mjs"));
  assert.ok(globToRegExp("src/**/*.mjs").test("src/nested/deep/core.mjs"));
  assert.ok(globToRegExp("src/**/*.mjs").test("src/core.mjs"));
  assert.ok(globToRegExp("docs/**").test("docs/guide.md"));
  assert.ok(globToRegExp("*.md").test("README.md"));
  assert.ok(!globToRegExp("*.md").test("docs/guide.md"));
  assert.ok(!globToRegExp("src/core.mjs").test("src/core-other.mjs"));
});
