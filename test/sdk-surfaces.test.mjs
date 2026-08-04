import assert from "node:assert/strict";
import { createServer } from "node:http";
import { Writable } from "node:stream";
import test from "node:test";
import { createRegistry, defineAction, defineSurface, s } from "action-parity-sdk";
import { EXIT, createCliRunner, parseFlags } from "action-parity-sdk/cli";
import { createMcpServer } from "action-parity-sdk/mcp";
import { attachElectronIpc, guiCatalog } from "action-parity-sdk/electron";
import { createHttpHandler } from "action-parity-sdk/http";

function collector() {
  const chunks = [];
  const stream = new Writable({
    write(chunk, _encoding, callback) {
      chunks.push(chunk.toString());
      callback();
    }
  });
  stream.text = () => chunks.join("");
  return stream;
}

function buildRegistry() {
  const registry = createRegistry({
    application: { id: "org.actionparity.surface-test", name: "Surface Test", version: "0.0.1" },
    surfaces: [
      defineSurface({
        id: "gui",
        kind: "gui",
        reachability: "in-process",
        bindingTarget: "data-action-id={action_id}"
      }),
      defineSurface({
        id: "cli",
        kind: "cli",
        reachability: "external",
        bindingTarget: "app {action_id} --json"
      }),
      defineSurface({
        id: "mcp",
        kind: "mcp",
        reachability: "local-ipc",
        bindingTarget: "tool:{action_id}"
      }),
      defineSurface({
        id: "api",
        kind: "api",
        reachability: "external",
        bindingTarget: "POST /actions/{action_id}"
      })
    ]
  });

  registry.register(
    defineAction({
      id: "note.create",
      title: "Create note",
      description: "Create one note.",
      effects: "write",
      input: s.object({
        title: s.string({ minLength: 1, description: "Note title." }),
        pinned: s.optional(s.boolean({ description: "Keep at the top." })),
        tags: s.optional(s.array(s.string()))
      }),
      output: s.object({
        title: s.string(),
        pinned: s.boolean(),
        tags: s.array(s.string()),
        core_execution_id: s.string()
      }),
      handler: (input, context) => ({
        title: input.title,
        pinned: input.pinned ?? false,
        tags: input.tags ?? [],
        core_execution_id: context.executionId
      })
    })
  );

  registry.register(
    defineAction({
      id: "note.purge",
      title: "Purge notes",
      description: "Delete every note.",
      effects: { class: "destructive", risk: "high", reversible: false, confirmation: "always" },
      output: s.object({ removed: s.integer(), core_execution_id: s.string() }),
      handler: (_input, context) => ({ removed: 2, core_execution_id: context.executionId })
    })
  );

  return registry;
}

/* ------------------------------------------------------------------ CLI -- */

test("flags are derived from the input schema, including negation and repeats", () => {
  const schema = s.object({
    title: s.string(),
    pinned: s.optional(s.boolean()),
    tags: s.optional(s.array(s.string())),
    count: s.optional(s.integer())
  });
  assert.deepEqual(
    parseFlags(schema, ["--title", "a", "--pinned", "--tags", "x", "--tags", "y", "--count", "3"])
      .value,
    { title: "a", pinned: true, tags: ["x", "y"], count: 3 }
  );
  assert.deepEqual(parseFlags(schema, ["--no-pinned", "--title=b"]).value, {
    pinned: false,
    title: "b"
  });
  assert.match(parseFlags(schema, ["--nope", "1"]).error, /Unknown flag --nope/);
  assert.match(parseFlags(schema, ["--title"]).error, /needs a value/);
  assert.match(parseFlags(schema, ["stray"]).error, /Unexpected argument stray/);
});

test("the CLI prints one envelope on stdout and keeps diagnostics on stderr", async () => {
  const stdout = collector();
  const stderr = collector();
  const runner = createCliRunner(buildRegistry(), { name: "app", stdout, stderr });

  const code = await runner.run([
    "note.create",
    "--title",
    "from cli",
    "--json",
    "--execution-id",
    "trace-cli"
  ]);
  assert.equal(code, EXIT.ok);
  assert.equal(stderr.text(), "");
  const envelope = JSON.parse(stdout.text());
  assert.equal(envelope.ok, true);
  assert.equal(envelope.execution_id, "trace-cli");
  assert.equal(envelope.result.core_execution_id, "trace-cli");
});

