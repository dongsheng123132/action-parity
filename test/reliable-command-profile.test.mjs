import assert from "node:assert/strict";
import crypto from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import Ajv2020 from "ajv/dist/2020.js";

async function json(relativePath) {
  return JSON.parse(await readFile(new URL(relativePath, import.meta.url), "utf8"));
}

async function validator() {
  const schema = await json("../schema/action-parity-sync.schema.json");
  const ajv = new Ajv2020({
    allErrors: true,
    strict: false,
    validateFormats: false
  });
  return ajv.compile(schema);
}

const fixtures = [
  "../examples/sync/clawme-attention-decision-challenge.json",
  "../examples/sync/clawme-attention-decision-command.json",
  "../examples/sync/clawme-attention-decision-result.json",
  "../examples/sync/clawme-attention-decision-conflict.json"
];

test("reliable write command, result, and conflict fixtures validate", async () => {
  const validate = await validator();

  for (const fixture of fixtures) {
    const envelope = await json(fixture);
    assert.equal(validate(envelope), true, `${fixture}: ${JSON.stringify(validate.errors)}`);
  }
});

test("the reliable write fixtures correlate one execution and stream", async () => {
  const challenge = await json(fixtures[0]);
  const command = await json(fixtures[1]);
  const result = await json(fixtures[2]);
  const conflict = await json(fixtures[3]);

  assert.equal(challenge.payload.challenge_id, command.payload.confirmation.challenge_id);
  assert.equal(challenge.payload.action_id, command.payload.action_id);
  assert.deepEqual(challenge.payload.actor, command.payload.actor);
  assert.equal(
    challenge.payload.expected_state_version,
    command.payload.expected_state_version,
  );
  assert.equal(
    challenge.payload.input_sha256,
    crypto.createHash("sha256")
      .update(JSON.stringify(command.payload.input))
      .digest("hex"),
  );
  assert.equal(command.payload.action_id, result.payload.action_id);
  assert.equal(command.payload.action_id, conflict.payload.action_id);
  assert.equal(command.payload.execution_id, result.payload.execution_id);
  assert.equal(command.payload.execution_id, conflict.payload.execution_id);
  assert.equal(command.stream_id, result.stream_id);
  assert.equal(command.stream_id, conflict.stream_id);
  assert.equal(result.payload.state_version, command.payload.expected_state_version + 1);
  assert.equal(conflict.payload.expected_state_version, command.payload.expected_state_version);
  assert.ok(conflict.payload.current_state_version > conflict.payload.expected_state_version);
});

test("a remote command cannot omit its retry identity", async () => {
  const validate = await validator();
  const command = await json(fixtures[1]);
  delete command.payload.idempotency_key;

  assert.equal(validate(command), false);
});

test("a failed result must carry a structured error", async () => {
  const validate = await validator();
  const result = await json(fixtures[2]);
  result.payload.ok = false;
  delete result.payload.error;

  assert.equal(validate(result), false);
});

test("confirmation metadata cannot smuggle platform proof fields", async () => {
  const validate = await validator();
  const command = await json(fixtures[1]);
  command.payload.confirmation.biometric_template = "must-not-travel";

  assert.equal(validate(command), false);
});
