# Node Action Registry example

Four Actions registered once, reached through four real transports, with
executable evidence that all four arrive at the same Action Core.

```text
src/core.mjs             the only file with business behavior
src/cli.mjs              the entire CLI Shadow           (4 code lines)
src/mcp.mjs              the entire MCP Shadow           (4 code lines)
src/http.mjs             the entire HTTP Shadow          (13 code lines)
src/electron-main.mjs    the entire GUI wiring           (Electron main process)
gui/actions.ts           the one editable renderer bridge
```

From the repository root:

```text
npm run generate:node-example
npm run verify:node-example
```

`generate` writes a deterministic Manifest, CLI catalog, MCP tool catalog,
TypeScript Action client, and registry bundle into `generated/`. `verify`
reruns the exporter, compares the generated Manifest, executes
`tests/parity.test.mjs` without a shell, and requires one runtime observation
per Action and Surface — 16 of them — in which the execution ID the caller sent
is the execution ID the Action Core saw.

## Try the Shadows

```text
node src/cli.mjs list
node src/cli.mjs task.create --title "write the report" --tags docs --json
node src/cli.mjs task.purge --json          # refused: confirmation_required, exit 4
node src/cli.mjs task.purge --yes --json    # runs
node src/cli.mjs describe task.create
node src/cli.mjs mcp                        # the same binary serves MCP over stdio
PORT=8787 node src/http.mjs                 # POST /actions/task.create
```

Set `TASKS_FILE=/tmp/board.json` and every Shadow shares one board, which is
how the parity test drives all four transports against a single truth source.

## What the example is meant to prove

- **The second interface costs no business code.** `src/core.mjs` is the only
  file that knows what a task is. The CLI, MCP, HTTP, and Electron entry points
  add plumbing and nothing else.
- **Confirmation is a core rule, not a GUI rule.** `task.purge` is refused on
  every Surface until confirmation arrives — `--yes` on the CLI,
  `_meta: { "actionparity/confirmed": true }` over MCP, `x-action-confirm` over
  HTTP, and a main-process dialog in Electron. The Electron bridge deliberately
  ignores a renderer that claims consent and re-asks in the main process.
- **Stale writes are refused.** `--expected-state-version 0` against a newer
  board returns `conflict / state_version_conflict` and does not write.
- **Bindings are evidence, not claims.** Break one Binding target by hand and
  `npm run check:generated` fails; make a Surface stop reaching the core and
  `verify` fails on the missing observation.

## Files you must not hand-edit

Everything in `generated/`. `action-parity.config.json` tells a coding agent
exactly that, along with the commands that regenerate and re-verify:

```text
node ../../bin/action-parity.mjs context . --json
```
