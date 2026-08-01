# action-parity-core

`action-parity-core` is the Rust Action Registry for ActionParity. Register an
Action descriptor and handler once; the registry then provides:

- one runtime `dispatch` entry point with stable execution envelopes;
- core-level confirmation refusal for high-risk Actions;
- deterministic ActionParity Manifest generation;
- generic CLI help metadata;
- MCP `tools/list` metadata;
- Surface Binding generation from templates.

```rust
let mut registry = Registry::new(Application::new("com.example.notes", "Notes", "1.0"));

registry.register(
    ActionDescriptor::new(
        "note.list",
        "List notes",
        "List all notes.",
        json!({"type": "object"}),
        json!({"type": "object"}),
        Effects::read_only(),
    ),
    |_context, _input| Ok(json!({"notes": []})),
)?;
```

See `examples/rust-registry` in the ActionParity repository for a complete
GUI/CLI/MCP example and executable evidence plan.

