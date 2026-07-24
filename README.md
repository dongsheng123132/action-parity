# ActionParity

> **One action. Every interface.**

ActionParity is an open standard for software that is equally operable by humans and AI agents.

A conforming application defines each meaningful business action once in a headless **Action Core**, then exposes that same action through the interfaces it supports: GUI, CLI, TUI, MCP, API, automation, and tests.

```text
Human ── GUI / TUI ───────┐
                          ├── Action Core ── State / Events / Policy
Agent ── CLI / MCP / API ─┘
                                 │
                       Conformance tests
```

The GUI is not the application. The CLI is not the application. They are projections of the same action and state model.

**中文说明：** [README.zh-CN.md](README.zh-CN.md)

## Why ActionParity

Most desktop software was built for a person with a screen, mouse, and keyboard. AI agents are forced to infer intent from pixels, locate unstable controls, inject input, and guess whether a task succeeded.

UI automation remains essential for visual and interaction testing, but it should not be the primary way an agent invokes business capabilities.

ActionParity separates two questions:

1. **Did the application perform the right action?** Test the Action Core directly.
2. **Can a person correctly reach and understand that action?** Test the real GUI through accessibility, UI automation, and visual assertions.

This produces faster tests, reliable automation, safer agent access, and less duplicated product logic.

## The invariant

> A meaningful user action MUST have one stable action identity and one canonical implementation, regardless of which interface invokes it.

ActionParity does **not** require one CLI command for every visual control. Tabs, layout toggles, drag handles, hover states, and other presentation-only interactions remain UI concerns. It requires parity for meaningful domain actions such as creating, changing, exporting, starting, stopping, diagnosing, repairing, purchasing, or deleting.

## A minimal manifest

```json
{
  "$schema": "./schema/action-parity.schema.json",
  "spec_version": "0.1.0",
  "application": {
    "id": "org.example.notes",
    "name": "Example Notes",
    "version": "1.0.0"
  },
  "surfaces": [
    {
      "id": "desktop",
      "kind": "gui",
      "required_for_parity": true,
      "test_driver": "windows-uia"
    },
    {
      "id": "cli",
      "kind": "cli",
      "required_for_parity": true
    }
  ],
  "actions": [
    {
      "id": "note.create",
      "title": "Create note",
      "description": "Create and persist a note.",
      "input_schema": {
        "type": "object",
        "properties": {
          "title": { "type": "string" }
        },
        "required": ["title"]
      },
      "output_schema": {
        "type": "object",
        "properties": {
          "note_id": { "type": "string" }
        },
        "required": ["note_id"]
      },
      "effects": {
        "class": "write",
        "risk": "low",
        "reversible": true,
        "confirmation": "never",
        "audit_required": true
      },
      "execution": {
        "headless": true,
        "idempotent": false,
        "cancellable": false,
        "timeout_ms": 5000
      },
      "bindings": [
        {
          "surface": "desktop",
          "target": "NewNoteButton",
          "test": "tests/ui/create-note.spec.ts"
        },
        {
          "surface": "cli",
          "target": "notes note create --title <text> --json",
          "test": "tests/cli/create-note.test.ts"
        }
      ]
    }
  ]
}
```

See the complete [normative draft](SPEC.md), the [minimal example](examples/minimal/action-parity.json), the [T-King pilot manifest](examples/t-king/action-parity.json), and the [U-Model Python/Web pilot](examples/u-model/action-parity.json).

## Conformance levels

| Level | Name | Meaning |
|---|---|---|
| AP-1 | Core | Actions are typed, discoverable, headless, and directly testable. |
| AP-2 | Parity | Meaningful actions across declared interfaces map to the same Action Core. |
| AP-3 | Agent | Actions add structured results, policy, confirmation, audit, progress, and cancellation where applicable. |
| AP-4 | Verified | A published conformance report proves Action Core, binding, accessibility, and real-GUI journey tests. |

The levels are cumulative.

## Validate a manifest

Requires Node.js 20 or newer.

```bash
npm install
npm test
node bin/action-parity.mjs validate examples/minimal/action-parity.json
node bin/action-parity.mjs report examples/u-king/action-parity.json --json
```

The CLI follows agent-friendly conventions:

- stdout contains result data;
- stderr contains progress and diagnostics;
- `--json` produces a stable machine-readable envelope;
- exit codes are `0` success, `1` conformance/runtime failure, and `2` invalid usage.

## How this differs from adjacent standards

ActionParity composes existing standards instead of replacing them.

| Existing work | What it solves | What ActionParity adds |
|---|---|---|
| MCP | Agent tool discovery and invocation | A requirement that human and agent surfaces share the same application action |
| OpenAPI / OpenRPC | Machine-readable service interfaces | Local/native application parity and GUI bindings |
| WebDriver / Appium / Windows UI Automation | Real UI inspection and control | Stable domain semantics below the UI |
| AgentReady | End-to-end agent usability for web products | Native/desktop Action Core and interface conformance |
| ANIP | Governed, risk-aware agent service calls | Human GUI mapping and application-level parity |
| AG-UI / ggui | Agent-to-user interface communication or generated UI | Existing application behavior parity |
| Tauri Commands / Blender Operators / App Intents | Useful implementation primitives | Cross-framework requirements, schemas, reports, and certification |

Read the evidence and detailed comparison in [docs/LANDSCAPE.md](docs/LANDSCAPE.md).

## Project status

**v0.1.0 working draft.** The ideas are implementable; the exact schema and conformance language are intentionally open to revision before v1.0.

The first two reference implementations are now working:

- **T-King:** Tauri/React/Rust, three external pipeline actions, generic and
  legacy CLI adapters, and stable GUI selectors.
- **U-Model:** stdlib Python/Web Components, two read-only hardware/model
  actions, a real hardware invocation, and legacy `--recommend --json`.

Together they show that a legacy GUI and CLI can converge without breaking
either interface:

- a headless Action Core;
- legacy and generic CLI adapters, with MCP as a later optional surface;
- Windows UI Automation coverage;
- binding and parity reports;
- safe, sandboxed AI-driven tests.

See the [measured pilot results](docs/PILOT-RESULTS.md), the
[pilot selection](docs/PILOT-SELECTION.md), and the
[compatibility design](docs/COMPATIBILITY.md). The pilots establish AP-1/AP-2
evidence; real GUI journeys and live external workflows remain AP-4 work.

## Participate

- Read and challenge the [specification](SPEC.md).
- Propose a requirement through the [RFC process](CONTRIBUTING.md).
- Add an implementation report for a real application.
- Build an adapter for Electron, Tauri, .NET, Swift, Python, or another ecosystem.
- Join the adoption plan in [docs/ADOPTION.md](docs/ADOPTION.md).

ActionParity is intended to become community-governed infrastructure. The specification, schemas, validator, and reference adapters will remain open.

Read the short [ActionParity Manifesto](MANIFESTO.md) and the practical [launch playbook](docs/LAUNCH.md).

## Commercial ecosystem

An open standard can support a healthy commercial ecosystem without making conformance pay-to-play. Potential businesses include managed CI, independent certification, migration tooling, enterprise policy and audit, conformance labs, training, and adapter support.

The proposed model and neutrality safeguards are documented in [docs/BUSINESS.md](docs/BUSINESS.md).
Brand protection, namespace reservation, and certification-mark timing are
covered in [docs/BRAND-AND-TRADEMARK.md](docs/BRAND-AND-TRADEMARK.md).

## License

Apache License 2.0. See [LICENSE](LICENSE).
