import assert from "node:assert/strict";
import test from "node:test";
import {
  ActionError,
  RegistryError,
  createRegistry,
  defineAction,
  defineSurface,
  s
} from "action-parity-sdk";
import { validateRegistryBundle } from "../src/generator.mjs";

const APPLICATION = {
  id: "org.actionparity.sdk-test",
  name: "SDK Test",
  version: "0.0.1"
};

const GUI = {
  id: "gui",
  kind: "gui",
  reachability: "in-process",
  bindingTarget: "data-action-id={action_id}"
};
const CLI = {
  id: "cli",
  kind: "cli",
  reachability: "external",
  bindingTarget: "app {action_id} --json",
  bindingTest: "tests/parity.test.mjs"
};
const MCP = { id: "mcp", kind: "mcp", reachability: "local-ipc", bindingTarget: "tool:{action_id}" };

function echoAction(overrides = {}) {
  return defineAction({
    id: "note.create",
    title: "Create note",
    description: "Create one note.",
    effects: "write",
    input: s.object({ title: s.string({ minLength: 1 }) }),
    output: s.object({ title: s.string(), execution_id: s.string() }),
    handler: (input, context) => ({ title: input.title, execution_id: context.executionId }),
    ...overrides
  });
}

function registryWith(actions, surfaces = [GUI, CLI, MCP], options = {}) {
  return createRegistry({ application: APPLICATION, surfaces, actions, ...options });
}

test("an Action must be declared honestly before it can be registered", () => {
  assert.throws(() => defineAction({ ...echoAction(), id: "notcreate" }), RegistryError);
  assert.throws(
    () =>
      defineAction({
        id: "vault.delete",
        title: "Delete vault",
        description: "Delete everything.",
        effects: { class: "destructive", confirmation: "never" },
        handler: () => ({})
      }),
    /cannot disable confirmation for high-risk effects/
  );
  assert.throws(
    () => defineSurface({ id: "gui", kind: "gui", bindingTarget: "button" }),
    /bindingTarget must contain/
  );
  assert.throws(
    () =>
      defineSurface({
        id: "mcp",
        kind: "mcp",
        bindingTarget: "tool:{action_id}",
        requiredForParity: false
      }),
    /exclusionReason/
  );
});

test("the envelope is identical for success and failure across Surfaces", async () => {
  const registry = registryWith([echoAction()]);
  for (const surface of ["gui", "cli", "mcp"]) {
    const envelope = await registry.dispatch({
      actionId: "note.create",
      surface,
      input: { title: surface },
      executionId: `trace-${surface}`
    });
    assert.deepEqual(envelope, {
      ok: true,
      version: 1,
      action_id: "note.create",
      execution_id: `trace-${surface}`,
      result: { title: surface, execution_id: `trace-${surface}` }
    });
  }
});

test("dispatch reports unknown Actions, Surfaces, and unexposed pairs", async () => {
  const registry = registryWith([
    echoAction({ id: "note.internal", surfaces: ["cli"] }),
    echoAction()
  ], [GUI, CLI, MCP].map((surface) => ({
    ...surface,
    requiredForParity: false,
    exclusionReason: "gradual adoption while the example is being wired"
  })));

  const unknownAction = await registry.dispatch({ actionId: "note.missing", surface: "cli" });
  assert.equal(unknownAction.error.code, "unknown_action");

  const unknownSurface = await registry.dispatch({ actionId: "note.create", surface: "web" });
  assert.equal(unknownSurface.error.code, "unknown_surface");

  const notExposed = await registry.dispatch({
    actionId: "note.internal",
    surface: "gui",
    input: { title: "x" }
  });
  assert.equal(notExposed.error.code, "action_not_exposed_on_surface");
});

test("a scoped Action may not silently drop a Surface required for parity", () => {
  assert.throws(
    () => registryWith([echoAction({ surfaces: ["cli"] })]),
    /omits required Surface/
  );
});

