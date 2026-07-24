# U-King ActionParity Production Pilot

**Implementation date:** 2026-07-25

**Product baseline:** U-King 0.9.67

**Branch:** `codex/action-parity-production-pilot`

**Implementation commit:** `28d901f`

U-King is the first production application to adopt the T-King/U-Model adapter
pattern. The work was isolated from an active dirty production worktree and did
not bump a version, package an installer, deploy an executable, or change a
customer configuration.

## Implemented slice

| Action ID | Existing GUI path | Shared Rust entry | Effect |
|---|---|---|---|
| `environment.inspect` | Installation wizard computer diagnosis | `actions::environment_inspect` | Read |
| `tool.list` | My AI / tool catalogue | `actions::tool_list` | Read |
| `driver.status` | Provider switch current-state display | `actions::driver_status` | Read |

The existing Tauri commands remain compatible. They are thin adapters to the
same action functions used by:

```text
U-King.exe action list --json
U-King.exe action describe <action-id> --json
U-King.exe action manifest --json
U-King.exe action run <action-id> --json --no-input
```

All three GUI paths now have stable `data-action-id` selectors.

## Security decision

The initial plan proposed exposing the provider catalogue. Inspection showed
that custom provider records can contain a stored `api_key`. Returning the
existing GUI payload through a machine CLI would disclose that secret.

The implemented slice therefore exposes `driver.status`, which reports active
providers and models without credentials. This is a practical standard-design
lesson: surface parity must not mean copying privileged GUI payloads into an
agent-visible interface. The action contract is also a disclosure boundary.

## Measured evidence

- ActionParity validation:
  - actions: 3;
  - headless: 3/3;
  - required bindings: 6/6;
  - strict parity: 100%;
  - errors: 0;
  - warnings: 0.
- Rust tests: 21 passed.
- Rust `cargo check`: passed; one unrelated existing dead-code warning remains.
- React/TypeScript production build: passed.
- Debug executable:
  - `environment.inspect`: 987 ms;
  - `driver.status`: 38 ms;
  - `tool.list`: 6,629 ms.
- Release executable (Windows GUI subsystem):
  - action discovery returned parseable JSON with exit code 0;
  - real `environment.inspect` returned parseable JSON in 816 ms;
  - an unknown input field returned `invalid_input` in 0 ms with exit code 2;
  - stdout contained the JSON result and stderr remained empty.

The release-mode check matters because a Windows GUI executable can behave
differently from a debug console executable. The result proves that AI
subprocess capture works against the actual release subsystem shape.

## Safety boundary

This stage intentionally performed only read operations. It did not:

- write `~/.claude`, `~/.codex`, ClawX, Hermes, or U-King user state;
- apply or test a provider;
- install, launch, stop, upgrade, or uninstall software;
- use `UKING_TEST_KEY`;
- modify the production version;
- publish an exe or trigger the U-King update chain.

Future write-action tests must use `UKING_TEST_HOME`, validate all input before
side effects, require explicit confirmation, and prove rollback behavior.

## Architecture result

```text
Tauri GUI command ─┐
                   ├─> actions.rs ─> existing U-King domain modules
AI action CLI ─────┤
legacy selfcheck ──┘
```

This is the useful meaning of “GUI floating on a CLI river”: not that the CLI
renders or controls pixels, but that every important user intent has one
canonical action below all presentation surfaces.

## Next production slice

The next stage should stay incremental:

1. add a redacted provider catalogue rather than exposing `ProviderPreset`
   directly;
2. expose health-report preview separately from health-report file export;
3. expose cleanup scan as read-only before any cleanup action;
4. define one sandboxed write action with confirmation, audit metadata, and a
   tested rollback;
5. add one Windows WebView2/UI Automation journey for each current selector;
6. only then consider MCP generation.

This stage demonstrates AP-1/AP-2. It does not claim AP-4 real-GUI certification
or customer release completion.