test("CLI exit codes follow the error class", async () => {
  const registry = buildRegistry();
  const cases = [
    { argv: ["note.create", "--json"], code: EXIT.input },
    { argv: ["note.purge", "--json"], code: EXIT.refused },
    { argv: ["note.purge", "--yes", "--json"], code: EXIT.ok },
    { argv: ["note.missing", "--json"], code: EXIT.not_found },
    { argv: ["note.create", "--bogus", "x", "--json"], code: EXIT.usage },
    { argv: [], code: EXIT.usage }
  ];
  for (const { argv, code } of cases) {
    const stdout = collector();
    const stderr = collector();
    const runner = createCliRunner(registry, { name: "app", stdout, stderr });
    assert.equal(await runner.run(argv), code, `${argv.join(" ") || "<no argv>"}`);
  }
});

test("the CLI reads whole inputs from stdin", async () => {
  const stdout = collector();
  const runner = createCliRunner(buildRegistry(), {
    name: "app",
    stdout,
    stderr: collector(),
    stdin: (async function* () {
      yield JSON.stringify({ title: "piped", tags: ["a"] });
    })()
  });
  assert.equal(await runner.run(["note.create", "--input-json", "-", "--json"]), EXIT.ok);
  const envelope = JSON.parse(stdout.text());
  assert.deepEqual(envelope.result.tags, ["a"]);
});

test("help names every Action and marks the ones that need confirmation", async () => {
  const stdout = collector();
  const runner = createCliRunner(buildRegistry(), { name: "app", stdout, stderr: collector() });
  await runner.run(["--help"]);
  assert.match(stdout.text(), /note\.create/);
  assert.match(stdout.text(), /note\.purge\s+Purge notes \(needs --yes\)/);
});

/* ------------------------------------------------------------------ MCP -- */

const rpc = (id, method, params) => ({ jsonrpc: "2.0", id, method, params });

test("the MCP server advertises exactly the generated tool list", async () => {
  const registry = buildRegistry();
  const server = createMcpServer(registry, { name: "surface-test", version: "0.0.1" });
  const listed = await server.handle(rpc(1, "tools/list"));
  assert.deepEqual(listed.result, registry.mcpTools());
});

test("MCP initialize negotiates a supported protocol version", async () => {
  const server = createMcpServer(buildRegistry());
  const known = await server.handle(rpc(1, "initialize", { protocolVersion: "2024-11-05" }));
  assert.equal(known.result.protocolVersion, "2024-11-05");
  const unknown = await server.handle(rpc(2, "initialize", { protocolVersion: "1999-01-01" }));
  assert.equal(unknown.result.protocolVersion, "2025-06-18");
  assert.deepEqual(unknown.result.capabilities, { tools: { listChanged: false } });
});

test("a tool call reaches the Action Core and carries the execution ID back", async () => {
  const server = createMcpServer(buildRegistry());
  const response = await server.handle(
    rpc(3, "tools/call", {
      name: "note.create",
      arguments: { title: "from mcp" },
      _meta: { "actionparity/execution_id": "trace-mcp" }
    })
  );
  assert.equal(response.result.isError, false);
  const envelope = JSON.parse(response.result.content[0].text);
  assert.equal(envelope.result.core_execution_id, "trace-mcp");
  assert.deepEqual(response.result.structuredContent, envelope.result);
});

test("an agent cannot purge without going back to its human", async () => {
  const server = createMcpServer(buildRegistry());
  const refused = await server.handle(rpc(4, "tools/call", { name: "note.purge", arguments: {} }));
  assert.equal(refused.result.isError, true);
  assert.equal(JSON.parse(refused.result.content[0].text).error.code, "confirmation_required");
  assert.match(refused.result.content[1].text, /actionparity\/confirmed/);

  const confirmed = await server.handle(
    rpc(5, "tools/call", {
      name: "note.purge",
      arguments: {},
      _meta: { "actionparity/confirmed": true }
    })
  );
  assert.equal(confirmed.result.isError, false);
});

test("MCP protocol faults stay protocol faults and business faults stay tool results", async () => {
  const server = createMcpServer(buildRegistry());
  await assert.rejects(() => server.handle(rpc(6, "tools/call", { name: "note.missing" })), {
    code: -32602
  });
  const unknownMethod = await server.handle(rpc(7, "resources/list"));
  assert.equal(unknownMethod.error.code, -32601);
  assert.equal(await server.handle({ jsonrpc: "2.0", method: "notifications/initialized" }), null);

  const invalidInput = await server.handle(
    rpc(8, "tools/call", { name: "note.create", arguments: {} })
  );
  assert.equal(invalidInput.result.isError, true);
  assert.equal(
    JSON.parse(invalidInput.result.content[0].text).error.code,
    "input_validation_failed"
  );
});

