# U-King ActionParity Production Pilot

**Implementation date:** 2026-07-25

**Product baseline:** U-King 0.9.67

**Branch:** `codex/action-parity-production-pilot`

**Stage 1 commit:** `28d901f`

**Stage 2 commit:** `0106bec`

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
| `provider.catalog` | Installation wizard provider choice | `actions::provider_catalog` | Read, redacted |
| `cleanup.scan` | Advanced-page safe-uninstall scan | `actions::cleanup_scan` | Read only |
| `health.report.preview` | My AI health-report preview | `actions::health_report_preview` | Low-risk external read |

The existing Tauri commands remain compatible. They are thin adapters to the
same action functions used by:

```text
U-King.exe action list --json
U-King.exe action describe <action-id> --json
U-King.exe action manifest --json
U-King.exe action run <action-id> --json --no-input
```

All six GUI paths now have stable `data-action-id` selectors.

## Security decision

Inspection showed that custom provider records can contain a stored `api_key`.
The production adapter therefore introduces `ProviderCatalogItem`: the secret
field does not exist in its serialized type, while `has_saved_key` preserves the
only fact the wizard and an agent need. A regression test serializes a fake
secret and proves that neither the property nor value escapes.

The health-report generator was also separated from file export. Preview runs
in memory, reads only an already-cached account identity, never creates or
activates one, and no longer displays even a device-key prefix. `cleanup.scan`
reuses the existing detector but cannot dispatch deletion. Surface parity must
not mean copying privileged GUI payloads or destructive commands into an
agent-visible interface; the action contract is a disclosure and authority
boundary.

## Measured evidence

- ActionParity validation:
  - actions: 6;
  - headless: 6/6;
  - required bindings: 12/12;
  - strict parity: 100%;
  - errors: 0;
  - warnings: 0.
- Stage 2 change: 11 files, 693 insertions, 167 deletions.
- Rust tests: 23 passed.
- Rust `cargo check`: passed; one unrelated existing dead-code warning remains.
- React/TypeScript production build: passed.
- Debug executable:
  - `environment.inspect`: 987 ms;
  - `driver.status`: 38 ms;
  - `tool.list`: 6,629 ms.
- Release executable (Windows GUI subsystem):
  - action discovery returned all six actions with exit code 0;
  - `provider.catalog` returned six records and no `api_key` property;
  - `cleanup.scan` returned 17 footprints without deleting anything;
  - `health.report.preview` returned a report longer than 700 characters with
    the key hidden and left `device.json` hash and modification time unchanged;
  - an unknown input field returned `invalid_input` in 0 ms with exit code 2;
  - stdout contained the JSON result and stderr remained empty.

The real executable test found one integration bug that compile and unit tests
did not: the manifest declared `confirmation: never` for the low-risk external
preview, while the CLI still inferred confirmation from effect class. The
executor now treats the manifest confirmation policy as the source of truth,
with a regression test. This is evidence that a standard must test enforcement,
not merely validate declarations.

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

1. define one sandboxed write action with confirmation, audit metadata, and a
   tested rollback;
2. add one Windows WebView2/UI Automation journey for each current selector;
3. add runtime conformance tests proving confirmation and effect enforcement;
4. only then consider MCP generation.

This stage demonstrates AP-1/AP-2. It does not claim AP-4 real-GUI certification
or customer release completion.
