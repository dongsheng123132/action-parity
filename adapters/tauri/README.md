# action-parity-tauri

`action-parity-tauri` is the thin Tauri v2 boundary for an
`action-parity-core` Registry. It adds no second dispatch table and contains no
business policy.

The adapter intentionally does not depend on Tauri itself. Its macro expands in
the host application, so headless Registry builds and tests stay small:

```rust
use action_parity_tauri::{tauri_command, TauriAdapter};

tauri_command!(action_parity_call);

tauri::Builder::default()
    .manage(TauriAdapter::new(build_registry()?))
    .invoke_handler(tauri::generate_handler![action_parity_call]);
```

Generate the TypeScript caller from the same Registry bundle:

```text
action-parity generate registry-bundle.json --out-dir generated --typescript
```

The generated webview client forwards one typed request through
`action_parity_call`; confirmation and business effects remain enforced by the
shared Registry.