test("confirmation is enforced in the core, below every Surface", async () => {
  const purge = defineAction({
    id: "vault.purge",
    title: "Purge vault",
    description: "Delete every archived item.",
    effects: { class: "destructive", risk: "high", reversible: false, confirmation: "always" },
    output: s.object({ removed: s.integer() }),
    handler: () => ({ removed: 3 })
  });
  const registry = registryWith([purge]);

  const refused = await registry.dispatch({ actionId: "vault.purge", surface: "gui" });
  assert.equal(refused.ok, false);
  assert.equal(refused.error.class, "refused");
  assert.equal(refused.error.code, "confirmation_required");
  assert.deepEqual(refused.error.details.retry_with, { confirmed: true });

  const confirmed = await registry.dispatch({
    actionId: "vault.purge",
    surface: "gui",
    confirmed: true
  });
  assert.equal(confirmed.ok, true);
});

test("input is validated once, in the core, with located issues", async () => {
  const registry = registryWith([echoAction()]);
  const envelope = await registry.dispatch({
    actionId: "note.create",
    surface: "cli",
    input: { title: "", extra: 1 }
  });
  assert.equal(envelope.error.class, "input");
  assert.equal(envelope.error.code, "input_validation_failed");
  assert.deepEqual(
    envelope.error.details.issues.map((issue) => issue.path).sort(),
    ["/extra", "/title"]
  );
});

test("a result that violates its declared output schema is an error, not a lie", async () => {
  const registry = registryWith([
    echoAction({ handler: () => ({ title: 42, execution_id: "x" }) })
  ]);
  const envelope = await registry.dispatch({
    actionId: "note.create",
    surface: "cli",
    input: { title: "ok" }
  });
  assert.equal(envelope.ok, false);
  assert.equal(envelope.error.code, "output_validation_failed");
});

test("a handler that throws a plain Error still produces an envelope", async () => {
  const registry = registryWith([
    echoAction({
      handler: () => {
        throw new Error("disk is on fire");
      }
    })
  ]);
  const envelope = await registry.dispatch({
    actionId: "note.create",
    surface: "cli",
    input: { title: "ok" }
  });
  assert.equal(envelope.ok, false);
  assert.equal(envelope.error.class, "internal");
  assert.equal(envelope.error.code, "action_threw");
  assert.equal(envelope.error.message, "disk is on fire");
});

test("an ActionError keeps its class, code, and details", async () => {
  const registry = registryWith([
    echoAction({
      handler: () => {
        throw ActionError.notFound("note_missing", "No such note.", { id: "note-9" });
      }
    })
  ]);
  const envelope = await registry.dispatch({
    actionId: "note.create",
    surface: "cli",
    input: { title: "ok" }
  });
  assert.deepEqual(envelope.error, {
    class: "not_found",
    code: "note_missing",
    message: "No such note.",
    details: { id: "note-9" }
  });
});

test("the declared timeout is enforced and the handler is signalled", async () => {
  let aborted = false;
  const registry = registryWith([
    echoAction({
      execution: { timeout_ms: 30 },
      handler: (_input, context) =>
        new Promise((resolve) => {
          context.signal.addEventListener("abort", () => {
            aborted = true;
          });
          setTimeout(() => resolve({ title: "late", execution_id: context.executionId }), 500);
        })
    })
  ]);
  const envelope = await registry.dispatch({
    actionId: "note.create",
    surface: "cli",
    input: { title: "slow" }
  });
  assert.equal(envelope.error.class, "timeout");
  assert.equal(envelope.error.code, "action_timed_out");
  assert.equal(aborted, true, "the handler must be told to stop");
});

test("an idempotency key replays the first envelope instead of writing twice", async () => {
  let calls = 0;
  const registry = registryWith([
    echoAction({
      handler: (input, context) => {
        calls += 1;
        return { title: input.title, execution_id: context.executionId };
      }
    })
  ]);
  const first = await registry.dispatch({
    actionId: "note.create",
    surface: "cli",
    input: { title: "once" },
    idempotencyKey: "retry-1"
  });
  const second = await registry.dispatch({
    actionId: "note.create",
    surface: "cli",
    input: { title: "once" },
    idempotencyKey: "retry-1"
  });
  assert.equal(calls, 1);
  assert.deepEqual(second, first);
});

