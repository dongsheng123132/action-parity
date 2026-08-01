# Executable Action Registry

Status: implementation preview for the 0.6 toolchain. It does not add new
normative clauses to the specification.

## Why this exists

The Manifest is an interchange artifact, not the authoring interface. A team
should not repeat an Action ID, schemas, effects, and descriptions in a GUI
table, CLI parser, MCP server, and JSON file. `action-parity-core` makes the
runtime registry the authoring source and generates the repetitive parts.

```text
ActionDescriptor + handler
          |
          +-- runtime dispatch / ExecutionEnvelope
          +-- action-parity.json
          +-- cli-help.json
          +-- mcp-tools.json
          +-- Surface Bindings from templates
```

The Tauri adapter contains one forwarding command. A generic CLI or MCP
transport follows the same rule: parse transport input, call `Registry::dispatch`,
and return the envelope. Confirmation for high-risk effects is enforced before
the handler, below every Surface.

## Deterministic generation

`Registry::artifact_bundle()` emits
`action-parity.registry-bundle/v1`. The npm CLI materializes it with:

```text
action-parity generate registry-bundle.json --out-dir generated
```

The output contains `action-parity.json`, `cli-help.json`, and `mcp-tools.json`.
Actions and Surfaces use ordered maps, and the materializer sorts object keys,
so unchanged input produces byte-identical output.

## Declared evidence versus verified evidence

`validate` and `report` remain static. A non-empty `binding.test` is now
reported as a **declared test**, never as a passed or proven Binding. Static
output includes `evidence.status = "declared"` and stops at AP-1.

`verify` consumes a sidecar plan. Commands are arrays rather than shell strings:

```json
{
  "version": 1,
  "generator": {
    "command": ["my-app", "registry", "export"]
  },
  "tests": [
    {
      "ref": "tests/parity.test.mjs",
      "command": ["node", "tests/parity.test.mjs"],
      "observations": "parity-observations.json"
    }
  ],
  "artifacts": ["target/release/my-app{exe}"]
}
```

Each observation must name `action_id`, `surface`, `request_execution_id`, and
`core_execution_id`. A Binding is verified only when its command passes and the
two non-empty execution IDs match. This prevents one passing suite filename
from silently granting coverage to Actions the suite never invoked.

The report records Git commit and dirty state, Manifest and plan hashes,
artifact hashes, exact command arrays, working directories, OS/architecture,
Node version, exit codes, durations, timeout status, output hashes, per-Binding
observations, and its own SHA-256.

## Tauri integration

`action-parity-tauri` deliberately avoids a second dispatch table and avoids
pulling Tauri into headless builds. The Tauri application expands one command
macro and manages a `TauriAdapter`; the adapter forwards `DispatchRequest` to
the shared Registry.

## Current boundary

This preview supplies the Rust Registry, Tauri forwarding boundary, generic
artifact generation, and executable verification. It does not yet perform
framework source discovery (`doctor`) or run an MCP transport server. Those are
consumers of the registry and should not delay proving the smaller loop.
