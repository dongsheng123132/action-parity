#!/usr/bin/env node
/**
 * The CLI Shadow: the whole thing.
 *
 * Every command, flag, help text, and exit code comes from the registry.
 * Adding a task Action changes core.mjs and nothing here.
 */

import { createCliRunner } from "action-parity-sdk/cli";
import { buildRegistry } from "./core.mjs";

await createCliRunner(buildRegistry(), { name: "tasks" }).main();