/* ------------------------------------------------------------- Electron -- */

test("the Electron bridge exposes one channel and re-asks for confirmation", async () => {
  const handlers = new Map();
  const ipcMain = {
    handle: (channel, listener) => handlers.set(channel, listener),
    removeHandler: (channel) => handlers.delete(channel)
  };
  const registry = buildRegistry();
  let asked = 0;
  const detach = attachElectronIpc(ipcMain, registry, {
    confirm: () => {
      asked += 1;
      return false;
    }
  });
  assert.deepEqual([...handlers.keys()], ["action-parity:call", "action-parity:catalog"]);

  const call = handlers.get("action-parity:call");
  const created = await call({}, { actionId: "note.create", input: { title: "from gui" } });
  assert.equal(created.ok, true);
  assert.equal(asked, 0, "a low-risk Action must not raise a dialog");

  // A renderer claiming consent is not consent.
  const purge = await call({}, { actionId: "note.purge", input: {}, confirmed: true });
  assert.equal(purge.ok, false);
  assert.equal(purge.error.code, "confirmation_required");
  assert.equal(asked, 1);

  const catalog = await handlers.get("action-parity:catalog")({});
  assert.deepEqual(
    catalog.actions.map((action) => action.data_action_id),
    ["note.create", "note.purge"]
  );
  assert.equal(catalog.actions.find((action) => action.id === "note.purge").confirmation_required, true);

  detach();
  assert.equal(handlers.size, 0);
});

test("a rejected sender never reaches the Action Core", async () => {
  const handlers = new Map();
  const registry = buildRegistry();
  let ran = 0;
  registry.on((event) => {
    if (event.type === "action.started") ran += 1;
  });
  attachElectronIpc(
    { handle: (channel, listener) => handlers.set(channel, listener) },
    registry,
    { authorizeSender: () => false }
  );
  const envelope = await handlers.get("action-parity:call")(
    {},
    { actionId: "note.create", input: { title: "x" } }
  );
  assert.equal(envelope.error.code, "sender_not_allowed");
  assert.equal(ran, 0);
});

test("the GUI catalog is the same Action list the Manifest publishes", () => {
  const registry = buildRegistry();
  assert.deepEqual(
    guiCatalog(registry).actions.map((action) => action.id),
    registry.manifest().actions.map((action) => action.id)
  );
});

/* ----------------------------------------------------------------- HTTP -- */

test("HTTP status and error class agree", async () => {
  const registry = buildRegistry();
  const server = createServer(createHttpHandler(registry, { surface: "api" }));
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${server.address().port}`;

  try {
    const created = await fetch(`${base}/actions/note.create`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-action-execution-id": "trace-api" },
      body: JSON.stringify({ title: "from http" })
    });
    assert.equal(created.status, 200);
    assert.equal(created.headers.get("x-action-execution-id"), "trace-api");
    assert.equal((await created.json()).result.core_execution_id, "trace-api");

    const invalid = await fetch(`${base}/actions/note.create`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}"
    });
    assert.equal(invalid.status, 400);
    assert.equal((await invalid.json()).error.class, "input");

    const refused = await fetch(`${base}/actions/note.purge`, { method: "POST", body: "{}" });
    assert.equal(refused.status, 403);

    const confirmed = await fetch(`${base}/actions/note.purge`, {
      method: "POST",
      headers: { "x-action-confirm": "true" },
      body: "{}"
    });
    assert.equal(confirmed.status, 200);

    const missing = await fetch(`${base}/actions/note.missing`, { method: "POST", body: "{}" });
    assert.equal(missing.status, 404);

    const catalog = await (await fetch(`${base}/actions`)).json();
    assert.deepEqual(
      catalog.actions.map((action) => action.id),
      ["note.create", "note.purge"]
    );
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("an unauthenticated caller is refused before the Action Core", async () => {
  const registry = buildRegistry();
  let ran = 0;
  registry.on((event) => {
    if (event.type === "action.started") ran += 1;
  });
  const server = createServer(
    createHttpHandler(registry, {
      surface: "api",
      authenticate: (request) => (request.headers.authorization === "Bearer ok" ? "owner" : null)
    })
  );
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const denied = await fetch(`${base}/actions/note.create`, { method: "POST", body: "{}" });
    assert.equal(denied.status, 401);
    assert.equal(ran, 0);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
