/**
 * Executable parity evidence for the Node example.
 *
 * Every Action is invoked through the real transport of every Surface — the
 * Electron IPC bridge, the spawned CLI, the spawned MCP stdio server, and the
 * HTTP listener — against one shared board. The test asserts that the
 * execution ID the caller supplied is the execution ID the Action Core saw, so
 * a Binding cannot be claimed by a Surface that never reached the core.
 *
 * `generated/parity-observations.json` is what `action-parity verify` reads.
 */

import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import test, { after, before } from "node:test";
import { fileURLToPath } from "node:url";
import { attachElectronIpc } from "action-parity-sdk/electron";
import { createHttpHandler } from "action-parity-sdk/http";
import { buildRegistry, createStore } from "../src/core.mjs";

const example = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifest = JSON.parse(
  await readFile(path.join(example, "generated", "action-parity.json"), "utf8")
);

const workspace = await mkdtemp(path.join(os.tmpdir(), "action-parity-node-example-"));
const boardFile = path.join(workspace, "board.json");
const environment = { ...process.env, TASKS_FILE: boardFile };
const observations = [];

/** Inputs that succeed for each Action once a task exists. */
const SEQUENCE = ["task.create", "task.list", "task.complete", "task.purge"];
const inputFor = (actionId, taskId) =>
  actionId === "task.create"
    ? { title: `parity ${taskId}` }
    : actionId === "task.complete"
      ? { id: taskId }
      : {};

let server = null;
let baseUrl = "";
let httpRegistry = null;

before(async () => {
  httpRegistry = buildRegistry(createStore({ file: boardFile }));
  server = createServer(createHttpHandler(httpRegistry, { surface: "api" }));
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
  await writeFile(
    path.join(example, "generated", "parity-observations.json"),
    `${JSON.stringify(observations, null, 2)}\n`,
    "utf8"
  );
});

test("generated bindings match the registry templates", () => {
  const create = manifest.actions.find((action) => action.id === "task.create");
  const target = (surface) => create.bindings.find((binding) => binding.surface === surface).target;
  assert.equal(target("gui"), "data-action-id=task.create");
  assert.equal(target("cli"), "tasks task.create --json");
  assert.equal(target("mcp"), "tool:task.create");
  assert.equal(target("api"), "POST /actions/task.create");
});

test("the Action Core refuses a destructive Action without confirmation", async () => {
  const registry = buildRegistry(createStore());
  const envelope = await registry.dispatch({
    actionId: "task.purge",
    surface: "cli",
    input: {}
  });
  assert.equal(envelope.ok, false);
  assert.equal(envelope.error.code, "confirmation_required");
  assert.deepEqual(envelope.error.details.retry_with, { confirmed: true });
});

test("a stale caller cannot write", async () => {
  const store = createStore();
  const registry = buildRegistry(store);
  await registry.dispatch({ actionId: "task.create", surface: "cli", input: { title: "first" } });
  const stale = await registry.dispatch({
    actionId: "task.create",
    surface: "cli",
    input: { title: "second" },
    expectedStateVersion: "0"
  });
  assert.equal(stale.ok, false);
  assert.equal(stale.error.class, "conflict");
  assert.equal(stale.error.code, "state_version_conflict");
  assert.equal(store.list().length, 1, "the refused write must not have happened");
});

for (const surface of ["gui", "cli", "mcp", "api"]) {
  test(`${surface} reaches the Action Core for every Action`, async () => {
    let taskId = null;
    for (const actionId of SEQUENCE) {
      const executionId = `evidence-${surface}-${actionId}`;
      const envelope = await invoke(surface, actionId, inputFor(actionId, taskId), executionId);

      assert.equal(envelope.ok, true, JSON.stringify(envelope));
      assert.equal(envelope.action_id, actionId);
      assert.equal(envelope.execution_id, executionId);
      assert.equal(envelope.result.core_execution_id, executionId);
      if (actionId === "task.create") taskId = envelope.result.task.id;

      observations.push({
        action_id: actionId,
        surface,
        request_execution_id: executionId,
        core_execution_id: envelope.result.core_execution_id
      });
    }
  });
}

function invoke(surface, actionId, input, executionId) {
  const confirmed = actionId === "task.purge";
  switch (surface) {
    case "gui":
      return invokeGui(actionId, input, executionId, confirmed);
    case "cli":
      return invokeCli(actionId, input, executionId, confirmed);
    case "mcp":
      return invokeMcp(actionId, input, executionId, confirmed);
    case "api":
      return invokeHttp(actionId, input, executionId, confirmed);
    default:
      throw new Error(`Unknown Surface ${surface}.`);
  }
}

/** Drives the real Electron bridge through a stand-in ipcMain. */
async function invokeGui(actionId, input, executionId, confirmed) {
  const handlers = new Map();
  const ipcMain = {
    handle: (channel, listener) => handlers.set(channel, listener),
    removeHandler: (channel) => handlers.delete(channel)
  };
  const registry = buildRegistry(createStore({ file: boardFile }));
  const detach = attachElectronIpc(ipcMain, registry, {
    surface: "gui",
    confirm: () => confirmed
  });
  try {
    return await handlers.get("action-parity:call")({}, { actionId, input, executionId });
  } finally {
    detach();
  }
}

async function invokeCli(actionId, input, executionId, confirmed) {
  const args = [
    path.join(example, "src", "cli.mjs"),
    actionId,
    "--json",
    "--execution-id",
    executionId,
    "--input-json",
    JSON.stringify(input)
  ];
  if (confirmed) args.push("--yes");
  const { stdout, code } = await run(process.execPath, args);
  assert.ok(code === 0, `CLI exited with ${code}`);
  return JSON.parse(stdout);
}

async function invokeMcp(actionId, input, executionId, confirmed) {
  const child = spawn(process.execPath, [path.join(example, "src", "mcp.mjs")], {
    cwd: example,
    env: environment,
    shell: false,
    windowsHide: true,
    stdio: ["pipe", "pipe", "pipe"]
  });
  const responses = collectLines(child.stdout);
  child.stdin.write(
    `${JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "parity-test", version: "0" } }
    })}\n`
  );
  child.stdin.write(
    `${JSON.stringify({
      jsonrpc: "2.0",
      id: 2,
      method: "tools/call",
      params: {
        name: actionId,
        arguments: input,
        _meta: {
          "actionparity/execution_id": executionId,
          ...(confirmed ? { "actionparity/confirmed": true } : {})
        }
      }
    })}\n`
  );
  child.stdin.end();
  const lines = await responses;
  const call = lines.map((line) => JSON.parse(line)).find((message) => message.id === 2);
  assert.ok(call, `MCP server returned no response for ${actionId}`);
  assert.ok(call.result, JSON.stringify(call));
  return JSON.parse(call.result.content[0].text);
}

async function invokeHttp(actionId, input, executionId, confirmed) {
  const response = await fetch(`${baseUrl}/actions/${actionId}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-action-execution-id": executionId,
      ...(confirmed ? { "x-action-confirm": "true" } : {})
    },
    body: JSON.stringify(input)
  });
  return response.json();
}

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: example,
      env: environment,
      shell: false,
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"]
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", reject);
    child.on("close", (code) => resolve({ stdout, stderr, code }));
  });
}

function collectLines(stream) {
  return new Promise((resolve, reject) => {
    let buffer = "";
    stream.setEncoding("utf8");
    stream.on("data", (chunk) => {
      buffer += chunk;
    });
    stream.on("error", reject);
    stream.on("end", () =>
      resolve(buffer.split("\n").map((line) => line.trim()).filter((line) => line !== ""))
    );
  });
}
