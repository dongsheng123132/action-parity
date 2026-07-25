import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import Ajv2020 from "ajv/dist/2020.js";

async function json(relativePath) {
  return JSON.parse(await readFile(new URL(relativePath, import.meta.url), "utf8"));
}

test("ClawMe task delta validates against the Shadow & Sync profile", async () => {
  const schema = await json("../schema/action-parity-sync.schema.json");
  const delta = await json("../examples/sync/clawme-task-delta.json");
  const ajv = new Ajv2020({
    allErrors: true,
    strict: false,
    validateFormats: false
  });
  const validate = ajv.compile(schema);

  assert.equal(validate(delta), true, JSON.stringify(validate.errors));
});

test("a delta cannot omit its resume cursors", async () => {
  const schema = await json("../schema/action-parity-sync.schema.json");
  const delta = await json("../examples/sync/clawme-task-delta.json");
  delete delta.payload.previous_cursor;
  const ajv = new Ajv2020({
    allErrors: true,
    strict: false,
    validateFormats: false
  });
  const validate = ajv.compile(schema);

  assert.equal(validate(delta), false);
});

test("an unchanged stream may return an empty resumable delta", async () => {
  const schema = await json("../schema/action-parity-sync.schema.json");
  const delta = await json("../examples/sync/clawme-task-delta.json");
  delta.payload.previous_cursor = delta.payload.cursor;
  delta.payload.events = [];
  delta.payload.has_more = false;
  const ajv = new Ajv2020({
    allErrors: true,
    strict: false,
    validateFormats: false
  });
  const validate = ajv.compile(schema);

  assert.equal(validate(delta), true, JSON.stringify(validate.errors));
});
