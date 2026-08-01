import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  AGENT_CONTEXT_FORMAT,
  buildAgentContext,
  discoverAgentProfile,
  readAgentProfile
} from "../src/project.mjs";

const command = ["node", "tool.mjs"];

test("an agent discovers the project profile from a nested working directory", async () => {
  const root = await projectFixture();
  const nested = path.join(root, "src", "feature");
  await mkdir(nested, { recursive: true });

  assert.equal(await discoverAgentProfile(nested), path.join(root, "action-parity.config.json"));
});

test("context gives an agent edit targets, commands, actions, and surfaces", async () => {
  const root = await projectFixture();
  const context = await buildAgentContext(root);

  assert.equal(context.ok, true);
  assert.equal(context.format, AGENT_CONTEXT_FORMAT);
  assert.equal(context.agent_policy.source_of_truth, "registry");
  assert.equal(context.agent_policy.edit_generated_files, false);
  assert.deepEqual(context.agent_policy.completion_command, command);
  assert.equal(context.actions[0].id, "note.create");
  assert.deepEqual(
    context.actions[0].surfaces.map((surface) => surface.id),
    ["cli"]
  );
  assert.equal(context.generated_paths[0].editable, false);
});

test("context reports an invalid legacy Manifest without crashing the agent", async () => {
  const root = await projectFixture();
  const manifest = manifestFixture();
  manifest.actions[0].bindings = { cli: "notes create --json" };
  await writeFile(
    path.join(root, "generated", "action-parity.json"),
    `${JSON.stringify(manifest, null, 2)}\n`,
    "utf8"
  );

  const context = await buildAgentContext(root);

  assert.equal(context.ok, false);
  assert.deepEqual(context.actions[0].surfaces, []);
  assert.ok(context.manifest.errors.some((issue) => issue.code === "schema_validation"));
});

test("commands must be argv arrays rather than shell strings", async () => {
  const root = await projectFixture();
  const profilePath = path.join(root, "action-parity.config.json");
  const profile = profileFixture();
  profile.commands.verify = "node tool.mjs";
  await writeFile(profilePath, `${JSON.stringify(profile)}\n`, "utf8");

  await assert.rejects(() => readAgentProfile(profilePath), /Invalid Agent Profile/);
});

test("profile paths cannot escape the project root", async () => {
  const root = await projectFixture();
  const profilePath = path.join(root, "action-parity.config.json");
  const profile = profileFixture();
  profile.manifest = "../outside.json";
  await writeFile(profilePath, `${JSON.stringify(profile)}\n`, "utf8");

  await assert.rejects(() => buildAgentContext(root), /escapes the project root/);
});

async function projectFixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), "action-parity-project-"));
  await mkdir(path.join(root, "generated"), { recursive: true });
  await mkdir(path.join(root, "src"), { recursive: true });
  await writeFile(
    path.join(root, "action-parity.config.json"),
    `${JSON.stringify(profileFixture(), null, 2)}\n`,
    "utf8"
  );
  await writeFile(
    path.join(root, "generated", "action-parity.json"),
    `${JSON.stringify(manifestFixture(), null, 2)}\n`,
    "utf8"
  );
  return root;
}

function profileFixture() {
  return {
    format: "action-parity.agent-profile/v1",
    manifest: "generated/action-parity.json",
    registry: {
      export: ["node", "registry.mjs", "export"],
      source_paths: ["src/registry.mjs"]
    },
    generated_paths: ["generated/action-parity.json"],
    commands: {
      generate: command,
      generate_check: command,
      verify: command
    }
  };
}

function manifestFixture() {
  return {
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
        id: "note.create",
        title: "Create note",
        description: "Create one note.",
        input_schema: { type: "object" },
        output_schema: { type: "object" },
        effects: {
          class: "write",
          risk: "low",
          reversible: true,
          confirmation: "never",
          audit_required: true
        },
        execution: {
          headless: true,
          idempotent: false,
          cancellable: false,
          timeout_ms: 1000,
          headless_evidence: "node test.mjs"
        },
        bindings: [
          { surface: "cli", target: "notes call note.create --json", test: "test.mjs" }
        ]
      }
    ],
    state: { queries: ["note.get"], events: ["note.created"] }
  };
}
