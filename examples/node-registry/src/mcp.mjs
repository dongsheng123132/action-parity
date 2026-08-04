#!/usr/bin/env node
/**
 * The MCP Shadow: the whole thing.
 *
 * The advertised tools are exactly `registry.mcpTools()`, which is also what
 * `action-parity generate` writes to `generated/mcp-tools.json`.
 */

import { serveMcpStdio } from "action-parity-sdk/mcp";
import { buildRegistry } from "./core.mjs";

await serveMcpStdio(buildRegistry(), { name: "node-task-board" });
