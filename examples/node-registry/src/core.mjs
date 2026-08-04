/**
 * The Action Core of the example task board.
 *
 * This is the only file in the example that contains business behavior. The
 * CLI, the MCP server, the Electron main process, and the HTTP transport each
 * add a handful of lines of plumbing and no task logic at all.
 */

import { readFileSync, renameSync, writeFileSync } from "node:fs";
import process from "node:process";
import { ActionError, createRegistry, defineAction, defineSurface, s } from "action-parity-sdk";

/** The board every Shadow of this process shares, selected by environment. */
export function defaultStore() {
  return createStore({ file: process.env.TASKS_FILE ?? null });
}

/**
 * The repository the Actions depend on. It is a parameter of `buildRegistry`,
 * so the CLI, the MCP server, the HTTP server, and the parity test can all
 * point at one truth source (`file`) or at an isolated in-memory board.
 */
export function createStore({ file = null } = {}) {
  let state = { sequence: 0, version: 0, tasks: [] };

  const load = () => {
    if (!file) return;
    try {
      state = JSON.parse(readFileSync(file, "utf8"));
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
  };
  const save = () => {
    if (!file) return;
    // Write then rename: a crash must not leave a half-written board behind.
    const temporary = `${file}.${process.pid}.tmp`;
    writeFileSync(temporary, `${JSON.stringify(state)}\n`, "utf8");
    renameSync(temporary, file);
  };

  load();

  return {
    get version() {
      load();
      return String(state.version);
    },
    list() {
      load();
      return state.tasks.map((task) => ({ ...task }));
    },
    add(title, tags) {
      load();
      state.sequence += 1;
      state.version += 1;
      const task = { id: `task-${state.sequence}`, title, tags, done: false };
      state.tasks.push(task);
      save();
      return { ...task };
    },
    complete(id) {
      load();
      const task = state.tasks.find((candidate) => candidate.id === id);
      if (!task) return null;
      if (!task.done) {
        task.done = true;
        state.version += 1;
        save();
      }
      return { ...task };
    },
    purge() {
      load();
      const removed = state.tasks.filter((task) => task.done).map((task) => task.id);
      state.tasks = state.tasks.filter((task) => !task.done);
      if (removed.length > 0) {
        state.version += 1;
        save();
      }
      return removed;
    }
  };
}

const TASK = s.object({
  id: s.string(),
  title: s.string(),
  tags: s.array(s.string()),
  done: s.boolean()
});

/**
 * Build the registry. `store` is a parameter so tests, the CLI, and the GUI
 * can each own their instance without a hidden global.
 */
export function buildRegistry(store = defaultStore(), options = {}) {
  const registry = createRegistry({
    application: {
      id: "org.actionparity.node-tasks",
      name: "Node Task Board",
      version: "0.1.0",
      description: "One Node Action Core exported to GUI, CLI, MCP, and HTTP Shadows.",
      source: "https://github.com/dongsheng123132/action-parity"
    },
    generatorRevision: "examples/node-registry/src/core.mjs",
    cli: { invocation: "tasks <action-id> [--flag value] [--input-json <json>] --json" },
    // The authoritative version a caller must match before it may write.
    stateVersion: () => store.version,
    onEvent: options.onEvent,
    surfaces: [
      defineSurface({
        id: "gui",
        kind: "gui",
        reachability: "in-process",
        bindingTarget: "data-action-id={action_id}",
        bindingTest: "tests/parity.test.mjs",
        testDriver: "node --test",
        description: "Electron renderer controls, bound by stable automation ID."
      }),
      defineSurface({
        id: "cli",
        kind: "cli",
        reachability: "external",
        bindingTarget: "tasks {action_id} --json",
        bindingTest: "tests/parity.test.mjs",
        testDriver: "node --test"
      }),
      defineSurface({
        id: "mcp",
        kind: "mcp",
        reachability: "local-ipc",
        bindingTarget: "tool:{action_id}",
        bindingTest: "tests/parity.test.mjs",
        testDriver: "node --test"
      }),
      defineSurface({
        id: "api",
        kind: "api",
        reachability: "external",
        bindingTarget: "POST /actions/{action_id}",
        bindingTest: "tests/parity.test.mjs",
        testDriver: "node --test"
      })
    ]
  });

  registry.registerAll([
    defineAction({
      id: "task.create",
      title: "Create task",
      description: "Add one task to the board.",
      effects: "write",
      execution: { timeout_ms: 2000, evidence: "node --test examples/node-registry/tests" },
      input: s.object({
        title: s.string({ minLength: 1, description: "What has to be done." }),
        tags: s.optional(s.array(s.string({ minLength: 1 }), { description: "Repeatable label." }))
      }),
      output: s.object({ task: TASK, core_execution_id: s.string() }),
      handler(input, context) {
        const title = input.title.trim();
        if (title === "") {
          throw ActionError.input("title_required", "title must not be blank.");
        }
        return { task: store.add(title, input.tags ?? []), core_execution_id: context.executionId };
      }
    }),

    defineAction({
      id: "task.list",
      title: "List tasks",
      description: "List every task on the board.",
      effects: "read",
      execution: { idempotent: true, timeout_ms: 2000, evidence: "node --test examples/node-registry/tests" },
      input: s.object({
        done: s.optional(s.boolean({ description: "Filter by completion state." }))
      }),
      output: s.object({
        tasks: s.array(TASK),
        state_version: s.string(),
        core_execution_id: s.string()
      }),
      handler(input, context) {
        const tasks = store
          .list()
          .filter((task) => input.done === undefined || task.done === input.done);
        return { tasks, state_version: store.version, core_execution_id: context.executionId };
      }
    }),

    defineAction({
      id: "task.complete",
      title: "Complete task",
      description: "Mark one task as done. Completing an already done task changes nothing.",
      effects: "write",
      execution: {
        idempotent: true,
        timeout_ms: 2000,
        evidence: "node --test examples/node-registry/tests"
      },
      input: s.object({ id: s.string({ minLength: 1, description: "Task ID to complete." }) }),
      output: s.object({ task: TASK, state_version: s.string(), core_execution_id: s.string() }),
      handler(input, context) {
        const task = store.complete(input.id);
        if (!task) {
          throw ActionError.notFound("task_not_found", `No task with ID ${input.id}.`, {
            id: input.id
          });
        }
        return { task, state_version: store.version, core_execution_id: context.executionId };
      }
    }),

    defineAction({
      id: "task.purge",
      title: "Purge completed tasks",
      description: "Permanently delete every completed task.",
      effects: { class: "destructive", risk: "high", reversible: false, confirmation: "always" },
      execution: { timeout_ms: 2000, evidence: "node --test examples/node-registry/tests" },
      input: s.object({}),
      output: s.object({
        removed: s.array(s.string()),
        state_version: s.string(),
        core_execution_id: s.string()
      }),
      handler(_input, context) {
        return {
          removed: store.purge(),
          state_version: store.version,
          core_execution_id: context.executionId
        };
      }
    })
  ]);

  return registry;
}
