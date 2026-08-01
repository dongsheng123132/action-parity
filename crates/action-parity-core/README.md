# action-parity-core

`action-parity-core` is the Rust Action Registry for ActionParity. Register an
Action descriptor and handler once; the registry then provides:

- one runtime `dispatch` entry point with stable execution envelopes;
- core-level confirmation refusal for high-risk Actions;
- deterministic ActionParity Manifest generation;
- generic CLI help metadata;
- MCP `tools/list` metadata;
- Surface Binding generation from templates.

The preferred API reuses normal Rust domain types. `JsonSchema` derives the
input/output contract and the Registry owns deserialization, so GUI, CLI, and
MCP receive the same typed input error:

```rust
#[derive(Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
struct ListNotesInput {}

#[derive(Serialize, JsonSchema)]
struct ListNotesOutput {
    notes: Vec<Note>,
}

registry.register_typed(
    ActionDefinition::new(
        "note.list",
        "List notes",
        "List all notes.",
        Effects::read_only(),
    )
    .idempotent()
    .evidence("cargo test -p notes-core"),
    |_context, _input: ListNotesInput| Ok(ListNotesOutput { notes: vec![] }),
)?;
```

`register` and `ActionDescriptor` remain available as the low-level escape
hatch when a project must supply hand-authored JSON Schema.

Schema derivation describes the wire contract; it does not turn JSON Schema
annotations such as `minLength` into runtime business validation. Typed
deserialization enforces shape and Rust types. The Action handler still owns
semantic validation and returns the same `ActionError` to every Surface.

See `examples/rust-registry` in the ActionParity repository for a complete
GUI/CLI/MCP example and executable evidence plan.
