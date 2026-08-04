# Node Action Core SDK

Status: implementation of the 0.7 toolchain. It adds no normative clauses to
the specification. `action-parity-sdk` is the Node, Electron, and TypeScript
peer of the Rust `action-parity-core` Registry.

## Why a second SDK

The Rust Registry proved the loop — one Action descriptor, deterministic
Manifest, CLI catalog, MCP tool list, typed client, executable evidence — but
most applications that need parity today are Electron or Node. Asking those
teams to adopt Rust first is asking them not to adopt at all. The roadmap
therefore put `defineAction` for TypeScript ahead of further specification
text.

The two SDKs are deliberately not two dialects. They emit the same
`action-parity.registry-bundle/v1`, the same `ExecutionEnvelope`, the same
error classes, and the same execution-ID format, so one `action-parity`
toolchain generates, checks, and verifies either of them, and a client can
branch identically no matter which language answered.

## What ships

```text
action-parity-sdk              defineAction, defineSurface, createRegistry, s, ActionError
action-parity-sdk/cli          createCliRunner  — the CLI Shadow
action-parity-sdk/mcp          serveMcpStdio    — the MCP Shadow
action-parity-sdk/electron     attachElectronIpc — the GUI Shadow
action-parity-sdk/http         createHttpHandler — the API Shadow
```

No runtime dependencies, hand-written `.d.ts`, no build step. An Electron main
process, a CLI, and an MCP server can each embed the core without dragging a
schema compiler into the bundle.

## The transports are callers, not implementations

Every transport in the package does the same three things: parse its own wire
format, call `registry.dispatch`, and serialize the envelope back. None of them
branches on an Action ID. That is what makes the roadmap's hard target — *the
second interface adds zero business code* — checkable rather than aspirational:
in the [Node example](../examples/node-registry), `src/cli.mjs`, `src/mcp.mjs`,
and `src/http.mjs` are 4, 4, and 13 code lines, and none of them changes when an
Action is added.

## What moved into the core

The Rust preview left several concerns to the caller. In Node they belong in
the core, because a GUI, a CLI, and an agent will otherwise each invent their
own version:

| Concern | Rule |
| --- | --- |
| Confirmation | `financial`, `destructive`, `high`, and `critical` Actions refuse without explicit confirmation, on every Surface. The error carries `retry_with`, so an agent learns what to do instead of guessing. |
| Permission | `authorize` runs before the handler for every Surface. Reaching an Action through MCP instead of the GUI button reaches the same check. |
| Stale state | `expectedStateVersion` is compared against the authoritative `stateVersion` callback. A mismatch is `conflict / state_version_conflict` and the handler does not run. Last-writer-wins is never an unstated default. |
| Idempotent retry | `idempotencyKey` replays the first envelope rather than writing twice. |
| Timeout | The declared `timeout_ms` is enforced, and `context.signal` is aborted so a cooperative handler stops working. |
| Output honesty | A result that violates the declared output schema is `output_validation_failed`. A Manifest that describes a shape the code does not return is worse than no Manifest. |
| Failure containment | Anything a handler throws becomes a valid envelope, so a missing `try` cannot turn into a transport-specific crash. |
| Audit | `onEvent` emits `action.started`, `action.succeeded`, and `action.failed` carrying identifiers and effect metadata — references, not payloads. |

## Confirmation across Surfaces

The same core rule, four honest transports:

| Surface | How consent arrives |
| --- | --- |
| CLI | `--yes` |
| MCP | `_meta: { "actionparity/confirmed": true }`, after the agent asks its human |
| HTTP | `x-action-confirm: true` |
| Electron | a main-process dialog |

The Electron bridge ignores a renderer that sets `confirmed: true` and re-asks
in the main process whenever a `confirm` callback is supplied. A renderer is
the least trustworthy part of an Electron application; treating its claim as
evidence of human consent would make the confirmation rule decorative.

## Schemas and the published contract

`s` is a small JSON Schema builder that returns plain JSON Schema objects, so
hand-written schemas work in exactly the same places. Teams that already own
Zod, Valibot, or ArkType keep their validator and pass the JSON Schema
explicitly through `fromStandardSchema(validator, jsonSchema)`.

The SDK refuses to accept a Standard Schema validator on its own. The Manifest,
the MCP tool list, and the CLI catalog are published contracts; deriving them
implicitly would let a validator-library upgrade silently rewrite a published
interface between two releases of an application that changed nothing.

## Generation and drift

```text
tasks export > registry-bundle.json
action-parity generate registry-bundle.json --out-dir generated --typescript
action-parity generate registry-bundle.json --out-dir generated --typescript --check
```

`export` is a built-in subcommand of every generated CLI, so the agent profile
names `["node", "src/cli.mjs", "export"]` and nothing else has to exist. The
`--check` form never writes; it reports `current`, `missing`, or `drifted` per
file and exits nonzero.

## Evidence

`action-parity verify` requires one runtime observation per Action and Surface,
where the execution ID the caller supplied equals the execution ID the Action
Core saw. The Node example produces 16 of them by driving the real Electron IPC
bridge, a spawned CLI process, a spawned MCP stdio server, and an HTTP listener
against one shared board:

```text
npm run generate:node-example
npm run verify:node-example
```

A Surface that never reaches the core cannot obtain an observation, so a
passing test file name cannot grant coverage to a Binding it never exercised.

## Current boundary

The SDK ships stdio MCP, not HTTP/SSE MCP transport. It does not generate
framework-specific GUI presentation code, and it does not derive TypeScript
types from the handler signature the way the Rust SDK derives schemas from Rust
types — `defineAction` takes explicit generics or an explicit JSON Schema.
Those are consumers of the registry and should not delay the smaller loop that
is already provable.
