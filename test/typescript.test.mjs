import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  generateTypeScriptClient,
  jsonSchemaToType
} from "../src/typescript.mjs";

test("JSON Schema objects retain required, optional, enum, array, and refs", () => {
  const schema = {
    $defs: {
      note: {
        type: "object",
        additionalProperties: false,
        required: ["id", "state"],
        properties: {
          id: { type: "string" },
          state: { enum: ["open", "closed"] },
          score: { type: ["number", "null"] }
        }
      }
    },
    type: "object",
    additionalProperties: false,
    required: ["notes"],
    properties: {
      notes: { type: "array", items: { $ref: "#/$defs/note" } },
      cursor: { type: "string" }
    }
  };

  assert.equal(
    jsonSchemaToType(schema),
    '{ cursor?: string; notes: Array<{ id: string; score?: number | null; state: "open" | "closed"; }>; }'
  );
});

test("TypeScript client is deterministic and carries typed transport helpers", () => {
  const manifest = manifestFixture([
    actionFixture("note.list", { type: "object", additionalProperties: false }),
    actionFixture("note.create", {
      type: "object",
      additionalProperties: false,
      required: ["title"],
      properties: { title: { type: "string" } }
    })
  ]);

  const first = generateTypeScriptClient(manifest);
  const second = generateTypeScriptClient({ ...manifest, actions: [...manifest.actions].reverse() });

  assert.equal(first, second);
  assert.ok(first.indexOf("NOTE_CREATE") < first.indexOf("NOTE_LIST"));
  assert.match(first, /"note\.create": \{ title: string; \};/);
  assert.match(first, /export function createActionClient/);
  assert.match(first, /export function createTauriActionClient/);
  assert.match(first, /DO NOT EDIT/);
});

test("Schema conversion keeps tuple defaults and typed additional properties compilable", () => {
  assert.equal(
    jsonSchemaToType({
      type: "object",
      required: ["name"],
      properties: { name: { type: "string" } },
      additionalProperties: { type: "number" }
    }),
    "{ name: string; [key: string]: unknown; }"
  );
  assert.equal(
    jsonSchemaToType({ prefixItems: [{ type: "string" }] }),
    "[string, ...Array<unknown>]"
  );
  assert.equal(
    jsonSchemaToType({ prefixItems: [{ type: "string" }], items: false }),
    "[string]"
  );
});

test("TypeScript generation rejects colliding symbols", () => {
  const manifest = manifestFixture([
    actionFixture("note.foo-bar"),
    actionFixture("note.foo_bar")
  ]);

  assert.throws(
    () => generateTypeScriptClient(manifest),
    /both generate TypeScript symbol NOTE_FOO_BAR/
  );
});

test("generated comments cannot terminate the file comment", () => {
  const action = actionFixture("note.list");
  action.description = "List notes */ export const injected = true";
  const generated = generateTypeScriptClient(manifestFixture([action]));

  assert.doesNotMatch(generated, /List notes \*\/ export/);
  assert.match(generated, /List notes \* \/ export/);
});

test("reference Tauri GUI has one transport bridge and no copied Action IDs", async () => {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const bridge = await readFile(
    path.join(root, "examples", "rust-registry", "gui", "actions.ts"),
    "utf8"
  );

  assert.match(bridge, /createTauriActionClient/);
  assert.match(bridge, /command: "action_parity_call"/);
  assert.doesNotMatch(bridge, /note\.(?:create|list)/);
});

function manifestFixture(actions) {
  return { actions };
}

function actionFixture(id, inputSchema = { type: "object" }) {
  return {
    id,
    title: id,
    description: `Run ${id}.`,
    input_schema: inputSchema,
    output_schema: { type: "object", additionalProperties: false }
  };
}
