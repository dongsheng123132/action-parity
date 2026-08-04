#!/usr/bin/env node
/**
 * The HTTP Shadow: the whole thing.
 *
 *   POST /actions/task.create   {"title":"write the report"}
 *   GET  /actions               the catalog this Surface exposes
 *   GET  /manifest              the generated ActionParity Manifest
 *
 * Confirmation still lives in the Action Core: `task.purge` answers 403 with
 * `confirmation_required` until the caller sends `x-action-confirm: true`.
 */

import { createServer } from "node:http";
import { createHttpHandler } from "action-parity-sdk/http";
import { buildRegistry } from "./core.mjs";

export function createTaskServer(registry = buildRegistry()) {
  return createServer(createHttpHandler(registry, { surface: "api" }));
}

if (import.meta.url === `file://${process.argv[1]?.replace(/\\/g, "/")}`) {
  const port = Number(process.env.PORT ?? 8787);
  createTaskServer().listen(port, () => {
    process.stderr.write(`Task board API listening on http://127.0.0.1:${port}\n`);
  });
}