test("a stale expected_state_version is a conflict, never a last-writer-wins write", async () => {
  let version = 7;
  const registry = registryWith([
    echoAction({
      handler: (input, context) => {
        version += 1;
        return { title: input.title, execution_id: context.executionId };
      }
    })
  ], [GUI, CLI, MCP], { stateVersion: () => String(version) });

  const stale = await registry.dispatch({
    actionId: "note.create",
    surface: "cli",
    input: { title: "stale" },
    expectedStateVersion: "3"
  });
  assert.equal(stale.error.class, "conflict");
  assert.equal(stale.error.code, "state_version_conflict");
  assert.deepEqual(stale.error.details, { expected: "3", actual: "7" });
  assert.equal(version, 7, "a conflicting write must not run");

  const fresh = await registry.dispatch({
    actionId: "note.create",
    surface: "cli",
    input: { title: "fresh" },
    expectedStateVersion: "7"
  });
  assert.equal(fresh.ok, true);
});

test("permission is enforced in the core, so bypassing a GUI control bypasses nothing", async () => {
  const registry = registryWith([echoAction()], [GUI, CLI, MCP], {
    authorize: ({ actor }) => actor === "owner"
  });
  const denied = await registry.dispatch({
    actionId: "note.create",
    surface: "mcp",
    input: { title: "x" },
    actor: "guest"
  });
  assert.equal(denied.error.class, "refused");
  assert.equal(denied.error.code, "permission_denied");

  const allowed = await registry.dispatch({
    actionId: "note.create",
    surface: "mcp",
    input: { title: "x" },
    actor: "owner"
  });
  assert.equal(allowed.ok, true);
});

test("lifecycle events carry references, not payloads", async () => {
  const events = [];
  const registry = registryWith([echoAction()], [GUI, CLI, MCP], {
    onEvent: (event) => events.push(event)
  });
  await registry.dispatch({
    actionId: "note.create",
    surface: "cli",
    input: { title: "audited" },
    executionId: "trace-audit"
  });
  assert.deepEqual(
    events.map((event) => event.type),
    ["action.started", "action.succeeded"]
  );
  assert.equal(events[0].audit_required, true);
  assert.equal(events[0].execution_id, "trace-audit");
  const serialized = JSON.stringify(events);
  assert.ok(!serialized.includes("audited"), "an event must not carry the business payload");
});

test("the artifact bundle is exactly what the ActionParity generator accepts", () => {
  const registry = registryWith([echoAction()]);
  const bundle = registry.artifactBundle();
  assert.equal(bundle.format, "action-parity.registry-bundle/v1");
  const report = validateRegistryBundle(bundle);
  assert.equal(report.ok, true);

  const action = bundle.manifest.actions.find((entry) => entry.id === "note.create");
  assert.deepEqual(
    action.bindings.map((binding) => binding.surface),
    ["cli", "gui", "mcp"]
  );
  assert.equal(action.bindings.find((binding) => binding.surface === "cli").test, "tests/parity.test.mjs");
  assert.equal(action.bindings.find((binding) => binding.surface === "gui").target, "data-action-id=note.create");
  assert.equal(bundle.manifest.generated_from.generator.startsWith("action-parity-sdk/"), true);
});

test("generation is deterministic regardless of registration order", () => {
  const first = registryWith([echoAction({ id: "a.one" }), echoAction({ id: "b.two" })]);
  const second = registryWith([echoAction({ id: "b.two" }), echoAction({ id: "a.one" })]);
  assert.equal(JSON.stringify(first.artifactBundle()), JSON.stringify(second.artifactBundle()));
});

test("only the Surfaces of a kind receive the CLI catalog and MCP tool list", () => {
  const registry = registryWith(
    [
      echoAction({ id: "note.create", surfaces: ["cli", "mcp"] }),
      echoAction({ id: "note.hidden", surfaces: ["cli"] })
    ],
    [
      CLI,
      { ...MCP, requiredForParity: false, exclusionReason: "internal Actions stay off MCP" }
    ]
  );
  assert.deepEqual(
    registry.cliHelp().actions.map((action) => action.id),
    ["note.create", "note.hidden"]
  );
  assert.deepEqual(
    registry.mcpTools().tools.map((tool) => tool.name),
    ["note.create"]
  );
});
