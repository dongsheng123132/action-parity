# action-parity-core

`action-parity-core` is the Rust Action Registry for ActionParity. Register an
Action descriptor and handler once; the registry then provides:

- one runtime `dispatch` entry point with stable execution envelopes;
- core-level confirmation refusal for high-risk Actions;
- deterministic ActionParity Manifest generation;
- generic CLI help metadata;
- MCP `tools/list` metadata;
- Surface Binding generation from templates, limited to the Surfaces where each
  Action is actually exposed.

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
    .surface("cli")
    .surface("mcp")
    .idempotent()
    .evidence("cargo test -p notes-core"),
    |_context, _input: ListNotesInput| Ok(ListNotesOutput { notes: vec![] }),
)?;
```

An Action is exposed on every registered Surface by default. Use repeated
`.surface("...")` calls when a real application exposes only a subset. The
Registry then filters Manifest Bindings, CLI help, MCP tools, and runtime
dispatch consistently; requesting the Action through an unlisted Surface is a
stable `action_not_exposed_on_surface` error. Add Surfaces before registering a
scoped Action so typos fail immediately. A scoped Action may omit only optional
Surfaces: if a Surface is `required_for_parity`, registration fails until the
Action exposes it. During gradual adoption, mark the incomplete Surface optional
and state its `exclusion_reason` rather than generating a false Binding.

`register` and `ActionDescriptor` remain available as the low-level escape
hatch when a project must supply hand-authored JSON Schema.

Schema derivation describes the wire contract; it does not turn JSON Schema
annotations such as `minLength` into runtime business validation. Typed
deserialization enforces shape and Rust types. The Action handler still owns
semantic validation and returns the same `ActionError` to every Surface.

See `examples/rust-registry` in the ActionParity repository for a complete
GUI/CLI/MCP example and executable evidence plan.
