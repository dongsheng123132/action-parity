# ActionParity Tauri adapter

The adapter exposes one Tauri command and keeps the `Registry` in managed app
state. The application expands the command macro where its own `tauri`
dependency is already available:

```rust
action_parity_tauri::tauri_command!(action_parity_call);

let adapter = action_parity_tauri::TauriAdapter::new(build_registry());

tauri::Builder::default()
    .manage(adapter)
    .invoke_handler(tauri::generate_handler![
        action_parity_call
    ]);
```

The webview sends a `DispatchRequest` to `action_parity_call`. Risk checks and
business behavior remain inside `action-parity-core`; the command only forwards
the request and returns its `ExecutionEnvelope`.
